import type { Id } from "../../../convex/_generated/dataModel";
import VideoTile from "./VideoTile";

interface Participant {
  userId: Id<"users">;
  displayName: string;
  avatarUrl: string;
  micOn: boolean;
  cameraOn: boolean;
}

interface CallGridProps {
  participants: Participant[];
  currentUserId: Id<"users"> | undefined;
  localStream: MediaStream | null;
  remoteStreams: Map<Id<"users">, MediaStream>;
  speaking: Map<Id<"users"> | "local", boolean>;
}

export default function CallGrid({
  participants,
  currentUserId,
  localStream,
  remoteStreams,
  speaking,
}: CallGridProps) {
  return (
    <div data-testid="call-grid" className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 lg:grid-cols-2">
      {participants.map((participant) => {
        const isLocal = participant.userId === currentUserId;
        return (
          <VideoTile
            key={participant.userId}
            data-testid="video-tile"
            isLocal={isLocal}
            stream={isLocal ? localStream : remoteStreams.get(participant.userId)}
            displayName={participant.displayName}
            avatarUrl={participant.avatarUrl}
            micOn={participant.micOn}
            cameraOn={participant.cameraOn}
            isSpeaking={speaking.get(isLocal ? "local" : participant.userId) ?? false}
          />
        );
      })}
    </div>
  );
}
