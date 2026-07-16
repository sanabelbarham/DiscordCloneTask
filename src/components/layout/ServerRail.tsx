import { useQuery } from "convex/react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import CreateServerModal from "../ui/CreateServerModal";

interface ServerRailProps {
  onOpenProfile: () => void;
  onSignOut: () => void;
}

export default function ServerRail({ onOpenProfile, onSignOut }: ServerRailProps) {
  const servers = useQuery(api.servers.listForUser);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <nav className="flex w-rail flex-col items-center gap-2 bg-surface-rail py-3">
      <NavLink
        to="/friends"
        title="Friends"
        className={({ isActive }) =>
          `flex h-12 w-12 items-center justify-center rounded-3xl bg-surface-modifier text-sm font-semibold text-text-primary transition-all hover:rounded-2xl hover:bg-brand ${
            isActive ? "rounded-2xl bg-brand" : ""
          }`
        }
      >
        👥
      </NavLink>
      <div className="h-px w-8 bg-surface-modifier" />
      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {servers?.map((server) => (
          <NavLink
            key={server._id}
            to={`/servers/${server._id}`}
            title={server.name}
            className={({ isActive }) =>
              `flex h-12 w-12 items-center justify-center rounded-3xl bg-surface-modifier text-sm font-semibold text-text-primary transition-all hover:rounded-2xl hover:bg-brand ${
                isActive ? "rounded-2xl bg-brand" : ""
              }`
            }
          >
            {server.imageUrl ? (
              <img src={server.imageUrl} alt={server.name} className="h-full w-full rounded-[inherit] object-cover" />
            ) : (
              server.name.slice(0, 2).toUpperCase()
            )}
          </NavLink>
        ))}
        <button
          title="Create a server"
          onClick={() => setShowCreate(true)}
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-surface-modifier text-status-online transition-all hover:rounded-2xl hover:bg-status-online hover:text-white"
        >
          +
        </button>
      </div>
      <div className="flex flex-col items-center gap-2">
        <button
          title="Profile settings"
          onClick={onOpenProfile}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-modifier text-xs text-text-primary hover:bg-brand"
        >
          ⚙
        </button>
        <button
          title="Sign out"
          onClick={onSignOut}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-modifier text-xs text-text-primary hover:bg-status-danger"
        >
          ⏻
        </button>
      </div>
      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} />}
    </nav>
  );
}
