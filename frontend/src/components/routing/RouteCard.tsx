import { Check } from "lucide-react";
import type { RouteResult } from "../../types/index.js";
import { Card, ProgressBar, ScoreRing } from "../ui.js";
import { formatDistance, formatDuration } from "../../utils/format.js";
import { ExpandableScore, RouteFactorsRow } from "./panels.js";

export interface RouteCardProps {
  route: RouteResult;
  rank: number;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}

export function RouteCard({ route, rank, selected, recommended, onSelect }: RouteCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 ${
        selected
          ? "border-link-blue bg-charcoal ring-1 ring-link-blue/30"
          : "border border-graphite hover:border-platinum"
      }`}
    >
      <article onClick={onSelect} aria-label={`Route ${rank} options`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                selected ? "bg-apple-blue text-white" : "bg-smoke text-silk"
              }`}
            >
              {rank}
            </span>
            <div>
              <p className="font-display text-base font-semibold leading-tight text-silk">
                {recommended ? "Recommended route" : "Alternative route"}
              </p>
              <p className="mt-0.5 text-xs text-ash">
                {route.provider === "osrm" ? "Live routing" : "OpenStreetMap walkways"} ·{" "}
                {formatDistance(route.distanceMeters)} · {formatDuration(route.durationMinutes)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {recommended && (
              <span className="rounded-full bg-apple-blue/15 px-2.5 py-0.5 text-[11px] font-semibold text-link-blue">
                Recommended
              </span>
            )}
            {selected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-apple-blue px-2.5 py-0.5 text-[11px] font-semibold text-white">
                <Check className="h-3 w-3" aria-hidden="true" />
                Selected
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <ScoreRing value={route.accessibilityScore} label="Score" size={72} />
          <div className="min-w-0 flex-1 space-y-2">
            <ProgressBar value={route.dataConfidence} label="Confidence" />
            <p className="text-xs leading-relaxed text-ash">
              Score: how usable the route is for your profile. Confidence: how well we know the
              route — not the same thing.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <RouteFactorsRow route={route} />
        </div>
      </article>

      <div onClick={(e) => e.stopPropagation()}>
        <ExpandableScore route={route} />
      </div>
    </Card>
  );
}