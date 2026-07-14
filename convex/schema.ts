import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// See specs/001-realtime-chat-video/data-model.md for the full design rationale
// behind every table and index below.
export default defineSchema({
  ...authTables,

  // Extends Convex Auth's built-in `users` table (email/name/image/etc. already
  // defined by authTables.users) with the app-specific display fields the spec
  // requires, rather than a separate `profiles` table (data-model.md §users).
  users: defineTable({
    ...authTables.users.validator.fields,
    displayName: v.string(),
    avatarUrl: v.string(),
  }).index("email", ["email"]),

  presence: defineTable({
    userId: v.id("users"),
    lastSeen: v.number(),
  }).index("by_userId", ["userId"]),

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  })
    .index("by_inviteCode", ["inviteCode"])
    .index("by_ownerId", ["ownerId"]),

  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
    isDefault: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_server_and_type", ["serverId", "type"]),

  // Channel messages (channelId set) and direct messages (threadId set) share one
  // table — see data-model.md §messages for why this replaced two near-duplicate tables.
  messages: defineTable({
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
    authorId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_channel", ["channelId", "createdAt"])
    .index("by_thread", ["threadId", "createdAt"]),

  directMessageThreads: defineTable({
    participantA: v.id("users"),
    participantB: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_pair", ["participantA", "participantB"])
    .index("by_participantA", ["participantA"])
    .index("by_participantB", ["participantB"]),

  typingIndicators: defineTable({
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
    userId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_thread", ["threadId"]),

  calls: defineTable({
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
    startedAt: v.number(),
  })
    .index("by_channel", ["channelId"])
    .index("by_thread", ["threadId"]),

  callParticipants: defineTable({
    callId: v.id("calls"),
    userId: v.id("users"),
    micOn: v.boolean(),
    cameraOn: v.boolean(),
    lastHeartbeatAt: v.number(),
    joinedAt: v.number(),
  })
    .index("by_call", ["callId"])
    .index("by_call_and_user", ["callId", "userId"])
    .index("by_user", ["userId"]),

  signals: defineTable({
    callId: v.id("calls"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_recipient", ["callId", "toUserId"]),
});
