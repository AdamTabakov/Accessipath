import { useRef, useState, type MouseEvent } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../utils/cn.js";

/**
 * Aceternity-style magnetic button: the button gently follows the cursor
 * with a spring. Respects prefers-reduced-motion.
 */
interface MagneticButtonProps extends HTMLMotionProps<"button"> {
  strength?: number;
}

export function MagneticButton({
  children,
  className = "",
  strength = 0.35,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const reduce = useReducedMotion();

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - rect.left - rect.width / 2) * strength,
      y: (e.clientY - rect.top - rect.height / 2) * strength,
    });
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: reduce ? 0 : pos.x, y: reduce ? 0 : pos.y }}
      transition={{ type: "spring", stiffness: 240, damping: 16, mass: 0.7 }}
      className={cn("inline-flex items-center justify-center gap-2", className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}