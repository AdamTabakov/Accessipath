import { useEffect, useRef, useState } from "react";
import type { Place } from "../types/index.js";
import * as api from "../services/api.js";

export interface UsePlaceSearchResult {
  results: Place[];
  searching: boolean;
  error: string | null;
}

/**
 * Debounced place search: instant TMU landmarks from the backend, then
 * Nominatim results for anything beyond campus.
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
        const local = await api.getPlaces(query);
        const combined = { results: [...local.results] };
        if (local.results.length < 5) {
          const remote = await api.geocode(query).catch(() => ({ results: [] as Place[] }));
          combined.results = [...local.results, ...remote.results];
        }
        setResults(combined.results.slice(0, 8));
        setError(null);
      } catch (err) {
        setError("Search unavailable. Try a TMU building like 'SLC' or 'ENG'.");
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