import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Info, ShieldCheck } from "lucide-react";
import type { ConfidenceBreakdown, EvidenceItem, RouteResult } from "../../types/index.js";
import { SourceBadge, StatusBadge, SeverityBadge } from "../ui.js";
import { formatDistance } from "../../utils/format.js";

function PenaltiesList({ route }: { route: RouteResult }) {
  if (route.penalties.length === 0) {
    return <p className="text-sm text-platinum">No penalties — nothing to avoid on this route.</p>;
  }
  return (
    <ul className="space-y-2">
      {route.penalties.map((p, i) => (
        <li key={i} className="flex items-start justify-between gap-4 text-sm">
          <div>
            <span
              className={
                p.severity === "critical"
                  ? "text-status-inaccessible"
                  : p.severity === "warning"
                    ? "text-status-warning"
                    : "text-platinum"
              }
            >
              {p.label}
            </span>
            {p.detail && <p className="text-xs text-ash">{p.detail}</p>}
          </div>
          <span className="shrink-0 font-semibold text-ash">-{p.points}</span>
        </li>
      ))}
    </ul>
  );
}

function BonusesList({ route }: { route: RouteResult }) {
  if (route.bonuses.length === 0) {
    return <p className="text-sm text-platinum">No bonuses found near this route.</p>;
  }
  return (
    <ul className="space-y-2">
      {route.bonuses.map((b, i) => (
        <li key={i} className="flex items-start justify-between gap-4 text-sm">
          <span className="text-status-accessible">{b.label}</span>
          <span className="shrink-0 font-semibold text-ash">+{b.points}</span>
        </li>
      ))}
    </ul>
  );
}

const BREAKDOWN_LABELS: Record<keyof ConfidenceBreakdown, { label: string; hint: string }> = {
  sourceQuality: { label: "Source quality", hint: "Weighted by institution / OSM / community / AI" },
  coverage: { label: "Data coverage", hint: "Share of the route with nearby accessibility data" },
  recency: { label: "Recency", hint: "How fresh community reports are" },
  verification: { label: "Verification", hint: "Confirmed by an institution or verified report" },
  agreement: { label: "Agreement", hint: "Multiple independent sources agree" },
};

export function ConfidencePanel({ route }: { route: RouteResult }) {
  return (
    <div className="space-y-4" aria-label="Data confidence breakdown">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-link-blue" aria-hidden="true" />
        <p className="text-sm text-platinum">
          Confidence measures how much we trust the <strong>evidence</strong>, separate from the
          score. Unknown sections reduce confidence but never mean "inaccessible".
        </p>
      </div>
      <ul className="space-y-3">
        {(
          Object.entries(BREAKDOWN_LABELS) as [
            keyof ConfidenceBreakdown,
            { label: string; hint: string },
          ][]
        ).map(([key, meta]) => {
          const value = Math.round(route.confidenceBreakdown[key] * 100);
          return (
            <li key={key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-silk">{meta.label}</span>
                <span className="text-ash">{value}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={meta.label}
                className="h-1.5 w-full overflow-hidden rounded-full bg-smoke"
              >
                <motion.div
                  className="h-full rounded-full bg-link-blue"
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ type: "spring", stiffness: 70, damping: 20 }}
                />
              </div>
              <p className="mt-1 text-xs text-ash">{meta.hint}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ash">
        Overall data confidence: <strong className="text-silk">{route.dataConfidence}/100</strong>.
      </p>
    </div>
  );
}

export function EvidencePanel({ route }: { route: RouteResult }) {
  if (route.evidence.length === 0) {
    return (
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-unknown" aria-hidden="true" />
        <p className="text-sm text-platinum">
          No accessibility features were found within 45 m of this route. Treat this route as
          preliminary — we need community data to improve it.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {route.evidence.map((item) => (
        <li key={item.id} className="rounded-card-sm border border-graphite p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              <SeverityBadge severity={item.severity} />
            </div>
            <SourceBadge source={item.sourceType} />
          </div>
          <p className="mt-2 text-sm font-medium text-silk">{item.label}</p>
          {item.description && <p className="mt-0.5 text-sm text-ash">{item.description}</p>}
          <p className="mt-1 text-xs text-ash">{formatDistance(item.distanceMeters)} from the route</p>
        </li>
      ))}
    </ul>
  );
}

function FactorChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-smoke px-3 py-1 text-xs text-platinum">
      <span className="font-semibold text-silk">{value}</span> {label}
    </span>
  );
}

export function RouteFactorsRow({ route }: { route: RouteResult }) {
  const f = route.factors;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Route factors">
      {f.stairs > 0 && <FactorChip label="stairs" value={f.stairs} />}
      {f.ramps > 0 && <FactorChip label="ramps" value={f.ramps} />}
      {f.elevators > 0 && <FactorChip label="elevators" value={f.elevators} />}
      {f.crossings > 0 && <FactorChip label="crossings" value={f.crossings} />}
      {f.obstacles > 0 && <FactorChip label="obstacles" value={f.obstacles} />}
      {f.unknownSections > 0 && <FactorChip label="unknown sections" value={f.unknownSections} />}
      {f.stairs === 0 && f.ramps === 0 && f.elevators === 0 && f.obstacles === 0 && (
        <span className="text-xs text-ash">No notable accessibility features mapped</span>
      )}
    </div>
  );
}

export function ExpandableScore({ route }: { route: RouteResult }) {
  const [open, setOpen] = useState<"score" | "evidence" | "confidence" | null>(null);
  const toggle = (key: "score" | "evidence" | "confidence") =>
    setOpen((current) => (current === key ? null : key));

  return (
    <div className="mt-4 border-t border-graphite pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => toggle("score")}
          aria-expanded={open === "score"}
          className="inline-flex items-center gap-1 rounded-pill bg-smoke px-4 py-2 text-sm text-silk hover:bg-graphite"
        >
          Why this score
          {open === "score" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button
          onClick={() => toggle("evidence")}
          aria-expanded={open === "evidence"}
          className="inline-flex items-center gap-1 rounded-pill bg-smoke px-4 py-2 text-sm text-silk hover:bg-graphite"
        >
          Evidence ({route.evidence.length})
          {open === "evidence" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button
          onClick={() => toggle("confidence")}
          aria-expanded={open === "confidence"}
          className="inline-flex items-center gap-1 rounded-pill bg-smoke px-4 py-2 text-sm text-silk hover:bg-graphite"
        >
          Confidence
          {open === "confidence" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open === "score" && (
        <div className="mt-4 space-y-4">
          <section aria-label="Penalties">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ash">Penalties</h4>
            <PenaltiesList route={route} />
          </section>
          <section aria-label="Bonuses">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ash">Bonuses</h4>
            <BonusesList route={route} />
          </section>
          <p className="text-xs text-ash">
            Score = 100 − penalties + bonuses, clamped to 0–100. Weights are transparent and
            configurable — not a medical guarantee.
          </p>
        </div>
      )}

      {open === "evidence" && (
        <div className="mt-4">
          <EvidencePanel route={route} />
        </div>
      )}

      {open === "confidence" && (
        <div className="mt-4">
          <ConfidencePanel route={route} />
        </div>
      )}
    </div>
  );
}