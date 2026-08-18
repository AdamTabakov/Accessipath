import { type CSSProperties, type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style aurora: soft, slowly drifting gradient blobs.
 * Purely decorative; hidden from assistive technology.
 */
export function Aurora({
  className = "",
  blobs = [
    { x: "10%", y: "-10%", size: "70vmax", color: "rgba(0,113,227,0.28)" },
    { x: "60%", y: "-20%", size: "60vmax", color: "rgba(186,98,252,0.16)" },
    { x: "35%", y: "30%", size: "55vmax", color: "rgba(0,144,247,0.2)" },
  ],
}: {
  className?: string;
  blobs?: Array<{ x: string; y: string; size: string; color: string }>;
}) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {blobs.map((blob, i) => {
        const style: CSSProperties = {
          left: blob.x,
          top: blob.y,
          width: blob.size,
          height: blob.size,
          background: `radial-gradient(circle at center, ${blob.color}, transparent 65%)`,
          animation: `ax-aurora ${20 + i * 7}s ease-in-out ${i * -4}s infinite alternate`,
        };
        return <div key={i} className="absolute rounded-full blur-[90px]" style={style} />;
      })}
    </div>
  );
}

export type { ReactNode };