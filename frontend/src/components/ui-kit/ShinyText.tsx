import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style shiny text: a specular highlight sweeps across the text.
 */
export function ShinyText({
  children,
  className = "",
  speedMs = 5000,
}: {
  children: ReactNode;
  className?: string;
  speedMs?: number;
}) {
  return (
    <span
      className={cn("ax-shiny-text", className)}
      style={{ ["--ax-shine-duration" as string]: `${speedMs}ms` }}
    >
      {children}
    </span>
  );
}