import { CircleMarker, Marker, Polyline, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import type { Coordinates, EvidenceItem } from "../../types/index.js";

export interface LabeledCoords extends Coordinates {
  label?: string;
}

export function startIcon(label = "A") {
  return divIcon({
    className: "",
    html: `<div class="ax-marker ax-marker-start" role="img" aria-label="Start ${label}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function endIcon(label = "B") {
  return divIcon({
    className: "",
    html: `<div class="ax-marker ax-marker-end" role="img" aria-label="End ${label}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function PlaceMarker({ position, icon, label }: { position: LabeledCoords; icon: ReturnType<typeof divIcon>; label: string }) {
  return (
    <Marker position={[position.latitude, position.longitude]} icon={icon} title={label}>
      {label && (
        <Tooltip direction="top" offset={[0, -16]}>
          {label}
        </Tooltip>
      )}
    </Marker>
  );
}

const STATUS_GLYPH: Record<string, string> = {
  accessible: "✓",
  inaccessible: "✕",
  unknown: "?",
};

const STATUS_CLASS: Record<string, string> = {
  accessible: "ax-marker-accessible",
  inaccessible: "ax-marker-inaccessible",
  unknown: "ax-marker-unknown",
};

export function evidenceIcon(item: EvidenceItem) {
  const cls = item.severity === "blocked" ? "ax-marker-blocked" : STATUS_CLASS[item.status] ?? "ax-marker-unknown";
  const glyph = item.severity === "blocked" ? "!" : STATUS_GLYPH[item.status] ?? "?";
  return divIcon({
    className: "",
    html: `<div class="ax-marker ${cls}" style="width:24px;height:24px;font-size:12px;" role="img" aria-label="${item.status}">${glyph}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function EvidenceMarkers({ items }: { items: EvidenceItem[] }) {
  return (
    <>
      {items.map((item) => (
        <Marker
          key={item.id}
          position={[item.latitude, item.longitude]}
          icon={evidenceIcon(item)}
          title={item.label}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            <strong>{item.label}</strong>
            <br />
            {item.status} · {Math.round(item.distanceMeters)} m from route
            {item.description && (
              <>
                <br />
                <em>{item.description}</em>
              </>
            )}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

export function UnknownSections({ coordinates }: { coordinates: Coordinates[] }) {
  if (coordinates.length === 0) return null;
  return (
    <>
      {coordinates.map((c, i) => (
        <CircleMarker
          key={`u-${i}`}
          center={[c.latitude, c.longitude]}
          radius={6}
          pathOptions={{ color: "#b64400", fillColor: "#b64400", fillOpacity: 0.6 }}
        >
          <Tooltip>No accessibility data near this section</Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

export interface RouteLayerProps {
  routes: Array<{
    id: string;
    geometry: Coordinates[];
    selected: boolean;
    isRecommended: boolean;
  }>;
  onSelect: (id: string) => void;
}

export function RouteLayer({ routes, onSelect }: RouteLayerProps) {
  return (
    <>
      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.geometry.map((c) => [c.latitude, c.longitude] as [number, number])}
          pathOptions={{
            color: route.selected ? "#2997ff" : "#636366",
            weight: route.selected ? 6 : 4,
            opacity: route.selected ? 1 : 0.6,
            dashArray: route.selected ? undefined : "8 6",
          }}
          eventHandlers={{ click: () => onSelect(route.id) }}
        >
          {route.isRecommended && (
            <Tooltip sticky>Recommended route</Tooltip>
          )}
        </Polyline>
      ))}
    </>
  );
}