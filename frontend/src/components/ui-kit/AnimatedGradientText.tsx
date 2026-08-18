import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style animated gradient text.
 */
export function AnimatedGradientText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "ax-gradient-text bg-[length:200%_auto] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}