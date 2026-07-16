import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ProfileSettingsModal from "./components/ui/ProfileSettingsModal";
import ServerRail from "./components/layout/ServerRail";
import DirectMessagePage from "./routes/DirectMessagePage";
import DmCallPage from "./routes/DmCallPage";
import ChannelPage from "./routes/ChannelPage";
import FriendsPage from "./routes/FriendsPage";
import JoinInvitePage from "./routes/JoinInvitePage";
import RequireAuth from "./routes/RequireAuth";
import ServerLayout from "./routes/ServerLayout";
import SignInPage from "./routes/SignInPage";
import SignUpPage from "./routes/SignUpPage";
import VoiceChannelPage from "./routes/VoiceChannelPage";
import IncomingCallBanner from "./components/voice/IncomingCallBanner";
import { useHeartbeat } from "./lib/usePresence";

function HomePage() {
  return (
    <div className="flex h-full flex-1 items-center justify-center text-text-muted">
      Select or create a server to get started.
    </div>
  );
}

/** Mounted once for every authenticated route: keeps presence alive, hosts the
 * persistent server rail + sign-out/profile settings (T019, T021). */
function AuthedShell() {
  useHeartbeat();
  const { signOut } = useAuthActions();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-surface-main">
      <IncomingCallBanner />
      <ServerRail onOpenProfile={() => setShowProfile(true)} onSignOut={() => void signOut()} />
      <div className="flex flex-1 overflow-hidden">
        <Outlet />
      </div>
      {showProfile && <ProfileSettingsModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AuthedShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/invite/:inviteCode" element={<JoinInvitePage />} />
          <Route path="/servers/:serverId" element={<ServerLayout />}>
            <Route path="channels/:channelId" element={<ChannelPage />} />
            <Route path="voice/:channelId" element={<VoiceChannelPage />} />
          </Route>
          <Route path="/dm/:threadId" element={<DirectMessagePage />} />
          <Route path="/dm/:threadId/call" element={<DmCallPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
