import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { forbidden, requireUserId } from "./lib/authz";

async function isParticipant(ctx: QueryCtx, callId: Id<"calls">, userId: Id<"users">) {
  const row = await ctx.db
    .query("callParticipants")
    .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
    .unique();
  return row !== null;
}

export const send = mutation({
  args: {
    callId: v.id("calls"),
    toUserId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    payload: v.string(),
  },
  handler: async (ctx, { callId, toUserId, type, payload }) => {
    const userId = await requireUserId(ctx);
    if (!(await isParticipant(ctx, callId, userId))) forbidden("Not a participant of this call");
    if (!(await isParticipant(ctx, callId, toUserId))) forbidden("Recipient is not a participant of this call");

    await ctx.db.insert("signals", {
      callId,
      fromUserId: userId,
      toUserId,
      type,
      payload,
      createdAt: Date.now(),
    });
  },
});

export const listForMe = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("signals")
      .withIndex("by_recipient", (q) => q.eq("callId", callId).eq("toUserId", userId))
      .collect();
  },
});

export const consume = mutation({
  args: { signalId: v.id("signals") },
  handler: async (ctx, { signalId }) => {
    const userId = await requireUserId(ctx);
    const signal = await ctx.db.get(signalId);
    if (!signal) return;
    if (signal.toUserId !== userId) forbidden("Only the recipient can consume this signal");
    await ctx.db.delete(signalId);
  },
});
