import { Check } from "lucide-react";
import type { RouteResult } from "../../types/index.js";
import { Card, ScoreRing } from "../ui.js";
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
      className={`cursor-pointer transition-colors ${
        selected ? "border border-link-blue" : "border border-graphite hover:border-platinum"
      }`}
    >
      <article onClick={onSelect} aria-label={`Route ${rank} options`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                selected ? "bg-apple-blue text-white" : "bg-smoke text-silk"
              }`}
            >
              {rank}
            </span>
            <div>
              <p className="font-display text-lg font-semibold text-silk">
                {rank === 1 ? "Recommended route" : "Alternative route"}
              </p>
              <p className="text-xs text-ash">
                {route.provider === "osrm" ? "Live routing" : "OpenStreetMap walkways"} ·{" "}
                {formatDistance(route.distanceMeters)} · {formatDuration(route.durationMinutes)}
              </p>
            </div>
          </div>
          {selected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-apple-blue px-3 py-1 text-xs font-semibold text-white">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Selected
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-6">
          <ScoreRing value={route.accessibilityScore} label="Score" size={84} />
          <ScoreRing value={route.dataConfidence} label="Confidence" size={84} />
          <div className="hidden flex-1 sm:block">
            <p className="text-sm text-ash">
              Accessibility score reflects how usable the route is for your profile.
            </p>
            <p className="mt-1 text-sm text-ash">
              Data confidence reflects how well we know the route — not the same thing.
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