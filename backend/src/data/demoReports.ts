import type { AccessibilityReport } from "../types/index.js";

/**
 * Demo community reports pre-seeded so the "report pipeline" is visible on first load.
 * Statuses are `verified` for stable demo data so the evidence panel reads cleanly.
 */
export const DEMO_REPORTS: AccessibilityReport[] = [
  {
    id: "demo-rep-001",
    type: "blocked_ramp",
    description:
      "Ramp near the Library is temporarily blocked by delivery crates. Chair users cannot pass.",
    latitude: 43.65755,
    longitude: -79.37835,
    status: "verified",
    createdAt: "2026-08-01T14:30:00.000Z",
    expiresAt: "2026-09-15T14:30:00.000Z",
  },
  {
    id: "demo-rep-002",
    type: "broken_elevator",
    description:
      "SLC passenger elevator out of service today. Engineering has been notified.",
    latitude: 43.65766,
    longitude: -79.38008,
    status: "verified",
    createdAt: "2026-08-12T09:05:00.000Z",
    expiresAt: "2026-08-30T09:05:00.000Z",
  },
  {
    id: "demo-rep-003",
    type: "construction",
    description:
      "Gould Street construction has left an uneven, rough surface east of Yonge Street.",
    latitude: 43.65778,
    longitude: -79.3789,
    status: "pending",
    createdAt: "2026-08-14T16:40:00.000Z",
    expiresAt: "2026-09-13T16:40:00.000Z",
  },
];