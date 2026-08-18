import { type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

interface OrbitingItem {
  node: ReactNode;
  ring: number; // 0 = inner, 1 = middle, 2 = outer
}

const RING_RADIUS: Record<number, number> = { 0: 62, 1: 110, 2: 150 };
const RING_DURATION: Record<number, string> = {
  0: "ax-orbit-slow 50s",
  1: "ax-orbit-mid 34s",
  2: "ax-orbit-fast 22s",
};

/**
 * Kokonut-style orbiting circles: items circle a center point on concentric rings.
 */
export function OrbitingCircles({
  items,
  center,
  className = "",
}: {
  items: OrbitingItem[];
  center: ReactNode;
  className?: string;
}) {
  const groups = [0, 1, 2] as const;

  return (
    <div
      aria-hidden="true"
      className={cn("relative mx-auto aspect-square w-full max-w-md select-none", className)}
    >
      <div className="absolute inset-0 rounded-full border border-graphite" />
      <div className="absolute inset-[18%] rounded-full border border-graphite/70" />
      <div className="absolute inset-[36%] rounded-full border border-graphite/40" />

      {groups.map((ring) => {
        const group = items.filter((item) => item.ring === ring);
        return group.map((item, index) => {
          const angle = (360 / group.length) * index;
          return (
            <div
              key={`${ring}-${index}`}
              className="absolute inset-0"
              style={{ animation: `${RING_DURATION[ring]} linear infinite` }}
            >
              <div
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `rotate(${angle}deg) translateX(${RING_RADIUS[ring]}px) rotate(-${angle}deg)`,
                }}
              >
                {item.node}
              </div>
            </div>
          );
        });
      })}

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{center}</div>
    </div>
  );
}