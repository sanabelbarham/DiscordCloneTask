import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/authz";

export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db.get(userId);
  },
});

export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireUserId(ctx); // any authenticated user may read any profile (FR-004)
    return await ctx.db.get(userId);
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { displayName, avatarUrl }) => {
    const userId = await requireUserId(ctx);
    const patch: Record<string, string> = {};
    if (displayName !== undefined) patch.displayName = displayName;
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl;
    await ctx.db.patch(userId, patch);
  },
});
