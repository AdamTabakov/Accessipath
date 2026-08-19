/**
 * Minimal in-memory TTL cache with a size cap (evicts oldest entry).
 * Used to keep route candidates and scored results fast across repeated
 * or mode-switched requests without ever returning stale scoring for long.
 */
export function createTtlCache<K, V>(ttlMs: number, max = 200): {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  delete(key: K): void;
  clear(): void;
} {
  const entries = new Map<K, { expires: number; value: V }>();

  return {
    get(key: K): V | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expires < Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: K, value: V): void {
      entries.set(key, { expires: Date.now() + ttlMs, value });
      if (entries.size > max) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
    delete(key: K): void {
      entries.delete(key);
    },
    clear(): void {
      entries.clear();
    },
  };
}