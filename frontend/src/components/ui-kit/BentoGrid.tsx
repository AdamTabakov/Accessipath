import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";
import { SpotlightCard } from "./SpotlightCard.js";

/**
 * Aceternity-style bento grid. `BentoGrid` lays out responsive columns;
 * `BentoCard` is a spotlight card with a configurable column span.
 */
export function BentoGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}

export function BentoCard({
  children,
  className = "",
  span = "",
}: {
  children: ReactNode;
  className?: string;
  span?: string;
}) {
  return (
    <SpotlightCard
      className={cn("rounded-card bg-charcoal p-8 transition-colors duration-300", span, className)}
    >
      {children}
    </SpotlightCard>
  );
}