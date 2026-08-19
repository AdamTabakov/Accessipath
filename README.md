# AccessiPath

**Accessibility-first navigation — "Google Maps, but designed around accessibility rather than treating accessibility as an afterthought."**

AccessiPath helps people with mobility and accessibility needs answer a question most navigation apps ignore:

> **"Can I actually use this route?"**

Built for the **Hack for Humanity Summer 2026** hackathon, covering the **entire City of Toronto**. Plan routes anywhere in Toronto (e.g. Union Station → Student Learning Centre) and get accessibility-aware recommendations backed by live OpenStreetMap data.

---

## Why AccessiPath

A route that is technically valid but contains stairs is not a usable route for a wheelchair user. Ordinary navigators optimize for distance. AccessiPath optimizes for *usability*:

```
Route A                          Route B
Distance: 270m                   Distance: 220m
Stairs: 1 (no ramp)              Stairs: 0
Rough construction area          Smooth sidewalk
Blocked ramp reported            Ramps + elevators nearby
Score: 47 / 100                  Score: 100 / 100
```

AccessiPath **recommends Route B** even though the alternatives look similar on a map, because it scores every route with a transparent **Accessibility Score** and an honest **Data Confidence**, using evidence from multiple sources.

---

## Core Principles

- **Score ≠ Confidence.** A route can be *scored* well but have *low confidence* because the data near it is missing. Both numbers are shown, separately, with an explanation.
- **Unknown ≠ inaccessible.** If the map has no data about stairs, AccessiPath says *"unknown"* — it never claims *"there are no stairs."* Missing data is a warning sign, not proof of safety.
- **Evidence is explainable.** Every penalty and bonus lists *why* it was applied, from which source (institutional, OpenStreetMap, community reports, on-device AI), and how far the feature is from the route.
- **Reports never overwrite institutional data.** Community reports (including AI photo analysis) appear as their own evidence layer so users can weigh them.
- **The app itself is accessible.** Keyboard navigation, visible focus states, icon + text status indicators (never color-only), labeled inputs, semantic HTML, skip links, WCAG-minded.

---

## Features

- **Route planner** with mode presets — *Most accessible*, *Fastest*, *Balanced* — and a customizable profile (wheelchair / walker / stroller / cane, avoid stairs, prefer ramps/elevators, max slope, max walking distance).
- **Toronto-wide coverage.** Routes anywhere in the city via live OSRM foot routing plus a scheduled Overpass import of OSM accessibility features across the Toronto bounding box. Deterministic cached demo routes keep the SLC → ENG demo working even when external services are down.
- **Accounts with email verification.** Sign up, verify your email with a 6-digit code (sent via Resend), and sign in — your accessibility preferences then follow you on any device.
- **Recent routes.** Signed-in users get their last 10 planned routes saved and synced per account, with one-tap restore from the planner sidebar.
- **Transparent scoring panel.** Expandable Accessibility Score with every penalty/bonus explained.
- **Confidence panel.** Shows data coverage along the route and flags unknown sections as amber markers on the map.
- **Accessibility map layer.** Entrances, ramps, elevators, crossings, stairs, and obstacles rendered with status glyphs (✓ ✕ ? !) — never color alone.
- **Community reports.** Report a blocked ramp or broken elevator with a photo. On-device AI (transformers.js) classifies the photo **privately in the browser** — no image ever leaves the device.
- **Location search** (Nominatim) and **place/building index** for Toronto.

---

## Tech Stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS v4, react-leaflet, React Router, lucide-react |
| Backend   | Node.js, Express, TypeScript, zod validation, express-rate-limit, helmet |
| Data      | OpenStreetMap (tiles + Nominatim + Overpass), OSRM public routing, PostgreSQL + PostGIS (with in-memory fallback) |
| AI        | Hugging Face Transformers.js — on-device zero-shot image classification (privacy-first) |
| Hosting   | Render (web service + static site + free PostGIS + scheduled OSM refresh job) |

---

## Getting Started

Requirements: **Node.js ≥ 20**, npm.

```bash
# 1. Install dependencies (npm workspaces)
npm install

# 2. Create your local environment
cp .env.example .env        # defaults are fine for local dev

# 3. Run the backend + frontend together
npm run dev
# backend  → http://localhost:4000  (API)
# frontend → http://localhost:5173  (app)
```

No database is required for local development — the API runs in **memory mode** when `DATABASE_URL` is empty. Point your browser at `http://localhost:5173`, and the map page is pre-loaded with the SLC → ENG demo.

To test the sign-up / email-verification flow locally, leave `RESEND_API_KEY` empty: the verification code is logged to the backend console and surfaced on the verify page (development only).

### Useful scripts

```bash
npm run dev            # backend + frontend concurrently
npm run build          # typecheck + production build for both workspaces
npm run typecheck      # tsc --noEmit for backend and frontend
npm run test           # backend vitest suite (48 tests, incl. auth + recent routes)
npm run seed           # import downtown Toronto institutional data + OSM accessibility import
npm run import:campus  # downtown Toronto institutional/community seed import
npm run import:osm     # Overpass import for the City of Toronto bounding box
```

### API overview

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Liveness / store mode |
| `POST /api/auth/signup` | Create an account (unverified) + send verification code |
| `POST /api/auth/verify` | Verify email with the 6-digit code |
| `POST /api/auth/resend` | Resend a new verification code |
| `POST /api/auth/login` | Sign in; returns a JWT |
| `GET /api/auth/me` | Current signed-in user (Bearer token) |
| `GET /api/places?q=` | Toronto place/building search |
| `GET /api/buildings` · `GET /api/buildings/:id` | Building index |
| `GET /api/geocode?q=` | Free-text geocoding via Nominatim |
| `GET /api/routes?start=lat,lon&end=lat,lon&profile=&mode=` | Scored, sorted routes |
| `GET/POST /api/routes/recent` | Recent routes per signed-in account (JWT required) |
| `GET /api/accessibility/nearby?lat=&lon=&radius=` | Accessibility points near a location |
| `GET/POST /api/reports` | Community accessibility reports |
| `GET/PUT /api/profile` | User profile preferences (per-account when signed in) |
| `POST /api/ai/analyze` | Validates/attaches an on-device AI observation (images never uploaded) |

---

## How Scoring Works

Conceptually:

```text
route score =
    distance cost
  + stairs penalty
  + slope penalty
  + surface penalty
  + barrier penalty
  + uncertainty penalty
  − accessibility bonuses (ramps, elevators, accessible crossings)
```

Weights are **configurable** in `backend/src/services/scoring.ts` (`WEIGHTS`) rather than hardcoded throughout the app, because not every user has identical accessibility requirements. The engine:

1. Attaches nearby accessibility features to each route line (`EVIDENCE_RADIUS_M`).
2. Computes penalties/bonuses per feature, profile, and severity.
3. Estimates data coverage along the route for the Confidence score.
4. Sorts per mode — `most_accessible` ranks the highest score first (test-locked).

---

## Deployment (Render)

The included `render.yaml` blueprint provisions:

1. **`accessipath-api`** — Node web service (`backend/`, `npm run start`), free plan, health check at `/api/health`.
2. **`accessipath`** — static site (`frontend/dist`), SPA-ready.
3. **`accessipath-db`** — free PostgreSQL database with PostGIS.
4. **`accessipath-osm-refresh`** — scheduled daily job that refreshes the OSM accessibility import (Render Workflows/Cron).

Steps:

1. Push this repository to GitHub.
2. In Render, **New → Blueprint**, choose the repo, and apply `render.yaml`.
3. Set the synced env vars in the dashboard:
   - `CORS_ORIGINS` → your frontend URL(s)
   - `VITE_API_URL` → your backend URL (e.g. `https://accessipath-api.onrender.com`)
   - `JWT_SECRET` → a strong random secret
   - `RESEND_API_KEY` → a Resend key (email verification will not work without it in production)

---

## Security

- **Secrets stay server-side.** No API keys in frontend code; `.env` is gitignored; `DATABASE_URL` is injected by Render, never committed.
- **Accounts.** Passwords hashed with bcrypt (12 rounds); verification codes stored as SHA-256 hashes and compared with `timingSafeEqual`; signed JWTs for sessions; no tokens or hashes ever logged or returned to the client.
- **Never trust the client.** Every route coordinate, profile field, and report is re-validated server-side with zod.
- **Email verification** via Resend. In development without a key, the code is logged and returned (never in production).
- **Upload safety.** Report photos are validated as data URLs — magic bytes + image dimensions via `image-size`; rejected otherwise; stored under `uploads/` (gitignored).
- **Rate limiting** on public/expensive endpoints (geocoding, reports, routing, auth).
- **Hardened defaults**: helmet security headers, CORS allowlist, sanitized error messages (no stack traces to clients), no credential logging.
- **Treat external data as untrusted.** OSM/Nominatim/OSRM responses are validated; accessibility information is never fabricated and unknown data stays unknown.
- See `AGENTS.md` for the full security and accessibility checklist.

---

## Privacy-First AI

Photo analysis runs **on-device** via Transformers.js. The zero-shot classifier (fallback model chain) scores the image against labels like *"wheelchair-accessible ramp"* and *"blocked by obstacles"*. The image is never uploaded — only the resulting observation summary is stored with the report. This is the privacy-first answer to AI-powered accessibility reporting.

---

## Project Structure

```text
backend/
├── src/
│   ├── config.ts            # env-driven configuration
│   ├── types/               # shared domain types
│   ├── data/                # Toronto seed: buildings, accessibility points, places, demo reports
│   ├── services/            # auth, mailer, routing, scoring, confidence, geocoding, osm, store (memory+postgis)
│   ├── middleware/          # validation, rate limiting, error handler, uploads
│   ├── routes/              # REST API surface (api + auth)
│   └── scripts/             # import-campus, import-osm (Render scheduled job)
├── scripts/                 # import-campus, import-osm entrypoints
└── test/                    # vitest suite (48 tests incl. auth & recent routes)

frontend/src/
├── components/          # map, routing, accessibility, report, navigation, ui kit
├── pages/               # Landing, Map, Preferences, Report, About, Login, Signup, Verify
├── hooks/               # useProfile, useRoutes, usePlaceSearch, useAiAnalysis, useAuth
├── services/            # api client, on-device ai
├── types/               # frontend type mirror
└── utils/               # formatting, constants
```

---

## Attribution

- Map data © [OpenStreetMap](https://www.openstreetmap.org) contributors (ODbL).
- Tiles: © OpenStreetMap contributors.
- Geocoding: [Nominatim](https://nominatim.org).
- Routing: [OSRM](https://project-osrm.org) public demo server.
- On-device ML: [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js).
- Live accessibility features: OpenStreetMap crossings, steps, elevators, ramps, kerbs, and surfaces along your route corridor.
- Downtown Toronto institutional accessibility data: illustrative seed data assembled from public campus accessibility information; **not a substitute for official guidance**.

---

Built with accessibility, security, and honesty as first-class requirements.