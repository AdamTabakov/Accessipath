import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, MapPin, Siren } from "lucide-react";
import type { AccessibilityReport, Coordinates, Place, RouteMode, RouteResult } from "../types/index.js";
import { MODES, ENG, SLC } from "../utils/constants.js";
import { useProfile } from "../hooks/useProfile.js";
import { useRoutes } from "../hooks/useRoutes.js";
import * as api from "../services/api.js";
import { MapCanvas } from "../components/map/MapCanvas.js";
import { RoutePlanner } from "../components/routing/RoutePlanner.js";
import { RouteCard } from "../components/routing/RouteCard.js";
import { ReportPanel } from "../components/report/ReportPanel.js";
import { Button, Spinner } from "../components/ui.js";
import { AnimatedTabs, ShimmerButton } from "../components/ui-kit/index.js";

const SLC_PLACE: Place = {
  id: "slc",
  label: "Student Learning Centre (SLC)",
  description: "341 Yonge Street",
  latitude: SLC.latitude,
  longitude: SLC.longitude,
  source: "tmu",
};

const ENG_PLACE: Place = {
  id: "eng",
  label: "George Vari Engineering and Computing Centre (ENG)",
  description: "245 Church Street",
  latitude: ENG.latitude,
  longitude: ENG.longitude,
  source: "tmu",
};

export function MapPage() {
  const { profile } = useProfile();
  const [start, setStart] = useState<Place | null>(SLC_PLACE);
  const [end, setEnd] = useState<Place | null>(ENG_PLACE);
  const [mode, setMode] = useState<RouteMode>("most_accessible");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showUnknown, setShowUnknown] = useState(true);
  const [locating, setLocating] = useState(false);
  const [reports, setReports] = useState<AccessibilityReport[]>([]);

  const [reportOpen, setReportOpen] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<Coordinates | null>(null);

  const { data, loading, error, refresh } = useRoutes(
    {
      start: start ?? undefined,
      end: end ?? undefined,
      mode,
    },
    profile,
  );

  const routes = useMemo<RouteResult[]>(() => data?.routes ?? [], [data]);

  const selectedRoute = useMemo(() => {
    if (routes.length === 0) return null;
    return routes.find((r) => r.id === selectedRouteId) ?? routes[0]!;
  }, [routes, selectedRouteId]);

  useEffect(() => {
    api.getReports().then(({ reports }) => setReports(reports)).catch(() => {});
  }, []);

  const selectedEvidence = selectedRoute?.evidence ?? [];

  const handleSwap = () => {
    setStart(end);
    setEnd(start);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStart({
          id: "my-location",
          label: "My location",
          description: "GPS",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          source: "nominatim",
        });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };

  const handleReportSubmitted = useCallback((report: AccessibilityReport) => {
    setReports((prev) => [report, ...prev]);
    setPickedLocation(null);
    setPickingLocation(false);
    refresh();
  }, [refresh]);

  const startMap = start ? { latitude: start.latitude, longitude: start.longitude, label: start.label } : null;
  const endMap = end ? { latitude: end.latitude, longitude: end.longitude, label: end.label } : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Sidebar */}
        <aside className="flex w-full flex-col gap-4 lg:w-[430px] lg:shrink-0" aria-label="Route planning">
          <div className="rounded-card bg-charcoal p-6">
            <RoutePlanner
              start={start}
              end={end}
              onStartChange={setStart}
              onEndChange={setEnd}
              onSwap={handleSwap}
              onUseMyLocation={handleUseMyLocation}
              locating={locating}
            />
          </div>

          <div className="rounded-card bg-charcoal p-6">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-ash">
                Rank routes by
              </legend>
              <AnimatedTabs<RouteMode>
                label="Route ranking mode"
                value={mode}
                onChange={setMode}
                items={MODES.map((m) => ({ value: m.value, label: m.label, title: m.hint }))}
                className="w-full [&>button]:flex-1"
              />
              <p className="mt-2 text-xs text-ash" aria-live="polite">
                {MODES.find((m) => m.value === mode)?.hint}
              </p>
            </fieldset>

            <label className="mt-4 flex items-center gap-2 text-sm text-platinum">
              <input
                type="checkbox"
                checked={showUnknown}
                onChange={(e) => setShowUnknown(e.target.checked)}
                className="h-4 w-4 accent-[#0071e3]"
              />
              Show sections with unknown accessibility data
            </label>
          </div>

          {loading && (
            <div className="rounded-card bg-charcoal p-6">
              <Spinner label="Calculating accessible routes..." />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-card border border-status-inaccessible/40 bg-status-inaccessible/10 p-6" role="alert">
              <p className="flex items-center gap-2 text-sm font-semibold text-status-inaccessible">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Could not load routes
              </p>
              <p className="mt-1 text-sm text-platinum">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
                Retry
              </Button>
            </div>
          )}

          {data?.warnings.map((w, i) => (
            <div key={i} className="rounded-card border border-status-warning/40 bg-status-warning/10 p-5 text-sm text-platinum">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden="true" />
                {w}
              </p>
            </div>
          ))}

          {!loading && !error && routes.length > 0 && (
            <div className="flex flex-col gap-4" aria-live="polite">
              {routes.map((route, index) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  rank={index + 1}
                  selected={selectedRoute?.id === route.id}
                  recommended={index === 0}
                  onSelect={() => setSelectedRouteId(route.id)}
                />
              ))}
            </div>
          )}

          {!loading && !error && !start && !end && (
            <div className="rounded-card bg-charcoal p-6 text-sm text-platinum">
              Search for a start and destination above to plan a route.
            </div>
          )}
        </aside>

        {/* Map */}
        <div className="relative min-h-[480px] flex-1 lg:min-h-[calc(100vh-140px)]">
          <MapCanvas
            routes={routes}
            selectedRouteId={selectedRoute?.id ?? null}
            onSelectRoute={setSelectedRouteId}
            start={startMap}
            end={endMap}
            evidence={selectedEvidence}
            unknownCoordinates={selectedRoute?.unknownCoordinates ?? []}
            showUnknown={showUnknown}
            reports={reports}
            pickingLocation={pickingLocation}
            pickedLocation={pickedLocation}
            onPickLocation={(c) => {
              setPickedLocation(c);
              setPickingLocation(false);
            }}
          />

          {!reportOpen && (
            <ShimmerButton
              className="absolute bottom-4 right-4 z-[1000] px-6 py-3 text-base"
              onClick={() => {
                setReportOpen(true);
                setPickingLocation(true);
              }}
            >
              <Siren className="h-4 w-4" aria-hidden="true" />
              Report an issue
            </ShimmerButton>
          )}

          {reportOpen && (
            <div className="absolute inset-y-0 right-0 z-[1100] w-full max-w-md overflow-y-auto border-l border-graphite bg-true-black/60 p-3 sm:p-4">
              <ReportPanel
                pickedLocation={pickedLocation}
                pickingLocation={pickingLocation}
                onRequestPick={() => setPickingLocation(true)}
                onCancelPick={() => setPickingLocation(false)}
                onSubmitted={handleReportSubmitted}
                onClose={() => setReportOpen(false)}
              />
            </div>
          )}

          <p className="pointer-events-none absolute bottom-1.5 left-2 z-[500] rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-silk">
            <MapPin className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Start is "A", destination is "B". Tap a route to inspect it.
          </p>
        </div>
      </div>
    </div>
  );
}