import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { forbidden, requireUserId } from "./lib/authz";

function randomInviteCode() {
  return Array.from({ length: 10 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)],
  ).join("");
}

async function requireMembership(ctx: QueryCtx, serverId: Id<"servers">, userId: Id<"users">) {
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
    .unique();
  if (!membership) forbidden("Not a member of this server");
  return membership;
}

export const create = mutation({
  args: { name: v.string(), imageUrl: v.optional(v.string()) },
  handler: async (ctx, { name, imageUrl }) => {
    const userId = await requireUserId(ctx);
    if (!name.trim()) throw new Error("Server name is required");

    const serverId = await ctx.db.insert("servers", {
      name: name.trim(),
      imageUrl,
      ownerId: userId,
      inviteCode: randomInviteCode(),
    });
    await ctx.db.insert("serverMembers", { serverId, userId, joinedAt: Date.now() });
    // Every new server ships a default "general" text channel (FR-010).
    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
      isDefault: true,
      createdAt: Date.now(),
    });
    return serverId;
  },
});

export const rename = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, { serverId, name }) => {
    const userId = await requireUserId(ctx);
    const server = await ctx.db.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.ownerId !== userId) forbidden("Only the owner can rename this server");
    if (!name.trim()) throw new Error("Server name is required");
    await ctx.db.patch(serverId, { name: name.trim() });
  },
});

export const regenerateInvite = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const userId = await requireUserId(ctx);
    const server = await ctx.db.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.ownerId !== userId) forbidden("Only the owner can regenerate the invite");
    const inviteCode = randomInviteCode();
    await ctx.db.patch(serverId, { inviteCode });
    return { inviteCode };
  },
});

export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, { inviteCode }) => {
    const userId = await requireUserId(ctx);
    const server = await ctx.db
      .query("servers")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
      .unique();
    if (!server) throw new Error("Invalid invite link");

    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) => q.eq("serverId", server._id).eq("userId", userId))
      .unique();
    if (!existing) {
      await ctx.db.insert("serverMembers", { serverId: server._id, userId, joinedAt: Date.now() });
    }
    return server._id;
  },
});

export const listMembers = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const userId = await requireUserId(ctx);
    await requireMembership(ctx, serverId, userId);
    const server = await ctx.db.get(serverId);
    if (!server) throw new Error("Server not found");

    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();

    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        const presence = await ctx.db
          .query("presence")
          .withIndex("by_userId", (q) => q.eq("userId", m.userId))
          .unique();
        const isOnline = presence !== null && Date.now() - presence.lastSeen < 10_000;
        return {
          userId: m.userId,
          displayName: user?.displayName ?? "Unknown",
          avatarUrl: user?.avatarUrl ?? "",
          isOnline,
          role: server.ownerId === m.userId ? ("owner" as const) : ("member" as const),
        };
      }),
    );
  },
});

export const removeMember = mutation({
  args: { serverId: v.id("servers"), userId: v.id("users") },
  handler: async (ctx, { serverId, userId: targetUserId }) => {
    const callerId = await requireUserId(ctx);
    const server = await ctx.db.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.ownerId !== callerId) forbidden("Only the owner can remove members");
    if (targetUserId === callerId) throw new Error("The owner cannot remove themselves");

    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", targetUserId))
      .unique();
    if (!membership) return;
    await ctx.db.delete(membership._id);

    // Call cascade (data-model.md §serverMembers): drop the removed user out of
    // any active call belonging to a voice channel of this server.
    const participantRows = await ctx.db
      .query("callParticipants")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .collect();
    for (const row of participantRows) {
      const call = await ctx.db.get(row.callId);
      if (!call || !call.channelId) continue;
      const channel = await ctx.db.get(call.channelId);
      if (!channel || channel.serverId !== serverId) continue;

      await ctx.db.delete(row._id);
      const remaining = await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", call._id))
        .collect();
      if (remaining.length === 0) {
        await ctx.db.delete(call._id);
      }
    }
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const servers = await Promise.all(memberships.map((m) => ctx.db.get(m.serverId)));
    return servers.filter((s) => s !== null);
  },
});
