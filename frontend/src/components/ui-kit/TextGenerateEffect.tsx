import { type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../utils/cn.js";

/**
 * Aceternity-style word-by-word text reveal. Animates when scrolled into view.
 */
export function TextGenerateEffect({
  words,
  className = "",
  wordClassName = "",
  delay = 0,
  once = true,
}: {
  words: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  once?: boolean;
}) {
  const reduce = useReducedMotion();
  const split = words.split(" ");

  const container: CSSProperties = reduce
    ? {}
    : { maskImage: "linear-gradient(#fff 0 0)", overflow: "hidden" };

  return (
    <span className={cn("inline-block", className)} style={container}>
      {split.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={reduce ? false : { opacity: 0, filter: "blur(4px)" }}
          whileInView={reduce ? undefined : { opacity: 1, filter: "blur(0px)" }}
          viewport={{ once, margin: "-80px" }}
          transition={{ duration: 0.5, delay: delay + i * 0.06, ease: "easeOut" }}
          className={cn("mr-[0.3em] inline-block", wordClassName)}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}