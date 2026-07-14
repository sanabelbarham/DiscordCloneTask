import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";

export default function JoinInvitePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const joinByInvite = useMutation(api.servers.joinByInvite);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!inviteCode || attempted.current) return;
    attempted.current = true;
    joinByInvite({ inviteCode })
      .then((serverId) => navigate(`/servers/${serverId}`, { replace: true }))
      .catch(() => setError("This invite link is invalid or has expired."));
  }, [inviteCode, joinByInvite, navigate]);

  return (
    <div className="flex flex-1 items-center justify-center text-text-muted">
      {error ?? "Joining server…"}
    </div>
  );
}
