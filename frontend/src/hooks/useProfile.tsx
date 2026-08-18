import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProfilePreferences } from "../types/index.js";
import { DEFAULT_PROFILE } from "../utils/constants.js";
import * as api from "../services/api.js";

const STORAGE_KEY = "accessipath.profile";

interface ProfileContextValue {
  profile: ProfilePreferences;
  ready: boolean;
  updateProfile: (patch: Partial<ProfilePreferences>) => void;
  persistProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function loadLocal(): ProfilePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as ProfilePreferences) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfilePreferences>(loadLocal);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getProfile()
      .then(({ profile: remote }) => {
        if (cancelled) return;
        setProfile({ ...remote });
      })
      .catch(() => {
        // backend unreachable - keep local profile
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProfile = useCallback((patch: Partial<ProfilePreferences>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable - continue in-memory
      }
      return next;
    });
  }, []);

  const persistProfile = useCallback(() => {
    api.saveProfile(profile).catch(() => {
      // offline persistence handled by localStorage
    });
  }, [profile]);

  const value = useMemo(
    () => ({ profile, ready, updateProfile, persistProfile }),
    [profile, ready, updateProfile, persistProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}