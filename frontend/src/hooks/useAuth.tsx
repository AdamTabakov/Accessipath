import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SafeUser } from "../types/index.js";
import * as api from "../services/api.js";

type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  user: SafeUser | null;
  status: AuthStatus;
  signup: (input: { email: string; name: string; password: string }) => Promise<{
    user: SafeUser;
    devCode?: string;
    message?: string;
  }>;
  login: (input: { email: string; password: string }) => Promise<void>;
  verify: (input: { email: string; code: string }) => Promise<SafeUser>;
  resendCode: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    if (!api.getToken()) {
      setStatus("guest");
      return;
    }
    api
      .getMe()
      .then(({ user: me }) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        // Expired or invalid token - clear it and treat as a guest.
        api.setToken(null);
        if (!cancelled) {
          setUser(null);
          setStatus("guest");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signup = useCallback(
    async (input: { email: string; name: string; password: string }) => {
      const res = await api.signup(input);
      return { user: res.user, devCode: res.devCode, message: res.message };
    },
    [],
  );

  const login = useCallback(async (input: { email: string; password: string }) => {
    const res = await api.login(input);
    api.setToken(res.token);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const verify = useCallback(async (input: { email: string; code: string }) => {
    const res = await api.verifyEmail(input);
    return res.user;
  }, []);

  const resendCode = useCallback(async (email: string) => {
    await api.resendVerificationCode(email);
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  const value = useMemo(
    () => ({ user, status, signup, login, verify, resendCode, logout }),
    [user, status, signup, login, verify, resendCode, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}