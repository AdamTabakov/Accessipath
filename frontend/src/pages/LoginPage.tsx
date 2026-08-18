import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, ShieldCheck } from "lucide-react";
import { Button, Card, TextField } from "../components/ui.js";
import { useAuth } from "../hooks/useAuth.js";
import { SpotlightCard } from "../components/ui-kit/SpotlightCard.js";

interface LoginLocationState {
  verified?: boolean;
  email?: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const [email, setEmail] = useState(state?.email ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/map");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        navigate("/verify", { state: { email } });
        return;
      }
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6 md:py-24">
      {state?.verified && (
        <div
          className="mb-4 flex items-center gap-3 rounded-card-sm border border-status-accessible/40 bg-status-accessible/10 px-4 py-3 text-sm text-status-accessible"
          role="status"
        >
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          Email verified. You can now sign in.
        </div>
      )}

      <SpotlightCard className="rounded-card bg-charcoal p-8" color="rgba(41,151,255,0.08)">
        <div className="mb-8 text-center">
          <p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-link-blue">
            <LogIn className="h-4 w-4" aria-hidden="true" /> Welcome back
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-silk">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-ash">
            Pick up your saved accessibility preferences where you left off.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={100}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p
              className="rounded-card-sm border border-status-inaccessible/40 bg-status-inaccessible/10 px-4 py-3 text-sm text-status-inaccessible"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button className="w-full" size="lg" type="submit" loading={submitting}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ash">
          New here?{" "}
          <Link to="/signup" className="font-medium text-link-blue hover:underline">
            Create an account
          </Link>
        </p>
      </SpotlightCard>
    </div>
  );
}