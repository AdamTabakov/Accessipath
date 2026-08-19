import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type express from "express";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/services/store.js";

let store: MemoryStore;
let app: express.Express;

const reportInput = {
  type: "blocked_ramp" as const,
  description: "Ramp blocked by delivery crates.",
  latitude: 43.6577,
  longitude: -79.3802,
};

beforeAll(async () => {
  store = new MemoryStore();
  app = await createApp(store);
});

async function authToken(): Promise<string> {
  const email = `voter-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const signup = await request(app).post("/api/auth/signup").send({
    email,
    name: "Voter",
    password: "correct-horse-battery",
  });
  expect(signup.status).toBe(201);
  expect(signup.body.devCode).toMatch(/^\d{6}$/);
  const verify = await request(app).post("/api/auth/verify").send({
    email,
    code: signup.body.devCode,
  });
  expect(verify.status).toBe(200);
  const login = await request(app).post("/api/auth/login").send({
    email,
    password: "correct-horse-battery",
  });
  expect(login.status).toBe(200);
  return login.body.token as string;
}

describe("Community report votes", () => {
  it("requires authentication to vote", async () => {
    const report = await store.createReport(reportInput);
    const res = await request(app)
      .post(`/api/reports/${report.id}/vote`)
      .send({ direction: "up" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid vote direction", async () => {
    const report = await store.createReport(reportInput);
    const token = await authToken();
    const res = await request(app)
      .post(`/api/reports/${report.id}/vote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "sideways" });
    expect(res.status).toBe(400);
  });

  it("upvotes once and toggles the vote off", async () => {
    const report = await store.createReport(reportInput);
    const token = await authToken();
    const up = await request(app)
      .post(`/api/reports/${report.id}/vote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "up" });
    expect(up.status).toBe(200);
    expect(up.body.report.upvotes).toBe(1);
    expect(up.body.report.myVote).toBe("up");

    const off = await request(app)
      .post(`/api/reports/${report.id}/vote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "up" });
    expect(off.body.report.upvotes).toBe(0);
    expect(off.body.report.downvotes).toBe(0);
    expect(off.body.report.myVote).toBeNull();
  });

  it("lets a user change their vote from up to down", async () => {
    const report = await store.createReport(reportInput);
    const token = await authToken();
    await request(app)
      .post(`/api/reports/${report.id}/vote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "up" });
    const down = await request(app)
      .post(`/api/reports/${report.id}/vote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "down" });
    expect(down.body.report.upvotes).toBe(0);
    expect(down.body.report.downvotes).toBe(1);
    expect(down.body.report.myVote).toBe("down");
  });

  it("exposes myVote per user on the reports list", async () => {
    const report = await store.createReport(reportInput);
    const token = await authToken();
    await request(app)
      .post(`/api/reports/${report.id}/vote`)
      .set("Authorization", `Bearer ${token}`)
      .send({ direction: "up" });
    const list = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const mine = list.body.reports.find((r: { id: string }) => r.id === report.id);
    expect(mine.myVote).toBe("up");
    expect(mine.upvotes).toBe(1);
  });

  it("verifies a report after 3 upvotes at a 2:1 ratio", async () => {
    const report = await store.createReport(reportInput);
    await store.voteReport(report.id, "user-a", "up");
    await store.voteReport(report.id, "user-b", "up");
    await store.voteReport(report.id, "user-c", "up");
    const updated = (await store.getReports()).find((r) => r.id === report.id);
    expect(updated?.status).toBe("verified");
    expect(updated?.verifiedAt).toBeDefined();
    const point = (await store.getAllAccessibilityPoints()).find(
      (p) => p.id === `point-${report.id}`,
    );
    expect(point?.confidence).toBe(0.85);
    expect(point?.verifiedAt).toBeDefined();
  });

  it("rejects a report after 3 downvotes and hides it from routing", async () => {
    const report = await store.createReport(reportInput);
    await store.voteReport(report.id, "user-a", "down");
    await store.voteReport(report.id, "user-b", "down");
    await store.voteReport(report.id, "user-c", "down");
    const updated = (await store.getReports()).find((r) => r.id === report.id);
    expect(updated?.status).toBe("rejected");
    const points = await store.getAllAccessibilityPoints();
    expect(points.some((p) => p.id === `point-${report.id}`)).toBe(false);
  });

  it("keeps a verified report verified even when votes dip below the threshold", async () => {
    const report = await store.createReport(reportInput);
    for (const u of ["user-a", "user-b", "user-c"]) {
      await store.voteReport(report.id, u, "up");
    }
    await store.voteReport(report.id, "user-d", "down");
    const updated = (await store.getReports()).find((r) => r.id === report.id);
    // Once verified, only rejection (3 downvotes outnumbering upvotes) flips it back.
    expect(updated?.status).toBe("verified");
  });
});
