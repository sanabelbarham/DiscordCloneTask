import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { forbidden, notFound, requireUserId } from "./lib/authz";

// 3x the ~5s call-heartbeat interval (research.md §6).
const STALE_THRESHOLD_MS = 15_000;
const MAX_PARTICIPANTS = 4;

const containerArgs = {
  channelId: v.optional(v.id("channels")),
  threadId: v.optional(v.id("directMessageThreads")),
};

async function requireCallAccess(
  ctx: MutationCtx,
  { channelId, threadId }: { channelId?: Id<"channels">; threadId?: Id<"directMessageThreads"> },
  userId: Id<"users">,
) {
  if (!!channelId === !!threadId) {
    throw new Error("Exactly one of channelId or threadId is required");
  }

  if (channelId) {
    const channel = await ctx.db.get(channelId);
    if (!channel || channel.type !== "voice") notFound("Voice channel not found");
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) => q.eq("serverId", channel.serverId).eq("userId", userId))
      .unique();
    if (!membership) forbidden("Not a member of this channel's server");
    return;
  }

  const thread = await ctx.db.get(threadId!);
  if (!thread) notFound("Conversation not found");
  if (thread.participantA !== userId && thread.participantB !== userId) {
    forbidden("Not a participant of this conversation");
  }
}

/** Deletes any callParticipants row in `callId` whose heartbeat is stale
 * (research.md §6) so ghosts never occupy a capacity slot or linger in a
 * roster. Returns the surviving rows. */
async function reapStaleParticipants(ctx: MutationCtx, callId: Id<"calls">) {
  const rows = await ctx.db
    .query("callParticipants")
    .withIndex("by_call", (q) => q.eq("callId", callId))
    .collect();
  const now = Date.now();
  const alive = [];
  for (const row of rows) {
    if (now - row.lastHeartbeatAt > STALE_THRESHOLD_MS) {
      await ctx.db.delete(row._id);
    } else {
      alive.push(row);
    }
  }
  return alive;
}

export const join = mutation({
  args: containerArgs,
  handler: async (ctx, { channelId, threadId }) => {
    const userId = await requireUserId(ctx);
    await requireCallAccess(ctx, { channelId, threadId }, userId);

    let call = channelId
      ? await ctx.db
          .query("calls")
          .withIndex("by_channel", (q) => q.eq("channelId", channelId))
          .unique()
      : await ctx.db
          .query("calls")
          .withIndex("by_thread", (q) => q.eq("threadId", threadId))
          .unique();

    if (!call) {
      const callId = await ctx.db.insert("calls", { channelId, threadId, startedAt: Date.now() });
      call = (await ctx.db.get(callId))!;
    }

    const alive = await reapStaleParticipants(ctx, call._id);
    const already = alive.find((p) => p.userId === userId);
    if (already) {
      // Idempotent rejoin (e.g. page refresh): just refresh the heartbeat.
      await ctx.db.patch(already._id, { lastHeartbeatAt: Date.now() });
      return { callId: call._id, participants: alive.filter((p) => p.userId !== userId).map((p) => p.userId) };
    }

    if (alive.length >= MAX_PARTICIPANTS) {
      throw new ConvexError({ code: "CALL_FULL", message: "This voice channel is full" });
    }

    await ctx.db.insert("callParticipants", {
      callId: call._id,
      userId,
      micOn: true,
      cameraOn: true,
      lastHeartbeatAt: Date.now(),
      joinedAt: Date.now(),
    });

    return { callId: call._id, participants: alive.map((p) => p.userId) };
  },
});

export const leave = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
      .unique();
    if (row) await ctx.db.delete(row._id);

    const remaining = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    if (remaining.length === 0) {
      const call = await ctx.db.get(callId);
      if (call) await ctx.db.delete(call._id);
    }
  },
});

export const heartbeat = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
      .unique();
    if (!row) forbidden("Not a participant of this call");
    await ctx.db.patch(row._id, { lastHeartbeatAt: Date.now() });

    // Opportunistically reap other stale rows in the same call (research.md §6)
    // — this is what actually drives an abandoned call's participant count to zero.
    const others = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    const now = Date.now();
    for (const other of others) {
      if (other._id !== row._id && now - other.lastHeartbeatAt > STALE_THRESHOLD_MS) {
        await ctx.db.delete(other._id);
      }
    }
  },
});

export const setMediaState = mutation({
  args: { callId: v.id("calls"), micOn: v.optional(v.boolean()), cameraOn: v.optional(v.boolean()) },
  handler: async (ctx, { callId, micOn, cameraOn }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
      .unique();
    if (!row) forbidden("Not a participant of this call");
    const patch: { micOn?: boolean; cameraOn?: boolean } = {};
    if (micOn !== undefined) patch.micOn = micOn;
    if (cameraOn !== undefined) patch.cameraOn = cameraOn;
    await ctx.db.patch(row._id, patch);
  },
});

export const listParticipants = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    // Any authenticated user may read the roster (not gated to current
    // participants): channels.list already exposes the same connected-voice
    // roster to every server member, and the removed-user's own client relies
    // on this query continuing to succeed (just without their own row) to
    // detect a mid-call removal without needing React error-boundary plumbing
    // around a thrown FORBIDDEN (see VoiceChannelPage/CallRoom).
    await requireUserId(ctx);
    const rows = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    const now = Date.now();
    const alive = rows.filter((r) => now - r.lastHeartbeatAt < STALE_THRESHOLD_MS);

    return await Promise.all(
      alive.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          userId: r.userId,
          displayName: user?.displayName ?? "Unknown",
          avatarUrl: user?.avatarUrl ?? "",
          micOn: r.micOn,
          cameraOn: r.cameraOn,
        };
      }),
    );
  },
});
