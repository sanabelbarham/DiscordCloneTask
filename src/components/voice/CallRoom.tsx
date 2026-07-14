import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCallHeartbeat } from "../../lib/useCallHeartbeat";
import { useSpeakingDetection } from "../../lib/useSpeakingDetection";
import { useWebRTCCall } from "../../lib/useWebRTCCall";
import CallControls from "./CallControls";
import CallGrid from "./CallGrid";

interface CallRoomProps {
  channelId?: Id<"channels">;
  threadId?: Id<"directMessageThreads">;
  /** Only set for voice-channel calls — used to detect the channel being
   * deleted out from under an active call (FR-031). */
  serverId?: Id<"servers">;
  onExit: () => void;
}

export default function CallRoom({ channelId, threadId, serverId, onExit }: CallRoomProps) {
  const profile = useQuery(api.users.getCurrentProfile);
  const joinCall = useMutation(api.calls.join);
  const leaveCall = useMutation(api.calls.leave);
  const setMediaState = useMutation(api.calls.setMediaState);

  const [callId, setCallId] = useState<Id<"calls"> | null>(null);
  const [callFullError, setCallFullError] = useState(false);
  const [endedNotice, setEndedNotice] = useState<string | null>(null);
  const hasJoined = useRef(false);

  useEffect(() => {
    if (hasJoined.current) return;
    hasJoined.current = true;
    joinCall({ channelId, threadId })
      .then((result) => setCallId(result.callId))
      .catch((err) => {
        if (err instanceof ConvexError && (err.data as { code?: string })?.code === "CALL_FULL") {
          setCallFullError(true);
        } else {
          throw err;
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const participants = useQuery(api.calls.listParticipants, callId ? { callId } : "skip");
  const channels = useQuery(api.channels.list, serverId ? { serverId } : "skip");
  const { localStream, remoteStreams, toggleMic, toggleCamera } = useWebRTCCall(callId);
  useCallHeartbeat(callId);

  const wasParticipantRef = useRef(false);
  useEffect(() => {
    if (!profile || !participants) return;
    const amIIn = participants.some((p) => p.userId === profile._id);
    if (amIIn) wasParticipantRef.current = true;
    else if (wasParticipantRef.current && !endedNotice) {
      // FR-009 Edge Cases: removed from the server (or the call) mid-call.
      setEndedNotice("You were removed from this call.");
    }
  }, [profile, participants, endedNotice]);

  useEffect(() => {
    if (!serverId || !channelId || !channels || endedNotice) return;
    const stillExists = channels.some((c) => c._id === channelId);
    if (!stillExists) {
      // FR-031: the voice channel was deleted while the call was active.
      setEndedNotice("This voice channel was deleted.");
    }
  }, [serverId, channelId, channels, endedNotice]);

  useEffect(() => {
    if (endedNotice) {
      const timeout = setTimeout(onExit, 2500);
      return () => clearTimeout(timeout);
    }
  }, [endedNotice, onExit]);

  async function handleLeave() {
    if (callId) await leaveCall({ callId });
    onExit();
  }

  const speakingStreams = new Map<Id<"users"> | "local", MediaStream>();
  if (localStream) speakingStreams.set("local", localStream);
  for (const [userId, stream] of remoteStreams) speakingStreams.set(userId, stream);
  const speaking = useSpeakingDetection(speakingStreams);

  const me = participants?.find((p) => p.userId === profile?._id);

  if (callFullError) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted">
        This voice channel is full (max 4 participants).
      </div>
    );
  }

  if (endedNotice) {
    return <div className="flex flex-1 items-center justify-center text-text-muted">{endedNotice}</div>;
  }

  if (!callId || !participants) {
    return <div className="flex flex-1 items-center justify-center text-text-muted">Connecting…</div>;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CallGrid
        participants={participants}
        currentUserId={profile?._id}
        localStream={localStream}
        remoteStreams={remoteStreams}
        speaking={speaking}
      />
      <CallControls
        micOn={me?.micOn ?? true}
        cameraOn={me?.cameraOn ?? true}
        onToggleMic={() => {
          const next = !(me?.micOn ?? true);
          toggleMic(next);
          void setMediaState({ callId, micOn: next });
        }}
        onToggleCamera={() => {
          const next = !(me?.cameraOn ?? true);
          toggleCamera(next);
          void setMediaState({ callId, cameraOn: next });
        }}
        onLeave={() => void handleLeave()}
      />
    </div>
  );
}
