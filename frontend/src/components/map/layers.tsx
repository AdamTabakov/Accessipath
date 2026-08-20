import { Fragment } from "react";
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
    html: `<div class="ax-marker ${cls}" style="width:20px;height:20px;font-size:10px;border-width:1.5px;opacity:0.9;" role="img" aria-label="${item.status}">${glyph}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
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
            {item.photoUrl && (
              <>
                <br />
                <img
                  src={item.photoUrl}
                  alt={`Photo evidence: ${item.label}`}
                  className="mt-1 max-h-32 w-48 rounded object-cover"
                />
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
          radius={4}
          pathOptions={{ color: "#c2410c", fillColor: "#c2410c", fillOpacity: 0.4, opacity: 0.75 }}
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
      {routes.map((route) => {
        const positions = route.geometry.map(
          (c) => [c.latitude, c.longitude] as [number, number],
        );
        if (route.selected) {
          return (
            <Fragment key={route.id}>
              <Polyline
                positions={positions}
                pathOptions={{
                  color: "#0a0a0c",
                  weight: 10,
                  opacity: 0.55,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                interactive={false}
              />
              <Polyline
                positions={positions}
                pathOptions={{
                  color: "#2997ff",
                  weight: 5,
                  opacity: 1,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                eventHandlers={{ click: () => onSelect(route.id) }}
              >
                {route.isRecommended && <Tooltip sticky>Recommended route</Tooltip>}
              </Polyline>
            </Fragment>
          );
        }
        return (
          <Polyline
            key={route.id}
            positions={positions}
            pathOptions={{
              color: "#8e8e93",
              weight: 3,
              opacity: 0.55,
              dashArray: "6 8",
              lineCap: "round",
              lineJoin: "round",
            }}
            eventHandlers={{ click: () => onSelect(route.id) }}
          >
            {route.isRecommended && <Tooltip sticky>Recommended route</Tooltip>}
          </Polyline>
        );
      })}
    </>
  );
}