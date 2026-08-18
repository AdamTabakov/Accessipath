import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  Info,
  Route,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import { MapBackground } from "../components/background/MapBackground.js";
import { FloatingNav } from "../components/ui/floating-navbar.js";
import { InfiniteMovingCards } from "../components/ui/infinite-moving-cards.js";
import { ContainerScroll } from "../components/ui/container-scroll-animation.js";
import {
  AnimatedGradientText,
  Aurora,
  MagneticLink,
  ShimmerLink,
  ShinyText,
  SpotlightCard,
  TextGenerateEffect,
  TextReveal,
  TiltedCard,
} from "../components/ui-kit/index.js";
import { cn } from "../utils/cn.js";

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

const PRINCIPLES = FEATURES.map((f) => ({
  quote: f.body,
  name: f.title,
  title: "AccessiPath principle",
}));

const STEPS = [
  { n: "01", title: "Pick your profile", body: "Wheelchair, walker, cane, or your own preferences." },
  { n: "02", title: "Choose start & destination", body: "Search any address across Toronto." },
  { n: "03", title: "Compare routes", body: "Fastest, balanced, or most accessible — with scores." },
  { n: "04", title: "Understand why", body: "Penalties, bonuses, evidence and confidence, item by item." },
  { n: "05", title: "Contribute", body: "Report a blocked ramp. AI reads your photo on-device." },
];

const COMPARISON = [
  {
    name: "Route A — fastest",
    distance: "600 m",
    stairs: "2 flights of stairs",
    slope: "Steep slope",
    surface: "Paving stones",
    score: 52,
    tone: "text-status-inaccessible",
    bar: "bg-status-inaccessible",
    recommended: false,
  },
  {
    name: "Route B — recommended",
    distance: "850 m",
    stairs: "No stairs",
    slope: "Gentle slope",
    surface: "Smooth concrete",
    score: 88,
    tone: "text-status-accessible",
    bar: "bg-status-accessible",
    recommended: true,
  },
];

function RouteCompareMock() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-4 rounded-2xl bg-true-black p-4 md:p-8">
      {COMPARISON.map((r) => (
        <div
          key={r.name}
          className={cn(
            "rounded-card bg-charcoal p-5 md:p-6",
            r.recommended && "border border-apple-blue/40"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-silk">{r.name}</p>
            {r.recommended && (
              <span className="rounded-full bg-apple-blue/20 px-3 py-1 text-xs font-medium text-link-blue">
                Recommended
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ash">
            <span>{r.distance}</span>
            <span>{r.stairs}</span>
            <span>{r.slope}</span>
            <span>{r.surface}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className={cn("font-display text-3xl font-semibold", r.tone)}>{r.score}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-smoke">
              <div className={cn("h-full rounded-full", r.bar)} style={{ width: `${r.score}%` }} />
            </div>
          </div>
        </div>
      ))}
      <p className="text-center text-sm text-ash">
        Longer distance, far better score — usability beats distance.
      </p>
    </div>
  );
}

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <FloatingNav
        navItems={[
          { name: "Plan a route", link: "/map", icon: <Route className="h-4 w-4" aria-hidden="true" /> },
          { name: "Report an issue", link: "/report", icon: <TriangleAlert className="h-4 w-4" aria-hidden="true" /> },
          { name: "About", link: "/about", icon: <Info className="h-4 w-4" aria-hidden="true" /> },
        ]}
        ctaLabel="Get started"
        ctaTo="/map"
        className="top-6"
      />

      {/* Hero — map-themed animated background */}
      <section className="relative overflow-hidden bg-true-black">
        <MapBackground opacity="opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-true-black/30 to-true-black" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-40">
          <p className="mb-6 text-base tracking-tight text-silk/80">
            <ShinyText>Accessibility-first navigation</ShinyText>
          </p>
          <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight text-silk sm:text-6xl md:text-8xl">
            <TextGenerateEffect words="A short route is not always a usable route." />
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-platinum md:text-xl">
            AccessiPath finds routes that actually work for people with mobility needs — avoiding
            stairs, steep slopes, rough surfaces and broken elevators, and telling you exactly why
            each route was recommended.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <ShimmerLink to="/map" className="px-8 py-4 text-lg">
                Plan an accessible route
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </ShimmerLink>
            <MagneticLink to="/about" className="rounded-pill bg-transparent px-8 py-4 text-lg font-medium text-silk transition hover:bg-charcoal">
                How it works
              </MagneticLink>
          </div>
          <p className="mt-6 text-sm text-ash">
            Coverage area: Toronto. Try TMU → Union Station.
          </p>
        </div>
      </section>

      {/* Principles — infinite moving cards */}
      <section className="relative overflow-hidden border-t border-graphite bg-true-black">
        <Aurora className="opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 pt-20 sm:px-6 md:pt-28">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-6xl">
            <TextReveal text="Built around one question:" />
            <br />
            <AnimatedGradientText>can you actually use this route?</AnimatedGradientText>
          </h2>
          <p className="mt-6 max-w-2xl text-lg text-platinum">
            The principles that guide every route we recommend.
          </p>
        </div>
        <InfiniteMovingCards items={PRINCIPLES} direction="left" speed="slow" pauseOnHover />
      </section>

      {/* Route comparison — container scroll animation */}
      <section className="overflow-hidden border-t border-graphite bg-true-black">
        <ContainerScroll
          titleComponent={
            <div className="px-4">
              <h2 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-6xl">
                <TextReveal text="Two routes. One destination." />
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-platinum">
                The shorter route hides two flights of stairs. Scroll — and see why the longer,
                smoother route wins.
              </p>
            </div>
          }
        >
          <RouteCompareMock />
        </ContainerScroll>
      </section>

      {/* How it works */}
      <section className="border-t border-graphite bg-true-black">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <h2 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-6xl">
            <TextReveal text="From search to explanation in five steps." />
          </h2>
          <ol className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n}>
                <TiltedCard className="h-full rounded-card bg-charcoal p-6">
                  <span className="font-display text-sm font-semibold text-link-blue">{s.n}</span>
                  <h3 className="mt-3 text-xl font-semibold text-silk">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ash">{s.body}</p>
                </TiltedCard>
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
                <TextReveal text="We never pretend the data is complete." />
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-platinum">
                OpenStreetMap accessibility coverage is sparse. So we treat three states as
                fundamentally different:
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <SpotlightCard className="rounded-card bg-charcoal p-6">
                <p className="flex items-center gap-2 font-semibold text-status-accessible">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Accessible
                </p>
                <p className="mt-1 text-sm text-ash">Known from a trusted, current source.</p>
              </SpotlightCard>
              <SpotlightCard className="rounded-card bg-charcoal p-6">
                <p className="flex items-center gap-2 font-semibold text-status-inaccessible">
                  <span aria-hidden="true">✕</span> Inaccessible
                </p>
                <p className="mt-1 text-sm text-ash">
                  Stairs, barriers, blocks — known to be a problem.
                </p>
              </SpotlightCard>
              <SpotlightCard className="rounded-card bg-charcoal p-6">
                <p className="flex items-center gap-2 font-semibold text-status-unknown">
                  <span aria-hidden="true">?</span> Unknown
                </p>
                <p className="mt-1 text-sm text-ash">
                  No data. This lowers our confidence — it is not the same as inaccessible.
                </p>
              </SpotlightCard>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-graphite bg-true-black">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
          <div className="relative overflow-hidden rounded-card bg-apple-blue p-10 text-center md:p-16">
            <Aurora
              className="opacity-30"
              blobs={[
                { x: "0%", y: "0%", size: "60vmax", color: "rgba(255,255,255,0.18)" },
                { x: "60%", y: "20%", size: "50vmax", color: "rgba(0,0,0,0.25)" },
              ]}
            />
            <div className="relative">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white md:text-5xl">
                <TextReveal as="span" text="Plan your most usable route." />
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/85">
                Wheelchair profile with stairs, ramps and elevators already configured — no tracking,
                no data sold.
              </p>
              <ShimmerLink to="/map" className="mt-8 bg-white px-8 py-4 text-lg text-apple-blue hover:bg-silk">
                Get directions
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </ShimmerLink>
            </div>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}