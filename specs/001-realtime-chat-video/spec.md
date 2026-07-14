# Feature Specification: Real-Time Chat & Video Community Platform

**Feature Branch**: `001-realtime-chat-video`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Build a real-time chat and video calling application modeled on Discord. Users & auth: Users sign up and log in. Each user has a display name and avatar. A user's online/offline status is visible to others. Servers: A logged-in user can create a server (a named community with an optional image). The creator becomes its owner. Users join servers via an invite link the owner can generate. A server lists its members and their online status in a sidebar. Owners can rename the server and remove members. Channels: Every server starts with a default \"general\" text channel. Members can see all channels; the owner can create, rename, and delete text channels and voice channels. Deleting a channel removes its messages. Messaging: Inside a text channel, members send text messages. Messages appear for all members in real time without refreshing. Each message shows author name, avatar, timestamp, and content. Authors can edit and delete their own messages; edits are marked. Messages load newest-first with infinite scroll for history. Typing indicators show when someone is composing. Direct messages: Any user can open a 1-on-1 DM conversation with another member of a shared server. DMs behave like channels (real time, edit, delete). Voice/video calls: A member can join a voice channel, which starts or joins a live call with the other members currently in that channel (support at least 2, target up to 4 participants). Participants can toggle their microphone and camera, see each other's video tiles, see who is speaking/muted, and leave the call. The channel list shows who is currently connected to each voice channel. 1-on-1 video calls can also be started from a DM. Out of scope for v1: message attachments/files, reactions, threads, roles/permissions beyond owner vs member, screen sharing, mobile apps, message search."

## Clarifications

### Session 2026-07-14

- Q: What scale should v1 target — concurrent users, number of servers, and typical server/channel size — since this shapes the realtime architecture and data model? → A: Small demo/classroom scale: ~10 concurrent users, a handful of servers, a few members each (portfolio/demo deployment, not production load).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account, Profile & Presence (Priority: P1)

A new visitor creates an account, sets a display name and avatar, logs in, and can see which of their contacts are currently online or offline. This is the identity foundation every other feature depends on.

**Why this priority**: Nothing else in the app (servers, messaging, calls) can function without an authenticated, identifiable user. It is also independently demonstrable and testable on its own.

**Independent Test**: Two people can each create an account, log in from separate sessions, and each see the other's status flip between online and offline as they log in/out — without any server or channel existing yet.

**Acceptance Scenarios**:

1. **Given** no existing account, **When** a visitor signs up with valid credentials, **Then** an account is created and the user is logged in.
2. **Given** a registered account, **When** the user logs in with correct credentials, **Then** they reach the authenticated application.
3. **Given** a registered account, **When** the user updates their display name or avatar, **Then** the change is visible to other users the next time they see that user.
4. **Given** two users who can see each other's status, **When** one of them logs out or closes their session, **Then** the other user sees their status change to offline within a few seconds, with no page refresh.
5. **Given** a logged-in user, **When** they choose to log out, **Then** their session ends and they must log in again to access the application.

---

### User Story 2 - Servers & Membership (Priority: P2)

A logged-in user creates a server, which they own. Other users join it using an invite link. The server sidebar lists all members with their online status. The owner can rename the server and remove members.

**Why this priority**: Servers are the organizing container for all community activity; they must exist before channels or messages can be tested end-to-end, and they deliver standalone value (a persistent group with a member roster).

**Independent Test**: A user creates a server, shares the invite link, a second user joins via that link, and both appear in the member sidebar with correct online status — independent of any channel or message content.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a server with a name (and optional image), **Then** the server exists and they are recorded as its owner.
2. **Given** an existing server, **When** the owner generates an invite link, **Then** any user who opens that link joins the server as a member.
3. **Given** a server with multiple members, **When** any member views the server, **Then** they see a sidebar listing every member and each member's online/offline status.
4. **Given** a server, **When** the owner renames it, **Then** all members see the updated name.
5. **Given** a server with a member, **When** the owner removes that member, **Then** the removed user immediately loses access to the server and its channels.

---

### User Story 3 - Channels & Real-Time Text Messaging (Priority: P3)

Within a server, members communicate in text channels. Every server starts with a "general" channel; the owner can add, rename, or delete additional text and voice channels. Members send messages that appear instantly for everyone, can be edited or deleted by their author, and can be scrolled back through.

**Why this priority**: This is the core value proposition of the product — real-time community text chat — and builds directly on Servers (US2).

**Independent Test**: In an existing server, a member sends a message in the "general" channel and a second member, already viewing that channel, sees it appear immediately without refreshing; the author then edits and deletes their own message and both actions are reflected live for the other member.

**Acceptance Scenarios**:

1. **Given** a newly created server, **When** it is created, **Then** it already contains one default text channel named "general".
2. **Given** a server, **When** the owner creates, renames, or deletes a text or voice channel, **Then** all members see the updated channel list.
3. **Given** a text channel, **When** the owner deletes it, **Then** its messages are permanently removed along with it.
4. **Given** a voice channel with an active call, **When** the owner deletes that channel, **Then** the call ends for all connected participants and they receive an indication that the channel was deleted.
5. **Given** a member viewing a text channel, **When** another member sends a message, **Then** it appears in the first member's view in real time, showing author name, avatar, timestamp, and content.
6. **Given** a message a member authored, **When** they edit it, **Then** the updated content is shown to all members with a visible "edited" indicator.
7. **Given** a message a member authored, **When** they delete it, **Then** it no longer appears for any member.
8. **Given** a member who did not author a message, **When** they attempt to edit or delete it, **Then** the action is not permitted.
9. **Given** a channel with more history than fits on screen, **When** a member scrolls up, **Then** older messages load progressively (infinite scroll), newest-first.
10. **Given** a member composing a message, **When** they are typing, **Then** other members currently viewing the channel see a typing indicator for that member.

---

### User Story 4 - Direct Messages (Priority: P4)

Any user can start a private 1-on-1 conversation with another user they share a server with, and that conversation behaves like a text channel: real-time delivery, editing, and deletion.

**Why this priority**: Extends the same real-time messaging capability (US3) to private conversations; valuable but not required for the core community-chat experience to work.

**Independent Test**: Two users who are members of a common server open a DM with each other, exchange messages in real time, and edit/delete their own messages, with behavior matching channel messaging.

**Acceptance Scenarios**:

1. **Given** two users who share at least one server, **When** one opens a DM with the other, **Then** a private 1-on-1 conversation is created (or the existing one is opened).
2. **Given** an open DM conversation, **When** either participant sends a message, **Then** it appears for the other participant in real time.
3. **Given** a DM message a user authored, **When** they edit or delete it, **Then** the same edit-marking and deletion behavior as channel messages applies.
4. **Given** two users who share no server, **When** one attempts to DM the other, **Then** the system does not allow the conversation to be started.

---

### User Story 5 - Voice & Video Calls (Priority: P5)

A member joins a voice channel to start or join a live call with whoever else is currently connected to that channel. Participants can toggle mic/camera, see video tiles and speaking/muted indicators, and leave at will. The channel list shows who is connected to each voice channel. A 1-on-1 video call can also be started directly from a DM.

**Why this priority**: Voice/video is the most complex and infrastructure-heavy capability; it depends on servers, channels, and DMs already existing, and is the natural final layer of the MVP.

**Independent Test**: Two members join the same voice channel, each sees the other's video tile and mute/speaking state, toggles their own mic/camera, and one leaves without disrupting the other's call; separately, two DM participants start a 1-on-1 video call directly from their conversation.

**Acceptance Scenarios**:

1. **Given** a voice channel with no active call, **When** a member joins it, **Then** a new call starts and the member is connected.
2. **Given** a voice channel with an active call, **When** another member joins the same channel, **Then** they join the same call as the existing participants.
3. **Given** an active call, **When** a participant toggles their microphone or camera, **Then** the change is reflected for all other participants.
4. **Given** an active call with multiple participants, **When** viewing the call, **Then** every participant sees a video tile for each other participant, and can tell who is currently speaking and who is muted.
5. **Given** an active call, **When** a participant leaves, **Then** the remaining participants' call continues uninterrupted.
6. **Given** a server's channel list, **When** viewing it, **Then** each voice channel shows which members are currently connected to it.
7. **Given** an open DM conversation, **When** a participant starts a video call from it, **Then** a 1-on-1 call is established between the two DM participants.
8. **Given** a voice channel already at its supported participant capacity, **When** another member attempts to join, **Then** they are informed the channel is full and are not connected to the call.
9. **Given** a voice channel call with exactly 4 participants connected, **When** any participant sends or receives audio/video or toggles their mic/camera, **Then** audio, video, and controls continue to function correctly for all four participants.

---

### Edge Cases

- What happens when a member is removed from a server while they are actively viewing one of its channels or connected to one of its voice calls? (Access and the live connection must be revoked promptly, not just on next page load.)
- What happens when the owner deletes a channel that a call is currently active in? (The active call must end gracefully for all connected participants.)
- What happens when someone tries to use a server's invite link while already a member of that server?
- What happens when a user's network drops mid-call? (Other participants should see them leave rather than freeze indefinitely.)
- What happens when the only participant in a voice channel leaves? (The call ends; the channel returns to an empty/no-call state.)
- What happens when a member scrolls back through message history and the channel is deleted mid-scroll?
- What happens when a user attempts to open a DM with themselves or with a user they no longer share any server with (e.g., after being removed)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a new visitor to create an account using an identifier (e.g., email) and password.
- **FR-002**: System MUST allow a registered user to log in and to log out.
- **FR-003**: Users MUST be able to set and update their own display name and avatar image.
- **FR-004**: System MUST show each user's online/offline status to other users, updated in real time as their connection state changes.
- **FR-005**: A logged-in user MUST be able to create a server, supplying a name and optionally an image; the creator becomes the server's owner.
- **FR-006**: The server owner MUST be able to generate an invite link; any user who opens a valid invite link joins that server as a member.
- **FR-007**: System MUST display, for each server, a sidebar listing all of its members and each member's current online/offline status.
- **FR-008**: The server owner MUST be able to rename the server, with the updated name reflected to all members.
- **FR-009**: The server owner MUST be able to remove a member from the server; a removed member immediately loses access to the server and all of its channels.
- **FR-010**: Every newly created server MUST automatically include one default text channel named "general".
- **FR-011**: All members of a server MUST be able to view the full list of the server's text and voice channels.
- **FR-012**: The server owner MUST be able to create, rename, and delete text channels and voice channels within their server.
- **FR-013**: Deleting a text channel MUST permanently remove all messages that belonged to it.
- **FR-014**: A server member MUST be able to send a text message in any text channel of that server.
- **FR-015**: New messages MUST appear to all members currently viewing the channel in real time, without requiring a manual page refresh.
- **FR-016**: Each displayed message MUST show its author's display name, avatar, timestamp, and text content.
- **FR-017**: A message's author MUST be able to edit or delete that message; no other member may edit or delete it.
- **FR-018**: An edited message MUST display a visible indicator that it has been edited.
- **FR-019**: Channel message history MUST display newest-first and support loading progressively older messages via infinite scroll.
- **FR-020**: System MUST show other members of a channel a typing indicator while a member is actively composing a message in that channel.
- **FR-021**: Any user MUST be able to start a 1-on-1 direct message conversation with another user with whom they share at least one server.
- **FR-022**: System MUST NOT allow a direct message conversation to be started between two users who share no server.
- **FR-023**: Direct messages MUST support the same real-time delivery, author-only editing, and author-only deletion behavior as channel messages (per FR-015, FR-017, FR-018).
- **FR-024**: A member MUST be able to join a voice channel, which starts a new call if none is active there, or joins the call already in progress.
- **FR-025**: A voice/video call MUST function correctly with at least 2 participants and MUST remain usable (audio, video, and controls all functioning) with up to 4 simultaneous participants.
- **FR-026**: Each call participant MUST be able to independently toggle their own microphone on/off and camera on/off.
- **FR-027**: Every call participant MUST see a video tile for each other connected participant, along with an indicator of who is currently speaking and who is muted.
- **FR-028**: A call participant MUST be able to leave the call at any time without disrupting the call for remaining participants.
- **FR-029**: The channel list MUST show, for each voice channel, which members are currently connected to it.
- **FR-030**: A user MUST be able to initiate a 1-on-1 video call directly from an open direct message conversation.
- **FR-031**: Deleting a voice channel that has an active call MUST end that call for all connected participants, with each participant informed that the channel was deleted.

*Explicitly out of scope for this feature (see Assumptions)*: message attachments/files, message reactions, threaded replies, any role/permission beyond owner vs. member, screen sharing, native mobile apps, and message search.

### Key Entities

- **User**: An individual account holder. Key attributes: display name, avatar, login credentials, current online/offline status.
- **Server**: A named community, optionally with an image, owned by exactly one User. Has many Members and Channels, and an invite link used to join it.
- **Membership**: The relationship of a User belonging to a Server, including their role (owner or member).
- **Channel**: A named communication space belonging to a Server, of type text or voice. Text channels contain Messages; voice channels host at most one active Call at a time and track currently connected members.
- **Message**: A piece of content authored by a User inside either a text Channel or a Direct Message Conversation. Attributes: content, timestamp, edited flag.
- **Direct Message Conversation**: A private 1-on-1 thread between two Users who share at least one Server, containing Messages with the same behavior as channel messages.
- **Call**: An active voice/video session tied to a voice Channel or to a Direct Message Conversation. Tracks connected participants and, per participant, microphone state, camera state, and speaking status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can create an account and reach the point of seeing at least one other online user in under 2 minutes.
- **SC-002**: A text message sent by one member is visible on another member's screen within 1 second under normal network conditions, with no manual refresh.
- **SC-003**: A user can create a server, generate an invite link, have a second user join, and exchange a message between them within 5 minutes, without external help.
- **SC-004**: A voice/video call remains fully usable (clear audio, functioning video tiles, working mute/camera toggles) with 4 simultaneous participants.
- **SC-005**: A member's online/offline status update is visible to other members within 5 seconds of the underlying connection change.
- **SC-006**: Members can scroll back through at least 200 historical messages in a channel without errors or noticeable slowdown.
- **SC-007**: Removing a member from a server revokes their access to that server's channels within 5 seconds of the removal action.
- **SC-008**: Joining a voice channel and being connected to its live call, with working audio, takes under 5 seconds from initiating the join.
- **SC-009**: The system performs correctly at a demo/classroom scale of at least 10 concurrent users spread across a handful of servers with a few members each, without degradation of real-time messaging, presence, or call quality.

## Assumptions

- Authentication is standard email/password; no third-party SSO, email verification step, or password-reset flow is assumed for v1 unless a future feature adds it.
- A server's invite link is reusable and does not expire; opening it lets any user join without owner approval (matching common community-chat conventions). The owner can regenerate it, which invalidates the previous link.
- Voice/video calls target a hard capacity of 4 simultaneous participants per channel for v1 (per FR-025); a member attempting to join a full voice channel is turned away rather than degrading quality for everyone.
- Presence is binary (online/offline) for v1; no "idle/away" intermediate state is included.
- Out of scope for v1, per the feature description: message attachments/files, message reactions, threaded replies, any role or permission beyond owner vs. member, screen sharing, native mobile apps, and message search.
- Server deletion and server-ownership transfer are not specified in this feature and are assumed out of scope for v1; an owner's departure/removal handling beyond what FR-009 covers is deferred to a future feature.
- A user may be a member of multiple servers, and each server maintains its own independent channel list and membership roster.
