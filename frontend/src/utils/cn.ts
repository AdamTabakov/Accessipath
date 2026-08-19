import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, de-duplicating conflicting Tailwind utilities so the
 * last occurrence wins regardless of generated CSS order (prevents e.g.
 * `bg-white` + `bg-apple-blue` both applying).
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}