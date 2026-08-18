import { useEffect, useRef, useState } from "react";
import type { RouteMode, RoutesResponse } from "../types/index.js";
import type { ProfilePreferences } from "../types/index.js";
import * as api from "../services/api.js";

export interface RouteRequest {
  start?: { latitude: number; longitude: number };
  end?: { latitude: number; longitude: number };
  mode: RouteMode;
}

interface UseRoutesState {
  data: RoutesResponse | null;
  loading: boolean;
  error: string | null;
  refreshToken: number;
}

/**
 * Fetch and rank routes whenever start/end/mode/profile change.
 * Debounced so map pans do not trigger recomputation.
 */
export function useRoutes(
  request: RouteRequest,
  profile: ProfilePreferences,
): UseRoutesState & { refresh: () => void } {
  const [state, setState] = useState<UseRoutesState>({
    data: null,
    loading: false,
    error: null,
    refreshToken: 0,
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    const { start, end, mode } = requestRef.current;
    if (!start || !end) {
      setState({ data: null, loading: false, error: null, refreshToken });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await api.getRoutes({ start, end, profile, mode });
        setState({ data, loading: false, error: null, refreshToken });
      } catch (error) {
        setState({
          data: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to calculate routes right now.",
          refreshToken,
        });
      }
    }, 350);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [request.start?.latitude, request.start?.longitude, request.end?.latitude, request.end?.longitude, request.mode, profile, refreshToken]);

  const refresh = () => setRefreshToken((t) => t + 1);

  return { ...state, refresh };
}