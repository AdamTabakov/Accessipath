import { Link } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "../components/ui.js";

const FEATURES = [
  {
    icon: <Route className="h-6 w-6" aria-hidden="true" />,
    title: "Routes ranked by usability",
    body: "Not just distance. AccessiPath scores candidate routes for stairs, slopes, surface, barriers and accessible features — and shows you exactly why one route beat another.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6" aria-hidden="true" />,
    title: "Separate score and confidence",
    body: "A high score with low confidence is very different from a high score with high confidence. We keep accessibility quality and data confidence independent and transparent.",
  },
  {
    icon: <Database className="h-6 w-6" aria-hidden="true" />,
    title: "Multi-source evidence",
    body: "Institutional accessibility data, OpenStreetMap, community reports and AI observations are combined — and never merged into a single unverifiable blob.",
  },
  {
    icon: <Users className="h-6 w-6" aria-hidden="true" />,
    title: "Community reporting",
    body: "A broken elevator or blocked ramp shouldn't wait for a data update. Report what you see, and routes in the area are re-evaluated immediately.",
  },
  {
    icon: <BrainCircuit className="h-6 w-6" aria-hidden="true" />,
    title: "AI that respects privacy",
    body: "Our vision analysis runs entirely on your device. Your photos are never uploaded — the model detects stairs, ramps, elevators and obstacles locally.",
  },
  {
    icon: <CheckCircle2 className="h-6 w-6" aria-hidden="true" />,
    title: "Unknown ≠ inaccessible",
    body: "Missing data is treated as unknown, never as proof of accessibility. Confidence drops, and you're told exactly which sections need verification.",
  },
];

const STEPS = [
  { n: "01", title: "Pick your profile", body: "Wheelchair, walker, cane, or your own preferences." },
  { n: "02", title: "Choose start & destination", body: "Search TMU buildings or any address." },
  { n: "03", title: "Compare routes", body: "Fastest, balanced, or most accessible — with scores." },
  { n: "04", title: "Understand why", body: "Penalties, bonuses, evidence and confidence, item by item." },
  { n: "05", title: "Contribute", body: "Report a blocked ramp. AI reads your photo on-device." },
];

export function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-true-black">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-32">
          <p className="mb-6 text-base text-silk/80">Accessibility-first navigation</p>
          <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-silk sm:text-6xl md:text-8xl">
            A short route is not always a usable route.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-platinum md:text-xl">
            AccessiPath finds routes that actually work for people with mobility needs — avoiding
            stairs, steep slopes, rough surfaces and broken elevators, and telling you exactly
            why each route was recommended.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/map">
              <Button size="lg">
                Plan an accessible route
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="ghost" size="lg">
                How it works
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-ash">
            Demo area: Toronto Metropolitan University. Try SLC → ENG.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-graphite bg-true-black">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-6xl">
            Built around one question:
            <br />
            <span className="text-link-blue">can you actually use this route?</span>
          </h2>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-card bg-charcoal p-8">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-smoke text-link-blue">
                  {f.icon}
                </div>
                <h3 className="mt-6 text-2xl font-semibold text-silk">{f.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-ash">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-graphite bg-true-black">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-6xl">
            From search to explanation in five steps.
          </h2>
          <ol className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-card bg-charcoal p-6">
                <span className="font-display text-sm font-semibold text-link-blue">{s.n}</span>
                <h3 className="mt-3 text-xl font-semibold text-silk">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ash">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Data honesty */}
      <section className="border-t border-graphite bg-true-black">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-5xl">
                We never pretend the data is complete.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-platinum">
                OpenStreetMap accessibility coverage is sparse. So we treat three states as
                fundamentally different:
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-card bg-charcoal p-6">
                <p className="flex items-center gap-2 font-semibold text-status-accessible">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Accessible
                </p>
                <p className="mt-1 text-sm text-ash">Known from a trusted, current source.</p>
              </div>
              <div className="rounded-card bg-charcoal p-6">
                <p className="flex items-center gap-2 font-semibold text-status-inaccessible">
                  <span aria-hidden="true">✕</span> Inaccessible
                </p>
                <p className="mt-1 text-sm text-ash">Stairs, barriers, blocks — known to be a problem.</p>
              </div>
              <div className="rounded-card bg-charcoal p-6">
                <p className="flex items-center gap-2 font-semibold text-status-unknown">
                  <span aria-hidden="true">?</span> Unknown
                </p>
                <p className="mt-1 text-sm text-ash">
                  No data. This lowers our confidence — it is not the same as inaccessible.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-graphite bg-true-black">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="rounded-card bg-apple-blue p-10 text-center md:p-16">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Plan your most usable route.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">
              Wheelchair profile with stairs, ramps and elevators already configured — no signup, no
              tracking, no data sold.
            </p>
            <Link to="/map">
              <Button
                size="lg"
                className="mt-8 bg-white text-apple-blue hover:bg-silk"
              >
                Get directions
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}