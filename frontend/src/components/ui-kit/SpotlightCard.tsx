import { useRef, useState, type ReactNode } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Aceternity-style spotlight card: a soft radial glow follows the cursor.
 * Decorative only — content and semantics are unchanged.
 */
export function SpotlightCard({
  children,
  className = "",
  color = "rgba(41, 151, 255, 0.14)",
  radius = 340,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState({ x: 0, y: 0, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpotlight({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setSpotlight((s) => ({ ...s, opacity: 0 }))}
      className={cn("group relative overflow-hidden", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(${radius}px circle at ${spotlight.x}px ${spotlight.y}px, ${color}, transparent 70%)`,
          opacity: spotlight.opacity,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}