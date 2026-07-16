import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { forbidden, notFound, requireUserId } from "./lib/authz";

async function findRequestBetween(ctx: QueryCtx, userA: Id<"users">, userB: Id<"users">) {
  const asFrom = await ctx.db
    .query("friendRequests")
    .withIndex("by_from_and_to", (q) => q.eq("fromUserId", userA).eq("toUserId", userB))
    .unique();
  if (asFrom) return asFrom;
  return await ctx.db
    .query("friendRequests")
    .withIndex("by_from_and_to", (q) => q.eq("fromUserId", userB).eq("toUserId", userA))
    .unique();
}

export async function areFriends(ctx: QueryCtx, userA: Id<"users">, userB: Id<"users">) {
  const request = await findRequestBetween(ctx, userA, userB);
  return request?.status === "accepted";
}

export const searchUsers = query({
  args: { search: v.string() },
  handler: async (ctx, { search }) => {
    const userId = await requireUserId(ctx);
    if (!search.trim()) return [];

    const results = await ctx.db
      .query("users")
      .withSearchIndex("search_displayName", (q) => q.search("displayName", search.trim()))
      .take(20);

    return await Promise.all(
      results
        .filter((u) => u._id !== userId)
        .map(async (u) => {
          const request = await findRequestBetween(ctx, userId, u._id);
          const relationship: "none" | "friends" | "incoming" | "outgoing" =
            request?.status === "accepted"
              ? "friends"
              : request && request.fromUserId === userId
                ? "outgoing"
                : request
                  ? "incoming"
                  : "none";
          return {
            userId: u._id,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            relationship,
            requestId: request?._id,
          };
        }),
    );
  },
});

export const sendFriendRequest = mutation({
  args: { toUserId: v.id("users") },
  handler: async (ctx, { toUserId }) => {
    const userId = await requireUserId(ctx);
    if (userId === toUserId) throw new Error("You can't friend yourself");
    if (!(await ctx.db.get(toUserId))) notFound("User not found");

    const existing = await findRequestBetween(ctx, userId, toUserId);
    if (existing?.status === "accepted") throw new Error("You're already friends");
    if (existing?.status === "pending") {
      if (existing.fromUserId === userId) throw new Error("Friend request already sent");
      // They already sent one to us — accept it instead of creating a duplicate.
      await ctx.db.patch(existing._id, { status: "accepted" });
      return existing._id;
    }

    return await ctx.db.insert("friendRequests", {
      fromUserId: userId,
      toUserId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const respondToFriendRequest = mutation({
  args: { requestId: v.id("friendRequests"), accept: v.boolean() },
  handler: async (ctx, { requestId, accept }) => {
    const userId = await requireUserId(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) notFound("Friend request not found");
    if (request.toUserId !== userId) forbidden("This request wasn't sent to you");

    if (accept) {
      await ctx.db.patch(requestId, { status: "accepted" });
    } else {
      await ctx.db.delete(requestId);
    }
  },
});

export const cancelFriendRequest = mutation({
  args: { requestId: v.id("friendRequests") },
  handler: async (ctx, { requestId }) => {
    const userId = await requireUserId(ctx);
    const request = await ctx.db.get(requestId);
    if (!request) notFound("Friend request not found");
    if (request.fromUserId !== userId) forbidden("This isn't your request to cancel");
    await ctx.db.delete(requestId);
  },
});

export const removeFriend = mutation({
  args: { friendUserId: v.id("users") },
  handler: async (ctx, { friendUserId }) => {
    const userId = await requireUserId(ctx);
    const request = await findRequestBetween(ctx, userId, friendUserId);
    if (!request || request.status !== "accepted") throw new Error("You're not friends with this user");
    await ctx.db.delete(request._id);
  },
});

async function withOtherUser(ctx: QueryCtx, requests: Doc<"friendRequests">[], side: "fromUserId" | "toUserId") {
  return await Promise.all(
    requests.map(async (r) => {
      const otherUser = await ctx.db.get(r[side]);
      return { requestId: r._id, otherUser };
    }),
  );
}

export const listFriends = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const asFrom = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_and_status", (q) => q.eq("fromUserId", userId).eq("status", "accepted"))
      .collect();
    const asTo = await ctx.db
      .query("friendRequests")
      .withIndex("by_to_and_status", (q) => q.eq("toUserId", userId).eq("status", "accepted"))
      .collect();

    const fromFriends = await withOtherUser(ctx, asFrom, "toUserId");
    const toFriends = await withOtherUser(ctx, asTo, "fromUserId");
    return [...fromFriends, ...toFriends].filter((f) => f.otherUser !== null);
  },
});

export const listIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_to_and_status", (q) => q.eq("toUserId", userId).eq("status", "pending"))
      .collect();
    return (await withOtherUser(ctx, requests, "fromUserId")).filter((r) => r.otherUser !== null);
  },
});

export const listOutgoingRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const requests = await ctx.db
      .query("friendRequests")
      .withIndex("by_from_and_status", (q) => q.eq("fromUserId", userId).eq("status", "pending"))
      .collect();
    return (await withOtherUser(ctx, requests, "toUserId")).filter((r) => r.otherUser !== null);
  },
});
