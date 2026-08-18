import { Link } from "react-router-dom";
import { ArrowRight, BrainCircuit, Database, Lock, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui.js";

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-6xl">
        Accessibility intelligence for mapping.
      </h1>
      <p className="mt-6 text-xl leading-relaxed text-platinum">
        Most maps optimize for getting somewhere quickly. They don't optimize for whether you can
        actually use the route. AccessiPath adds an accessibility layer to mapping — starting with
        Toronto Metropolitan University.
      </p>

      <div className="mt-12 space-y-6">
        <section className="rounded-card bg-charcoal p-8">
          <h2 className="text-2xl font-semibold text-silk">Four evidence sources, one transparent score</h2>
          <ul className="mt-4 space-y-4">
            <li className="flex gap-4">
              <Database className="mt-1 h-5 w-5 shrink-0 text-link-blue" aria-hidden="true" />
              <div>
                <p className="font-medium text-silk">OpenStreetMap</p>
                <p className="text-sm text-ash">
                  Roads, paths, buildings, steps, elevators and wheelchair tags. Coverage is sparse —
                  treated as unknown where missing.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-link-blue" aria-hidden="true" />
              <div>
                <p className="font-medium text-silk">Institutional accessibility data</p>
                <p className="text-sm text-ash">
                  TMU's published accessible entrances, ramps and elevators — high-confidence and
                  traceable to a source URL.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span aria-hidden="true" className="text-link-blue">⛭</span>
              <div>
                <p className="font-medium text-silk">Community reports</p>
                <p className="text-sm text-ash">
                  Temporary conditions like blocked ramps and broken elevators, timestamped and
                  expiring. Shown alongside official data, never overwriting it.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <BrainCircuit className="mt-1 h-5 w-5 shrink-0 text-link-blue" aria-hidden="true" />
              <div>
                <p className="font-medium text-silk">AI observations</p>
                <p className="text-sm text-ash">
                  Vision analysis extracts visible features from photos. Predictions only — labeled
                  with confidence and never treated as fact.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="rounded-card bg-charcoal p-8">
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
        </section>

        <section className="rounded-card bg-charcoal p-8">
          <h2 className="text-2xl font-semibold text-silk">Why score and confidence are separate</h2>
          <p className="mt-4 text-sm leading-relaxed text-ash">
            A route can score well but be based on thin data. The <strong className="text-silk">accessibility
            score</strong> answers "how usable is this route?" while the{" "}
            <strong className="text-silk">data confidence</strong> answers "how well do we know the route?".
            Both are shown on every route card, and both are explainable item by item.
          </p>
        </section>
      </div>

      <div className="mt-12">
        <Link to="/map">
          <Button size="lg">
            Try it now — SLC to ENG
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </div>
  );
}