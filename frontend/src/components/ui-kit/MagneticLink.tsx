import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../utils/cn.js";

/**
 * Aceternity-style magnetic link (react-router aware). The mouse-follow
 * transform lives on a wrapper so the inner `<a>` stays a single, valid
 * interactive element. Respects prefers-reduced-motion.
 */
export function MagneticLink({
  to,
  children,
  className = "",
  strength = 0.35,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const reduce = useReducedMotion();

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - rect.left - rect.width / 2) * strength,
      y: (e.clientY - rect.top - rect.height / 2) * strength,
    });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: reduce ? 0 : pos.x, y: reduce ? 0 : pos.y }}
      transition={{ type: "spring", stiffness: 240, damping: 16, mass: 0.7 }}
      className="inline-flex"
    >
      <Link to={to} onClick={onClick} className={cn("inline-flex items-center justify-center gap-2", className)}>
        {children}
      </Link>
    </motion.div>
  );
}