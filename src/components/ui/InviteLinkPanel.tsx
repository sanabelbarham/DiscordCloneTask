import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import Button from "./Button";

interface InviteLinkPanelProps {
  serverId: Id<"servers">;
  inviteCode: string;
}

export default function InviteLinkPanel({ serverId, inviteCode }: InviteLinkPanelProps) {
  const regenerateInvite = useMutation(api.servers.regenerateInvite);
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded bg-surface-rail p-2 text-sm">
      <input
        readOnly
        value={inviteUrl}
        className="flex-1 bg-transparent text-text-primary outline-none"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button type="button" variant="secondary" onClick={() => void copy()}>
        {copied ? "Copied!" : "Copy"}
      </Button>
      <Button type="button" variant="secondary" onClick={() => void regenerateInvite({ serverId })}>
        Regenerate
      </Button>
    </div>
  );
}
