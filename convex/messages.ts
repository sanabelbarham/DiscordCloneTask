import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { forbidden, notFound, requireUserId } from "./lib/authz";

const TYPING_THRESHOLD_MS = 3_000;

const containerArgs = {
  channelId: v.optional(v.id("channels")),
  threadId: v.optional(v.id("directMessageThreads")),
};

/** Every function here takes either `channelId` or `threadId`, never both —
 * data-model.md §messages. Resolves and authorizes the container in one step. */
async function requireContainerAccess(
  ctx: QueryCtx | MutationCtx,
  { channelId, threadId }: { channelId?: Id<"channels">; threadId?: Id<"directMessageThreads"> },
  userId: Id<"users">,
) {
  if (!!channelId === !!threadId) {
    throw new Error("Exactly one of channelId or threadId is required");
  }

  if (channelId) {
    const channel = await ctx.db.get(channelId);
    if (!channel) notFound("Channel not found");
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) => q.eq("serverId", channel.serverId).eq("userId", userId))
      .unique();
    if (!membership) forbidden("Not a member of this channel's server");
    return { channelId, threadId: undefined as Id<"directMessageThreads"> | undefined };
  }

  const thread = await ctx.db.get(threadId!);
  if (!thread) notFound("Conversation not found");
  if (thread.participantA !== userId && thread.participantB !== userId) {
    forbidden("Not a participant of this conversation");
  }
  return { channelId: undefined as Id<"channels"> | undefined, threadId };
}

export const list = query({
  args: { ...containerArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { channelId, threadId, paginationOpts }) => {
    const userId = await requireUserId(ctx);
    await requireContainerAccess(ctx, { channelId, threadId }, userId);

    if (channelId) {
      return await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .order("desc")
        .paginate(paginationOpts);
    }
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

export const send = mutation({
  args: { ...containerArgs, content: v.string() },
  handler: async (ctx, { channelId, threadId, content }) => {
    const userId = await requireUserId(ctx);
    await requireContainerAccess(ctx, { channelId, threadId }, userId);
    if (!content.trim()) throw new Error("Message content is required");

    return await ctx.db.insert("messages", {
      channelId,
      threadId,
      authorId: userId,
      content: content.trim(),
      createdAt: Date.now(),
    });
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) notFound("Message not found");
    if (message.authorId !== userId) forbidden("Only the author can edit this message");
    if (!content.trim()) throw new Error("Message content is required");
    await ctx.db.patch(messageId, { content: content.trim(), editedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) notFound("Message not found");
    if (message.authorId !== userId) forbidden("Only the author can delete this message");
    await ctx.db.delete(messageId);
  },
});

export const setTyping = mutation({
  args: containerArgs,
  handler: async (ctx, { channelId, threadId }) => {
    const userId = await requireUserId(ctx);
    await requireContainerAccess(ctx, { channelId, threadId }, userId);

    const existing = channelId
      ? await ctx.db
          .query("typingIndicators")
          .withIndex("by_channel", (q) => q.eq("channelId", channelId))
          .filter((q) => q.eq(q.field("userId"), userId))
          .unique()
      : await ctx.db
          .query("typingIndicators")
          .withIndex("by_thread", (q) => q.eq("threadId", threadId))
          .filter((q) => q.eq(q.field("userId"), userId))
          .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: Date.now() });
    } else {
      await ctx.db.insert("typingIndicators", { channelId, threadId, userId, updatedAt: Date.now() });
    }
  },
});

export const listTyping = query({
  args: containerArgs,
  handler: async (ctx, { channelId, threadId }) => {
    const userId = await requireUserId(ctx);
    await requireContainerAccess(ctx, { channelId, threadId }, userId);

    const rows = channelId
      ? await ctx.db
          .query("typingIndicators")
          .withIndex("by_channel", (q) => q.eq("channelId", channelId))
          .collect()
      : await ctx.db
          .query("typingIndicators")
          .withIndex("by_thread", (q) => q.eq("threadId", threadId))
          .collect();

    const now = Date.now();
    const active = rows.filter((r) => now - r.updatedAt < TYPING_THRESHOLD_MS && r.userId !== userId);
    return await Promise.all(
      active.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { userId: r.userId, displayName: user?.displayName ?? "Someone" };
      }),
    );
  },
});
