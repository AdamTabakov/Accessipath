import { Clock, MapPin } from "lucide-react";
import type { RecentRoute } from "../../types/index.js";
import { MODES } from "../../utils/constants.js";
import { formatRouteTime } from "../../utils/format.js";

interface RecentRoutesProps {
  routes: RecentRoute[];
  onSelect: (route: RecentRoute) => void;
}

export function RecentRoutes({ routes, onSelect }: RecentRoutesProps) {
  if (routes.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-ash">
        <Clock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
        Routes you plan will be saved here and synced to your account.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {routes.map((route) => {
        const modeLabel = MODES.find((m) => m.value === route.mode)?.label ?? route.mode;
        return (
          <li key={route.id}>
            <button
              type="button"
              onClick={() => onSelect(route)}
              className="flex w-full flex-col gap-1 rounded-card-sm border border-graphite bg-true-black/40 px-4 py-3 text-left transition-colors hover:border-link-blue/50 hover:bg-charcoal"
            >
              <span className="flex items-center gap-1.5 text-sm text-silk">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-link-blue" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-ash">{route.startLabel}</span>
                  <span aria-hidden="true" className="mx-1 text-ash">→</span>
                  {route.endLabel}
                </span>
              </span>
              <span className="pl-5 text-xs text-ash">
                {modeLabel} · {formatRouteTime(route.createdAt)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
