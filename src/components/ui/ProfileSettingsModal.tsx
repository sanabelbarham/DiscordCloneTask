import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import Button from "./Button";
import Input from "./Input";
import Modal from "./Modal";

interface ProfileSettingsModalProps {
  onClose: () => void;
}

export default function ProfileSettingsModal({ onClose }: ProfileSettingsModalProps) {
  const profile = useQuery(api.users.getCurrentProfile);
  const updateProfile = useMutation(api.users.updateProfile);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ displayName, avatarUrl });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <Modal title="Profile settings" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-text-muted">
          Display name
          <Input
            className="mt-1"
            value={displayName || profile.displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="block text-sm text-text-muted">
          Avatar URL
          <Input
            className="mt-1"
            value={avatarUrl || profile.avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={saving} className="w-full">
          Save
        </Button>
      </form>
    </Modal>
  );
}
