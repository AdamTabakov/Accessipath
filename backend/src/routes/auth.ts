import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { DataStore } from "../services/store.js";
import { HttpError } from "../middleware/error.js";
import { authLimiter } from "../middleware/rateLimit.js";
import {
  loginBodySchema,
  resendBodySchema,
  signupBodySchema,
  verifyBodySchema,
} from "../middleware/validate.js";
import {
  generateVerificationCode,
  hashPassword,
  hashVerificationCode,
  requireAuth,
  safeEqual,
  signToken,
  verifyPassword,
} from "../services/auth.js";
import { sendVerificationEmail } from "../services/mailer.js";
import { toSafeUser } from "../types/index.js";
import { config } from "../config.js";

export function createAuthRouter(store: DataStore): Router {
  const router = Router();

  const codeExpiry = () =>
    new Date(Date.now() + config.verificationCodeTtlMinutes * 60_000).toISOString();

  router.post("/signup", authLimiter, async (req, res, next) => {
    try {
      const body = signupBodySchema.parse(req.body);
      const existing = await store.findUserByEmail(body.email);
      if (existing?.verifiedAt) {
        throw new HttpError(409, "An account with this email already exists.");
      }
      if (existing) {
        const code = generateVerificationCode();
        await store.updateUser(existing.id, {
          verificationCodeHash: hashVerificationCode(code),
          verificationExpiresAt: codeExpiry(),
        });
        const mail = await sendVerificationEmail({ to: existing.email, name: existing.name, code });
        res
          .status(200)
          .json({ user: toSafeUser(existing), devCode: mail.devCode, message: "Verification code sent." });
        return;
      }
      const id = randomUUID();
      const code = generateVerificationCode();
      const user = await store.createUser({
        id,
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        verificationCodeHash: hashVerificationCode(code),
        verificationExpiresAt: codeExpiry(),
        createdAt: new Date().toISOString(),
      });
      const mail = await sendVerificationEmail({ to: user.email, name: user.name, code });
      res.status(201).json({ user: toSafeUser(user), devCode: mail.devCode });
    } catch (error) {
      next(error);
    }
  });

  router.post("/verify", authLimiter, async (req, res, next) => {
    try {
      const body = verifyBodySchema.parse(req.body);
      const user = await store.findUserByEmail(body.email);
      if (!user) throw new HttpError(400, "Invalid verification code.");
      if (user.verifiedAt) {
        res.json({ user: toSafeUser(user) });
        return;
      }
      if (!user.verificationCodeHash) {
        throw new HttpError(400, "No verification code is pending. Request a new one.");
      }
      if (!safeEqual(user.verificationCodeHash, hashVerificationCode(body.code))) {
        throw new HttpError(400, "Invalid verification code.");
      }
      if (!user.verificationExpiresAt || Date.now() > new Date(user.verificationExpiresAt).getTime()) {
        throw new HttpError(400, "Verification code expired. Request a new one.");
      }
      const updated = await store.updateUser(user.id, {
        verifiedAt: new Date().toISOString(),
        verificationCodeHash: null,
        verificationExpiresAt: null,
      });
      res.json({ user: toSafeUser(updated) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/resend", authLimiter, async (req, res, next) => {
    try {
      const body = resendBodySchema.parse(req.body);
      const user = await store.findUserByEmail(body.email);
      if (user && !user.verifiedAt) {
        const code = generateVerificationCode();
        await store.updateUser(user.id, {
          verificationCodeHash: hashVerificationCode(code),
          verificationExpiresAt: codeExpiry(),
        });
        const mail = await sendVerificationEmail({ to: user.email, name: user.name, code });
        res.json({ ok: true, devCode: mail.devCode });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", authLimiter, async (req, res, next) => {
    try {
      const body = loginBodySchema.parse(req.body);
      const user = await store.findUserByEmail(body.email);
      const genericError = "Incorrect email or password.";
      if (!user) throw new HttpError(401, genericError);
      const passwordOk = await verifyPassword(body.password, user.passwordHash);
      if (!passwordOk) throw new HttpError(401, genericError);
      if (!user.verifiedAt) {
        throw new HttpError(403, "Please verify your email before signing in.");
      }
      const token = signToken(user.id);
      res.json({ token, user: toSafeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (req, res, next) => {
    try {
      const user = await store.getUserById(res.locals.userId as string);
      if (!user) throw new HttpError(401, "Account not found.");
      res.json({ user: toSafeUser(user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}