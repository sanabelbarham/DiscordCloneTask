import { useConvexAuth } from "convex/react";
import { Navigate, Outlet } from "react-router-dom";

/** Gates every authenticated route (research.md §1). Checks `isLoading` first
 * to avoid a flash-redirect before the auth token resolves. */
export default function RequireAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-text-muted">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <Outlet />;
}
