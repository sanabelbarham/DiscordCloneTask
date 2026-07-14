import Button from "../ui/Button";

interface CallControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}

export default function CallControls({
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: CallControlsProps) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-black/20 p-4">
      <Button variant={micOn ? "secondary" : "danger"} onClick={onToggleMic}>
        {micOn ? "Mute" : "Unmute"}
      </Button>
      <Button variant={cameraOn ? "secondary" : "danger"} onClick={onToggleCamera}>
        {cameraOn ? "Stop Video" : "Start Video"}
      </Button>
      <Button variant="danger" onClick={onLeave}>
        Leave
      </Button>
    </div>
  );
}
