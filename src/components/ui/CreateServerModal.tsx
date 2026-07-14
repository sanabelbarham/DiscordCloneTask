import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import Button from "./Button";
import Input from "./Input";
import Modal from "./Modal";

export default function CreateServerModal({ onClose }: { onClose: () => void }) {
  const createServer = useMutation(api.servers.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const serverId = await createServer({ name: name.trim(), imageUrl: imageUrl || undefined });
      onClose();
      navigate(`/servers/${serverId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="Create a server" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm text-text-muted">
          Server name
          <Input
            className="mt-1"
            placeholder="Server name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-text-muted">
          Image URL (optional)
          <Input
            className="mt-1"
            placeholder="Image URL (optional)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={creating} className="w-full">
          Create
        </Button>
      </form>
    </Modal>
  );
}
