import { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import type { AccessibilityReport, Coordinates } from "../types/index.js";
import { useProfile } from "../hooks/useProfile.js";
import * as api from "../services/api.js";
import { MapCanvas } from "../components/map/MapCanvas.js";
import { ReportPanel } from "../components/report/ReportPanel.js";
import { StatusBadge } from "../components/ui.js";
import { TORONTO_CENTER } from "../utils/constants.js";
import { formatDate } from "../utils/format.js";

export function ReportPage() {
  const { profile } = useProfile();
  const [pickedLocation, setPickedLocation] = useState<Coordinates | null>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [reports, setReports] = useState<AccessibilityReport[]>([]);

  const refreshReports = () => {
    api.getReports().then(({ reports }) => setReports(reports)).catch(() => {});
  };

  useEffect(refreshReports, []);

  const mapStart = { latitude: TORONTO_CENTER.latitude, longitude: TORONTO_CENTER.longitude, label: "Toronto" };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-silk md:text-5xl">
        Report an accessibility issue
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-platinum">
        A broken elevator, a blocked ramp, construction, or a missing curb ramp. Reports affect route
        scoring immediately and never overwrite institutional data.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="min-h-[380px]">
            <MapCanvas
              routes={[]}
              selectedRouteId={null}
              onSelectRoute={() => {}}
              start={mapStart}
              end={null}
              evidence={[]}
              unknownCoordinates={[]}
              showUnknown={false}
              reports={reports}
              pickingLocation={pickingLocation}
              pickedLocation={pickedLocation}
              onPickLocation={(c) => {
                setPickedLocation(c);
                setPickingLocation(false);
              }}
            />
          </div>
          <p className="text-sm text-ash">
            Profile: {profile.mobilityProfile}. Reports are shown as amber markers; reports near a
            route are used in scoring.
          </p>
        </div>

        <ReportPanel
          pickedLocation={pickedLocation}
          pickingLocation={pickingLocation}
          onRequestPick={() => setPickingLocation(true)}
          onCancelPick={() => setPickingLocation(false)}
          onSubmitted={refreshReports}
          onClose={() => setPickingLocation(false)}
        />
      </div>

      <section aria-label="Recent reports" className="mt-14">
        <h2 className="text-2xl font-semibold text-silk">Recent reports</h2>
        {reports.length === 0 ? (
          <p className="mt-4 text-sm text-ash">No reports yet. Be the first to help the community.</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {reports.slice(0, 9).map((r) => (
              <li key={r.id} className="rounded-card bg-charcoal p-5">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={r.status === "verified" ? "accessible" : "unknown"} />
                  <span className="text-xs text-ash">{formatDate(r.createdAt)}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-silk">{r.description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-ash">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                </p>
                {r.status === "pending" && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-status-warning/15 px-3 py-1 text-xs font-semibold text-status-warning">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Pending verification
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}