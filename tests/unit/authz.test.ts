import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

// convex-test needs every convex/**/*.ts module to resolve api.* references.
const modules = import.meta.glob("../../convex/**/*.ts");

async function seedUser(t: ReturnType<typeof convexTest>, displayName: string) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: `${displayName}@example.com`,
      displayName,
      avatarUrl: "https://example.com/avatar.png",
    });
  });
  // Convex Auth's getAuthUserId(ctx) resolves the caller from
  // identity.subject — passing the raw user id string here simulates an
  // authenticated session for that user (research.md §7).
  return { userId, as: t.withIdentity({ subject: userId }) };
}

describe("messages.ts authorization", () => {
  test("an unauthenticated caller cannot send a message", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "alice");
    const channelId = await t.run(async (ctx) => {
      const serverId = await ctx.db.insert("servers", {
        name: "s",
        ownerId: userId,
        inviteCode: "code1",
      });
      return await ctx.db.insert("channels", {
        serverId,
        name: "general",
        type: "text",
        isDefault: true,
        createdAt: Date.now(),
      });
    });

    await expect(t.mutation(api.messages.send, { channelId, content: "hi" })).rejects.toThrow();
  });

  test("only the author can edit or delete their own message", async () => {
    const t = convexTest(schema, modules);
    const { userId: aliceId, as: asAlice } = await seedUser(t, "alice");
    const { as: asBob } = await seedUser(t, "bob");

    const { serverId, channelId } = await t.run(async (ctx) => {
      const serverId = await ctx.db.insert("servers", { name: "s", ownerId: aliceId, inviteCode: "code2" });
      const channelId = await ctx.db.insert("channels", {
        serverId,
        name: "general",
        type: "text",
        isDefault: true,
        createdAt: Date.now(),
      });
      await ctx.db.insert("serverMembers", { serverId, userId: aliceId, joinedAt: Date.now() });
      return { serverId, channelId };
    });
    // Bob needs membership too, since messages.send checks server membership.
    await t.run(async (ctx) => {
      const bob = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("displayName"), "bob"))
        .unique();
      await ctx.db.insert("serverMembers", { serverId, userId: bob!._id, joinedAt: Date.now() });
    });

    const messageId = await asAlice.mutation(api.messages.send, { channelId, content: "hello" });

    await expect(
      asBob.mutation(api.messages.edit, { messageId, content: "hacked" }),
    ).rejects.toThrow();
    await expect(asBob.mutation(api.messages.remove, { messageId })).rejects.toThrow();

    await asAlice.mutation(api.messages.edit, { messageId, content: "hello (edited)" });
    const page = await asAlice.query(api.messages.list, {
      channelId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page[0].content).toBe("hello (edited)");
    expect(page.page[0].editedAt).toBeDefined();
  });
});

describe("servers.removeMember", () => {
  test("only the owner can remove a member, and it ends their active call", async () => {
    const t = convexTest(schema, modules);
    const { userId: ownerId, as: asOwner } = await seedUser(t, "owner");
    const { userId: memberId, as: asMember } = await seedUser(t, "member");

    const { serverId, voiceChannelId } = await t.run(async (ctx) => {
      const serverId = await ctx.db.insert("servers", { name: "s", ownerId, inviteCode: "code3" });
      await ctx.db.insert("serverMembers", { serverId, userId: ownerId, joinedAt: Date.now() });
      await ctx.db.insert("serverMembers", { serverId, userId: memberId, joinedAt: Date.now() });
      const voiceChannelId = await ctx.db.insert("channels", {
        serverId,
        name: "voice",
        type: "voice",
        isDefault: false,
        createdAt: Date.now(),
      });
      return { serverId, voiceChannelId };
    });

    // A non-owner cannot remove anyone.
    await expect(
      asMember.mutation(api.servers.removeMember, { serverId, userId: ownerId }),
    ).rejects.toThrow();

    const { callId } = await asMember.mutation(api.calls.join, { channelId: voiceChannelId });

    await asOwner.mutation(api.servers.removeMember, { serverId, userId: memberId });

    const participants = await asOwner.query(api.calls.listParticipants, { callId });
    expect(participants.some((p) => p.userId === memberId)).toBe(false);
  });
});

describe("calls.join capacity", () => {
  test("rejects a 5th participant with CALL_FULL", async () => {
    const t = convexTest(schema, modules);
    const { userId: ownerId, as: asOwner } = await seedUser(t, "owner");

    const { serverId, voiceChannelId } = await t.run(async (ctx) => {
      const serverId = await ctx.db.insert("servers", { name: "s", ownerId, inviteCode: "code4" });
      await ctx.db.insert("serverMembers", { serverId, userId: ownerId, joinedAt: Date.now() });
      const voiceChannelId = await ctx.db.insert("channels", {
        serverId,
        name: "voice",
        type: "voice",
        isDefault: false,
        createdAt: Date.now(),
      });
      return { serverId, voiceChannelId };
    });

    const members = await Promise.all(
      ["p2", "p3", "p4", "p5"].map(async (name) => {
        const { userId, as } = await seedUser(t, name);
        await t.run(async (ctx) => {
          await ctx.db.insert("serverMembers", { serverId, userId, joinedAt: Date.now() });
        });
        return as;
      }),
    );

    await asOwner.mutation(api.calls.join, { channelId: voiceChannelId });
    for (const as of members.slice(0, 3)) {
      await as.mutation(api.calls.join, { channelId: voiceChannelId });
    }

    await expect(members[3].mutation(api.calls.join, { channelId: voiceChannelId })).rejects.toThrow(
      /full/i,
    );
  });
});
