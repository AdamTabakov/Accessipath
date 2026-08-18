import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn.js";

/**
 * Aceternity-style animated segmented control with a sliding pill.
 * Buttons keep native semantics (role group + aria-pressed).
 */
export interface AnimatedTabItem<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function AnimatedTabs<T extends string>({
  items,
  value,
  onChange,
  className = "",
  label,
}: {
  items: AnimatedTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}) {
  const id = useId();

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex flex-wrap gap-1 rounded-pill bg-smoke p-1", className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            title={item.title}
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative rounded-pill px-4 py-2 text-sm font-medium transition-colors",
              selected ? "text-white" : "text-platinum hover:text-silk",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`animated-tabs-${id}`}
                transition={{ type: "spring", bounce: 0.18, duration: 0.6 }}
                className="absolute inset-0 rounded-pill bg-apple-blue"
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}