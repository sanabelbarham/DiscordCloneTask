import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { forbidden, requireUserId } from "./lib/authz";

// 3x the ~5s call-heartbeat interval (research.md §6).
const CALL_STALE_THRESHOLD_MS = 15_000;

async function requireMembership(ctx: QueryCtx, serverId: Id<"servers">, userId: Id<"users">) {
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
    .unique();
  if (!membership) forbidden("Not a member of this server");
}

export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const userId = await requireUserId(ctx);
    await requireMembership(ctx, serverId, userId);

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();

    return await Promise.all(
      channels
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt - b.createdAt)
        .map(async (channel) => {
          if (channel.type !== "voice") return { ...channel, connectedVoiceUserIds: undefined };

          const call = await ctx.db
            .query("calls")
            .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
            .unique();
          if (!call) return { ...channel, connectedVoiceUserIds: [] };

          const participants = await ctx.db
            .query("callParticipants")
            .withIndex("by_call", (q) => q.eq("callId", call._id))
            .collect();
          const now = Date.now();
          const connectedVoiceUserIds = participants
            .filter((p) => now - p.lastHeartbeatAt < CALL_STALE_THRESHOLD_MS)
            .map((p) => p.userId);
          return { ...channel, connectedVoiceUserIds };
        }),
    );
  },
});

export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  },
  handler: async (ctx, { serverId, name, type }) => {
    const userId = await requireUserId(ctx);
    const server = await ctx.db.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.ownerId !== userId) forbidden("Only the owner can create channels");
    if (!name.trim()) throw new Error("Channel name is required");

    return await ctx.db.insert("channels", {
      serverId,
      name: name.trim(),
      type,
      isDefault: false,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: { channelId: v.id("channels"), name: v.string() },
  handler: async (ctx, { channelId, name }) => {
    const userId = await requireUserId(ctx);
    const channel = await ctx.db.get(channelId);
    if (!channel) throw new Error("Channel not found");
    const server = await ctx.db.get(channel.serverId);
    if (!server || server.ownerId !== userId) forbidden("Only the owner can rename channels");
    if (!name.trim()) throw new Error("Channel name is required");
    await ctx.db.patch(channelId, { name: name.trim() });
  },
});

export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const userId = await requireUserId(ctx);
    const channel = await ctx.db.get(channelId);
    if (!channel) throw new Error("Channel not found");
    const server = await ctx.db.get(channel.serverId);
    if (!server || server.ownerId !== userId) forbidden("Only the owner can delete channels");

    // Cascade: delete every message in this channel (FR-013).
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();
    for (const message of messages) await ctx.db.delete(message._id);

    // Cascade: force-end an active call in this voice channel (FR-031).
    if (channel.type === "voice") {
      const call = await ctx.db
        .query("calls")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .unique();
      if (call) {
        const participants = await ctx.db
          .query("callParticipants")
          .withIndex("by_call", (q) => q.eq("callId", call._id))
          .collect();
        for (const p of participants) await ctx.db.delete(p._id);
        await ctx.db.delete(call._id);
      }
    }

    await ctx.db.delete(channelId);
  },
});
