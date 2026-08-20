import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, useMap, Marker, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import type { AccessibilityReport, Coordinates, EvidenceItem, RouteResult } from "../../types/index.js";
import { TORONTO_CENTER } from "../../utils/constants.js";
import { EvidenceMarkers, PlaceMarker, RouteLayer, UnknownSections, endIcon, startIcon } from "./layers.js";

const TILE_URL =
  (import.meta.env.VITE_OSM_TILE_URL as string | undefined) ??
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

function FitBounds({
  start,
  end,
  routes,
}: {
  start?: Coordinates | null;
  end?: Coordinates | null;
  routes: RouteResult[];
}) {
  const map = useMap();
  const bounds = useMemo(() => {
    const points: [number, number][] = [];
    if (start) points.push([start.latitude, start.longitude]);
    if (end) points.push([end.latitude, end.longitude]);
    for (const route of routes) {
      for (const c of route.geometry) points.push([c.latitude, c.longitude]);
    }
    return points;
  }, [start, end, routes]);

  useEffect(() => {
    if (bounds.length === 0) return;
    if (bounds.length === 1) {
      map.setView(bounds[0]!, 15);
      return;
    }
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
  }, [map, bounds]);

  return null;
}

const REPORT_ICON = divIcon({
  className: "",
  html: `<div class="ax-marker ax-marker-blocked" style="width:20px;height:20px;font-size:10px;border-width:1.5px;opacity:0.85;" role="img" aria-label="Report">R</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export interface MapCanvasProps {
  routes: RouteResult[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  start?: (Coordinates & { label?: string }) | null;
  end?: (Coordinates & { label?: string }) | null;
  evidence: EvidenceItem[];
  unknownCoordinates: Coordinates[];
  showUnknown: boolean;
  reports: AccessibilityReport[];
  focusReport?: AccessibilityReport | null;
  pickingLocation: boolean;
  pickedLocation: Coordinates | null;
  onPickLocation: (coords: Coordinates) => void;
}

export function MapCanvas({
  routes,
  selectedRouteId,
  onSelectRoute,
  start,
  end,
  evidence,
  unknownCoordinates,
  showUnknown,
  reports,
  focusReport,
  pickingLocation,
  pickedLocation,
  onPickLocation,
}: MapCanvasProps) {
  const selectedRoutes = routes.map((r) => ({
    id: r.id,
    geometry: r.geometry,
    selected: r.id === selectedRouteId,
    isRecommended: routes[0]?.id === r.id,
  }));

  return (
    <div className="relative h-full w-full overflow-hidden rounded-card border border-graphite">
      <MapContainer
        center={[TORONTO_CENTER.latitude, TORONTO_CENTER.longitude]}
        zoom={15}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl={true}
      >
        <TileLayer
          attribution={TILE_ATTRIBUTION}
          url={TILE_URL}
          subdomains={["a", "b", "c", "d"]}
        />

        <RouteLayer routes={selectedRoutes} onSelect={onSelectRoute} />
        <EvidenceMarkers items={evidence} />

        {showUnknown && <UnknownSections coordinates={unknownCoordinates} />}

        {start && <PlaceMarker position={start} icon={startIcon("A")} label={start.label ?? "Start"} />}
        {end && <PlaceMarker position={end} icon={endIcon("B")} label={end.label ?? "End"} />}

        {reports.slice(0, 5).map((r) => (
          <Marker
            key={r.id}
            position={[r.latitude, r.longitude]}
            icon={REPORT_ICON}
            title={r.description}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              <strong>Community report</strong>
              {r.status === "verified" && <span className="ml-1 text-status-accessible">· verified</span>}
              <br />
              {r.description}
              <br />
              <span className="text-xs">
                {r.upvotes} up · {r.downvotes} down · {r.status}
              </span>
              {r.photoUrl && (
                <>
                  <br />
                  <img
                    src={r.photoUrl}
                    alt={`Report photo: ${r.description}`}
                    className="mt-1 max-h-32 w-48 rounded object-cover"
                  />
                </>
              )}
            </Tooltip>
          </Marker>
        ))}

        <FlyToReport report={focusReport} />

        {pickingLocation && (
          <MapClickCapture onPickLocation={onPickLocation} />
        )}

        {pickedLocation && (
          <Marker
            position={[pickedLocation.latitude, pickedLocation.longitude]}
            icon={divIcon({
              className: "",
              html: `<div class="ax-marker" style="background:#b64400;width:28px;height:28px;font-size:12px;">+</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })}
            title="Report location"
          >
            <Tooltip>Report location</Tooltip>
          </Marker>
        )}

        <FitBounds start={start} end={end} routes={routes} />
      </MapContainer>

      {pickingLocation && (
        <p className="glass-bar pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-pill px-5 py-2 text-sm text-white">
          Tap the map to set the report location
        </p>
      )}
    </div>
  );
}

function FlyToReport({ report }: { report?: AccessibilityReport | null }) {
  const map = useMap();
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (!report) return;
    if (lastId.current === report.id) return;
    lastId.current = report.id;
    map.flyTo([report.latitude, report.longitude], 16, { duration: 1.2 });
  }, [map, report]);
  return null;
}

function MapClickCapture({ onPickLocation }: { onPickLocation: (c: Coordinates) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e: { latlng: { lat: number; lng: number } }) => {
      onPickLocation({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onPickLocation]);
  return null;
}