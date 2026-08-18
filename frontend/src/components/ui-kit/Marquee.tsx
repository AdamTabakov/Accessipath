import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style marquee. Wrap two copies of your content (or pass `children`
 * once — the row duplicates it) for a seamless loop.
 */
export function Marquee({
  children,
  className = "",
  durationMs = 30000,
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  durationMs?: number;
  reverse?: boolean;
}) {
  return (
    <div className={cn("group flex overflow-hidden", className)}>
      <div
        className="flex w-max shrink-0 gap-4 pr-4"
        style={{
          animation: `ax-marquee ${durationMs}ms linear infinite ${reverse ? "reverse" : "normal"}`,
        }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}