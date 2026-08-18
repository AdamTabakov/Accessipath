import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style border beam: a soft beam of light that travels around a card's
 * edge. Parent must be `relative` (usually rounded). Purely decorative.
 */
export function BorderBeam({
  className = "",
  color = "#2997ff",
  duration = 7,
  delay = 0,
}: {
  className?: string;
  color?: string;
  duration?: number;
  delay?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] p-[1.5px]",
        "[mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]",
        "[mask-composite:exclude]",
        "[-webkit-mask-composite:xor]",
        className,
      )}
    >
      <div
        className="absolute left-1/2 top-1/2 h-[220%] w-[220%]"
        style={{
          transform: "translate(-50%, -50%)",
          background: `conic-gradient(from 0deg, transparent 0deg, ${color} 40deg, transparent 110deg)`,
          animation: `ax-border-beam ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
        }}
      />
    </div>
  );
}