import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";
import { Button, Card, TextField } from "../components/ui.js";
import { useAuth } from "../hooks/useAuth.js";
import { SpotlightCard } from "../components/ui-kit/SpotlightCard.js";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await signup({ email, name, password });
      navigate("/verify", {
        state: { email: res.user.email, devCode: res.devCode },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6 md:py-24">
      <SpotlightCard className="rounded-card bg-charcoal p-8" color="rgba(41,151,255,0.08)">
        <div className="mb-8 text-center">
          <p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-link-blue">
            <Mail className="h-4 w-4" aria-hidden="true" /> Email-only sign up
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-silk">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ash">
            Save your accessibility preferences to your profile. No tracking, no data sold.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <TextField
            label="Name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Morgan"
          />
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
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={100}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters."
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
            Sign up
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ash">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-link-blue hover:underline">
            Sign in
          </Link>
        </p>
      </SpotlightCard>

      <Card className="mt-6 bg-charcoal/60 p-4 text-center text-xs leading-relaxed text-ash">
        Your preferences stay private. Accounts exist so your accessibility profile follows you —
        not to collect or sell your data.
      </Card>
    </div>
  );
}