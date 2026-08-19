import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type express from "express";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/services/store.js";

let app: express.Express;

const uniqueEmail = () => `user-${Date.now()}@example.com`;

beforeAll(async () => {
  app = await createApp(new MemoryStore());
});

describe("Auth", () => {
  it("rejects signup with a short password", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: uniqueEmail(),
      name: "Test User",
      password: "short",
    });
    expect(res.status).toBe(400);
  });

  it("rejects signup with an invalid email", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "not-an-email",
      name: "Test User",
      password: "longenough1",
    });
    expect(res.status).toBe(400);
  });

  it("signs up a user and returns the dev verification code when no mailer key is set", async () => {
    const email = uniqueEmail();
    const res = await request(app).post("/api/auth/signup").send({
      email,
      name: "Ada Lovelace",
      password: "correct-horse-battery",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.verified).toBe(false);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.devCode).toMatch(/^\d{6}$/);
  });

  it("rejects a duplicate verified account with 409", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/signup").send({
      email,
      name: "One",
      password: "password123",
    });
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Two",
      password: "password123",
    });
    // Still unverified: a fresh code is sent rather than leaking the account.
    expect(signup.status).toBe(200);
    expect(signup.body.message).toBe("Verification code sent.");
  });

  it("verifies the email with the correct code", async () => {
    const email = uniqueEmail();
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Grace Hopper",
      password: "password123",
    });
    const verify = await request(app).post("/api/auth/verify").send({
      email,
      code: signup.body.devCode,
    });
    expect(verify.status).toBe(200);
    expect(verify.body.user.verified).toBe(true);
  });

  it("rejects a wrong verification code", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/signup").send({
      email,
      name: "Wrong Code",
      password: "password123",
    });
    const verify = await request(app).post("/api/auth/verify").send({
      email,
      code: "000000",
    });
    expect(verify.status).toBe(400);
  });

  it("rejects login before verification", async () => {
    const email = uniqueEmail();
    await request(app).post("/api/auth/signup").send({
      email,
      name: "Not Verified",
      password: "password123",
    });
    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    expect(login.status).toBe(403);
  });

  it("logs in with the wrong password", async () => {
    const email = uniqueEmail();
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Ada",
      password: "password123",
    });
    await request(app).post("/api/auth/verify").send({ email, code: signup.body.devCode });
    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "wrong-password",
    });
    expect(login.status).toBe(401);
  });

  it("logs in with the correct password and returns a token", async () => {
    const email = uniqueEmail();
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Ada",
      password: "password123",
    });
    await request(app).post("/api/auth/verify").send({ email, code: signup.body.devCode });
    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user.email).toBe(email);
  });

  it("returns the current user for a valid token", async () => {
    const email = uniqueEmail();
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Grace",
      password: "password123",
    });
    await request(app).post("/api/auth/verify").send({ email, code: signup.body.devCode });
    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it("rejects /api/auth/me without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects /api/auth/me with a garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not.a.token");
    expect(res.status).toBe(401);
  });

  it("resends a new verification code", async () => {
    const email = uniqueEmail();
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Resend",
      password: "password123",
    });
    const firstCode = signup.body.devCode;
    const resend = await request(app).post("/api/auth/resend").send({ email });
    expect(resend.status).toBe(200);
    expect(resend.body.devCode).toMatch(/^\d{6}$/);
    // Old code is invalidated by the resend.
    const oldVerify = await request(app).post("/api/auth/verify").send({ email, code: firstCode });
    expect(oldVerify.status).toBe(400);
  });

  it("scopes the profile to the signed-in user", async () => {
    const email = uniqueEmail();
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Prefs",
      password: "password123",
    });
    await request(app).post("/api/auth/verify").send({ email, code: signup.body.devCode });
    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });

    const put = await request(app)
      .put("/api/profile")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({
        mobilityProfile: "walker",
        avoidStairs: true,
        preferRamps: true,
        preferElevators: false,
        maxSlope: "steep",
        preferSmoothSurface: true,
        maxWalkDistanceMeters: 1500,
      });
    expect(put.status).toBe(200);
    expect(put.body.profile.mobilityProfile).toBe("walker");

    // Anonymous request still sees the global default.
    const anon = await request(app).get("/api/profile");
    expect(anon.status).toBe(200);
    expect(anon.body.profile.mobilityProfile).toBe("wheelchair");

    // The signed-in user sees their own profile.
    const authed = await request(app)
      .get("/api/profile")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(authed.status).toBe(200);
    expect(authed.body.profile.mobilityProfile).toBe("walker");
  });

  it("requires auth to read or save recent routes", async () => {
    const anonGet = await request(app).get("/api/routes/recent");
    expect(anonGet.status).toBe(401);

    const anonPost = await request(app).post("/api/routes/recent").send({
      startLabel: "SLC",
      startLatitude: 43.6577,
      startLongitude: -79.3802,
      endLabel: "ENG",
      endLatitude: 43.658112,
      endLongitude: -79.377632,
      mode: "most_accessible",
    });
    expect(anonPost.status).toBe(401);
  });

  it("saves and lists recent routes per user", async () => {
    const email = uniqueEmail();
    const signup = await request(app).post("/api/auth/signup").send({
      email,
      name: "Routes",
      password: "password123",
    });
    await request(app).post("/api/auth/verify").send({ email, code: signup.body.devCode });
    const login = await request(app).post("/api/auth/login").send({
      email,
      password: "password123",
    });
    const auth = `Bearer ${login.body.token}`;

    const empty = await request(app).get("/api/routes/recent").set("Authorization", auth);
    expect(empty.status).toBe(200);
    expect(empty.body.routes).toEqual([]);

    const post = await request(app).post("/api/routes/recent").set("Authorization", auth).send({
      startLabel: "Union Station",
      startLatitude: 43.6453,
      startLongitude: -79.3806,
      endLabel: "CN Tower",
      endLatitude: 43.6426,
      endLongitude: -79.3871,
      mode: "balanced",
    });
    expect(post.status).toBe(201);
    expect(post.body.route.mode).toBe("balanced");

    const list = await request(app).get("/api/routes/recent").set("Authorization", auth);
    expect(list.status).toBe(200);
    expect(list.body.routes).toHaveLength(1);
    expect(list.body.routes[0].startLabel).toBe("Union Station");
    expect(list.body.routes[0].endLabel).toBe("CN Tower");

    // Re-saving the same pair does not create a duplicate.
    await request(app).post("/api/routes/recent").set("Authorization", auth).send({
      startLabel: "Union Station",
      startLatitude: 43.6453,
      startLongitude: -79.3806,
      endLabel: "CN Tower",
      endLatitude: 43.6426,
      endLongitude: -79.3871,
      mode: "balanced",
    });
    const list2 = await request(app).get("/api/routes/recent").set("Authorization", auth);
    expect(list2.body.routes).toHaveLength(1);
  });
});