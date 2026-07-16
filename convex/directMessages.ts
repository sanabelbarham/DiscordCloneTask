import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { areFriends } from "./friends";
import { forbidden, requireUserId } from "./lib/authz";

async function sharesAServerWith(ctx: QueryCtx, userA: Id<"users">, userB: Id<"users">) {
  const serversOfA = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", userA))
    .collect();
  const serverIdsOfA = new Set(serversOfA.map((m) => m.serverId));

  const serversOfB = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", userB))
    .collect();
  return serversOfB.some((m) => serverIdsOfA.has(m.serverId));
}

/** openOrCreateThread stores the pair as (lower id, higher id) so `by_pair` is
 * an idempotent lookup regardless of who initiates (data-model.md §directMessageThreads). */
function orderedPair(a: Id<"users">, b: Id<"users">): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

export const openOrCreateThread = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const userId = await requireUserId(ctx);
    if (userId === otherUserId) throw new Error("Cannot start a DM with yourself");

    const [participantA, participantB] = orderedPair(userId, otherUserId);
    const existing = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_pair", (q) => q.eq("participantA", participantA).eq("participantB", participantB))
      .unique();
    if (existing) return existing._id;

    if (
      !(await sharesAServerWith(ctx, userId, otherUserId)) &&
      !(await areFriends(ctx, userId, otherUserId))
    ) {
      forbidden("You must share a server or be friends with this user to start a DM");
    }

    return await ctx.db.insert("directMessageThreads", {
      participantA,
      participantB,
      createdAt: Date.now(),
    });
  },
});

export const listThreadsForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const asA = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_participantA", (q) => q.eq("participantA", userId))
      .collect();
    const asB = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_participantB", (q) => q.eq("participantB", userId))
      .collect();

    const threads = [...asA, ...asB];
    return await Promise.all(
      threads.map(async (thread) => {
        const otherUserId = thread.participantA === userId ? thread.participantB : thread.participantA;
        const otherUser = await ctx.db.get(otherUserId);
        return { ...thread, otherUser };
      }),
    );
  },
});
