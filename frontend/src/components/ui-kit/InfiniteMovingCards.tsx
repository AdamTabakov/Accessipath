import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../utils/cn.js";

/**
 * Aceternity-style infinite scrolling row of cards.
 * Content is duplicated so the loop is seamless.
 */
export function InfiniteMovingCards({
  children,
  className = "",
  duration = 36,
  reverse = false,
}: {
  children: ReactNode[];
  className?: string;
  duration?: number;
  reverse?: boolean;
}) {
  const reduce = useReducedMotion();
  const track = (
    <div className="flex w-max gap-4" aria-hidden="true">
      {children}
    </div>
  );

  return (
    <div
      className={cn(
        "group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
    >
      {reduce ? (
        <div className="flex flex-wrap justify-center gap-4">{children}</div>
      ) : (
        <>
          <motion.div
            className="flex w-max gap-4"
            animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
            transition={{ repeat: Infinity, ease: "linear", duration }}
          >
            {children}
            {children}
          </motion.div>
        </>
      )}
      <span className="sr-only">{track}</span>
    </div>
  );
}