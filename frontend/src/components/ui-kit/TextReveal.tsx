import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../utils/cn.js";

/**
 * Kokonut-style scroll-triggered word-by-word text reveal.
 */
export function TextReveal({
  text,
  className = "",
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3";
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  return (
    <Tag className={cn("inline", className)}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(2px)" }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: i * 0.04, ease: "easeOut" }}
          className="mr-[0.28em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}