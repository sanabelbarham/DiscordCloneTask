import { useEffect, useRef } from "react";
import Avatar from "../ui/Avatar";

interface VideoTileProps {
  stream: MediaStream | null | undefined;
  displayName: string;
  avatarUrl: string;
  micOn: boolean;
  cameraOn: boolean;
  isSpeaking: boolean;
  isLocal?: boolean;
  "data-testid"?: string;
}

export default function VideoTile({
  stream,
  displayName,
  avatarUrl,
  micOn,
  cameraOn,
  isSpeaking,
  isLocal = false,
  "data-testid": testId,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream ?? null;
  }, [stream]);

  const showVideo = cameraOn && stream && stream.getVideoTracks().length > 0;

  return (
    <div
      data-testid={testId}
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-surface-rail ${
        isSpeaking ? "ring-2 ring-status-online" : ""
      }`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <Avatar avatarUrl={avatarUrl} displayName={displayName} size={72} />
      )}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {!micOn && <span title="Muted">🔇</span>}
        <span>{displayName}</span>
      </div>
    </div>
  );
}
