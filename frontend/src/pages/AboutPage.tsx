import { ArrowRight, BrainCircuit, Database, Lock, MapPin, ShieldCheck } from "lucide-react";
import { MapBackground } from "../components/background/MapBackground.js";
import {
  AnimatedTooltip,
  OrbitingCircles,
  ShimmerLink,
  SpotlightCard,
  TextGenerateEffect,
  TextReveal,
  TiltedCard,
} from "../components/ui-kit/index.js";

const SOURCES = [
  {
    icon: <Database className="h-5 w-5" aria-hidden="true" />,
    title: "OpenStreetMap",
    body: "Roads, paths, buildings, steps, elevators and wheelchair tags. Coverage is sparse — treated as unknown where missing.",
    ring: 2 as const,
  },
  {
    icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    title: "Institutional accessibility data",
    body: "Published accessibility data from institutions — accessible entrances, ramps and elevators — high-confidence and traceable to a source URL.",
    ring: 1 as const,
  },
  {
    icon: <MapPin className="h-5 w-5" aria-hidden="true" />,
    title: "Community reports",
    body: "Temporary conditions like blocked ramps and broken elevators, timestamped and expiring. Shown alongside official data, never overwriting it.",
    ring: 0 as const,
  },
  {
    icon: <BrainCircuit className="h-5 w-5" aria-hidden="true" />,
    title: "AI observations",
    body: "Vision analysis extracts visible features from photos. Predictions only — labeled with confidence and never treated as fact.",
    ring: 2 as const,
  },
];

export function AboutPage() {
  return (
    <div>
      <section className="relative overflow-hidden bg-true-black">
        <MapBackground opacity="opacity-40" animated />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-true-black" />
        <div className="relative mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-6xl">
            <TextGenerateEffect words="Accessibility intelligence for mapping." />
          </h1>
          <p className="mt-6 text-xl leading-relaxed text-platinum">
            Most maps optimize for getting somewhere quickly. They don't optimize for whether you can
            actually use the route. AccessiPath adds an accessibility layer to mapping — across Toronto.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <SpotlightCard className="rounded-card bg-charcoal p-8">
            <h2 className="text-2xl font-semibold text-silk">
              <TextReveal text="Four evidence sources, one transparent score" />
            </h2>
            <ul className="mt-6 space-y-5">
              {SOURCES.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <AnimatedTooltip label={s.title} side="top">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-smoke text-link-blue">
                      {s.icon}
                    </span>
                  </AnimatedTooltip>
                  <div>
                    <p className="font-medium text-silk">{s.title}</p>
                    <p className="text-sm text-ash">{s.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SpotlightCard>

          <div className="hidden lg:block" aria-hidden="true">
            <OrbitingCircles
              items={SOURCES.map((s) => ({
                node: (
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-graphite bg-charcoal text-link-blue shadow-lg shadow-black/40">
                    {s.icon}
                  </span>
                ),
                ring: s.ring,
              }))}
              center={
                <span className="grid h-16 w-16 place-items-center rounded-full bg-apple-blue text-white shadow-lg shadow-black/40">
                  <MapPin className="h-7 w-7" aria-hidden="true" />
                </span>
              }
            />
          </div>
        </section>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <TiltedCard className="h-full rounded-card bg-charcoal p-8">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-silk">
              <Lock className="h-5 w-5 text-link-blue" aria-hidden="true" />
              Privacy-first AI
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ash">
              Accessibility photos are analyzed entirely on your device using on-device machine
              learning (transformers.js). The image never leaves your browser. Only the structured
              observation — the detected feature and confidence — is attached to a report if you
              choose to submit one. We don't store location history, we don't sell data, and we
              minimize everything we keep.
            </p>
          </TiltedCard>

          <TiltedCard className="h-full rounded-card bg-charcoal p-8">
            <h2 className="text-2xl font-semibold text-silk">Why score and confidence are separate</h2>
            <p className="mt-4 text-sm leading-relaxed text-ash">
              A route can score well but be based on thin data. The{" "}
              <strong className="text-silk">accessibility score</strong> answers "how usable is this
              route?" while the <strong className="text-silk">data confidence</strong> answers "how
              well do we know the route?". Both are shown on every route card, and both are
              explainable item by item.
            </p>
          </TiltedCard>
        </div>

        <div className="mt-12">
          <ShimmerLink to="/map" className="px-8 py-4 text-lg">
            Open route planner
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </ShimmerLink>
        </div>
      </div>
    </div>
  );
}
