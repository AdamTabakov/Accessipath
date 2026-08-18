import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button, Card, TextField } from "../components/ui.js";
import { useAuth } from "../hooks/useAuth.js";
import { SpotlightCard } from "../components/ui-kit/SpotlightCard.js";

interface VerifyLocationState {
  email?: string;
  devCode?: string;
}

export function VerifyPage() {
  const { verify, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as VerifyLocationState | null;
  const [email, setEmail] = useState(state?.email ?? "");
  const [code, setCode] = useState(state?.devCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await verify({ email, code });
      setVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify your email.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Enter the email address you signed up with.");
      return;
    }
    setError(null);
    setMessage(null);
    setResending(true);
    try {
      await resendCode(email);
      setMessage("A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6 md:py-24">
        <SpotlightCard className="rounded-card bg-charcoal p-8" color="rgba(52,211,153,0.08)">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-status-accessible" aria-hidden="true" />
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-silk">
              Email verified
            </h1>
            <p className="mt-3 text-sm text-platinum">
              Your account is ready. Sign in to keep your accessibility preferences synced.
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={() => navigate("/login", { state: { verified: true, email } })}>
              Continue to sign in
            </Button>
          </div>
        </SpotlightCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6 md:py-24">
      <SpotlightCard className="rounded-card bg-charcoal p-8" color="rgba(41,151,255,0.08)">
        <div className="mb-8 text-center">
          <p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-link-blue">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> One last step
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-silk">
            Verify your email
          </h1>
          <p className="mt-2 text-sm text-ash">
            Enter the 6-digit code we sent you. Codes expire after a few minutes.
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
            label="Verification code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            hint="6 digits — no spaces."
          />

          {state?.devCode && (
            <p className="rounded-card-sm border border-link-blue/30 bg-link-blue/10 px-4 py-3 text-sm text-link-blue">
              Development mode: your code is{" "}
              <strong className="tracking-widest">{state.devCode}</strong>
            </p>
          )}

          {error && (
            <p
              className="rounded-card-sm border border-status-inaccessible/40 bg-status-inaccessible/10 px-4 py-3 text-sm text-status-inaccessible"
              role="alert"
            >
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-card-sm border border-status-accessible/40 bg-status-accessible/10 px-4 py-3 text-sm text-status-accessible" role="status">
              {message}
            </p>
          )}

          <Button className="w-full" size="lg" type="submit" loading={submitting}>
            Verify email
          </Button>
          <Button variant="ghost" className="w-full" size="md" onClick={handleResend} loading={resending}>
            Resend code
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ash">
          Changed your mind?{" "}
          <Link to="/login" className="font-medium text-link-blue hover:underline">
            Back to sign in
          </Link>
        </p>
      </SpotlightCard>
    </div>
  );
}