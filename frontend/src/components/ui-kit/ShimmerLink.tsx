import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style shimmer link: a diagonal light sweep passes across on hover.
 * Renders a react-router `<a>` so no interactive elements are nested.
 */
export function ShimmerLink({
  to,
  children,
  className = "",
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-pill bg-apple-blue text-white transition hover:brightness-110 active:brightness-95",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[300%]"
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}