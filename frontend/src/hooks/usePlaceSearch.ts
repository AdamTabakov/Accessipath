import { useEffect, useRef, useState } from "react";
import type { Place } from "../types/index.js";
import * as api from "../services/api.js";

export interface UsePlaceSearchResult {
  results: Place[];
  searching: boolean;
  error: string | null;
}

/**
 * Debounced place search via Nominatim geocoding, bounded to the Toronto area.
 */
export function usePlaceSearch(query: string): UsePlaceSearchResult {
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length === 0) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const remote = await api.geocode(query);
        setResults(remote.results.slice(0, 8));
        setError(null);
      } catch (err) {
        setError("Search is temporarily unavailable. Try again in a moment.");
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return { results, searching, error };
}