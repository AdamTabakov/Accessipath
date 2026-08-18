import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { HttpError } from "../middleware/error.js";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashVerificationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const sub = typeof payload === "string" ? payload : payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Requires a valid bearer token and exposes the authenticated user id on
 * res.locals.userId. Rejects with 401 when the token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(new HttpError(401, "Authentication required."));
    return;
  }
  const userId = verifyToken(token);
  if (!userId) {
    next(new HttpError(401, "Invalid or expired session."));
    return;
  }
  res.locals.userId = userId;
  next();
}

/**
 * Like requireAuth but never rejects: sets res.locals.userId when a valid
 * token is present so handlers can personalize responses for signed-in users.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  res.locals.userId = token ? verifyToken(token) : null;
  next();
}