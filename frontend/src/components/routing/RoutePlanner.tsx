import { ArrowDownUp, Crosshair, LocateFixed } from "lucide-react";
import type { Place } from "../../types/index.js";
import { Button } from "../ui.js";
import { SearchInput } from "./SearchInput.js";

export interface RoutePlannerProps {
  start: Place | null;
  end: Place | null;
  onStartChange: (place: Place | null) => void;
  onEndChange: (place: Place | null) => void;
  onSwap: () => void;
  onUseMyLocation: () => void;
  locating: boolean;
}

export function RoutePlanner({
  start,
  end,
  onStartChange,
  onEndChange,
  onSwap,
  onUseMyLocation,
  locating,
}: RoutePlannerProps) {
  return (
    <section aria-label="Route planner" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-7">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-apple-blue text-sm font-bold text-white">
            A
          </span>
          <span className="h-4 w-px bg-graphite" />
          <span className="grid h-7 w-7 place-items-center rounded-full bg-link-blue text-sm font-bold text-white">
            B
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <SearchInput
            label="Start"
            value={start}
            onChange={onStartChange}
            placeholder="e.g. Union Station, CN Tower, or an address"
          />
          <SearchInput
            label="Destination"
            value={end}
            onChange={onEndChange}
            placeholder="e.g. Union Station, CN Tower, or an address"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onSwap} aria-label="Swap start and destination">
          <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
          Swap
        </Button>
        <Button variant="outline" size="sm" onClick={onUseMyLocation} loading={locating}>
          <Crosshair className="h-4 w-4" aria-hidden="true" />
          Use my location
        </Button>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-ash">
          <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
          Toronto
        </span>
      </div>
    </section>
  );
}