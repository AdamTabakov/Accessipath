import rateLimit from "express-rate-limit";
import { config } from "../config.js";

/**
 * Rate limiting is skipped in automated tests (NODE_ENV=test) so suites that
 * share a single app instance are not throttled; production limits stay tight.
 */
const skip = () => config.nodeEnv === "test";

/** Generic per-IP limiter for public API routes. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: "Too many requests. Please slow down." },
});

/** Stricter limiter for expensive / write endpoints (reports, AI, geocoding). */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: "Too many requests. Please try again in a minute." },
});

/** Tight limiter for authentication endpoints (signup, login, verify, resend). */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: "Too many attempts. Please try again in a minute." },
});