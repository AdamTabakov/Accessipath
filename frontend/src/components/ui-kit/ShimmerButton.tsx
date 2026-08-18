import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style shimmer button: a diagonal light sweep passes across on hover.
 * Accessible name is provided by its text content.
 */
interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function ShimmerButton({
  children,
  className = "",
  type = "button",
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-pill bg-apple-blue text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[300%]"
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}