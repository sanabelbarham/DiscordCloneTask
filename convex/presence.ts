import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/authz";

// 2x the client's ~5s heartbeat interval (research.md §2).
const ONLINE_THRESHOLD_MS = 10_000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: Date.now() });
    } else {
      await ctx.db.insert("presence", { userId, lastSeen: Date.now() });
    }
  },
});

export const getStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUserId(ctx);
    const row = await ctx.db
      .query("presence")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return { isOnline: row !== null && Date.now() - row.lastSeen < ONLINE_THRESHOLD_MS };
  },
});
