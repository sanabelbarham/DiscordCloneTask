import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect off the reactive auth flag rather than right after `signIn()`
  // resolves: the Convex auth context can take a render past that point to
  // flip to authenticated, and navigating a beat too early lands on "/" while
  // RequireAuth still sees isAuthenticated=false and bounces back here for
  // good (this page never re-checks auth state on its own).
  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", "signIn");
    try {
      await signIn("password", formData);
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-surface-rail">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-md bg-surface-sidebar p-8"
      >
        <h1 className="text-xl font-semibold text-text-primary">Welcome back</h1>
        {error && <p className="text-sm text-status-danger">{error}</p>}
        <Input name="email" type="email" placeholder="Email" autoComplete="email" required />
        <Input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={submitting} className="w-full">
          Sign in
        </Button>
        <p className="text-sm text-text-muted">
          Need an account?{" "}
          <Link to="/signup" className="text-text-link">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
