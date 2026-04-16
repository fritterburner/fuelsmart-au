# Excise Pass-Through Checker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggleable "Excise mode" to FuelSmart AU that recolours the station map by federal-excise pass-through verdict (green = full, amber = partial, red = none, blue = price-rose), with per-station detail, live oil/AUD market data, and a dedicated methodology page.

**Architecture:** Pure-logic layer (`src/lib/excise/*`) does the maths. A daily Vercel cron fetches Brent + AUD via Anthropic's web_search tool and caches to Upstash Redis. Client reads cached market-data once via `/api/market-data`, computes verdicts locally per visible station. New components: header toggle pill, status bar, station popup variant, `/excise` explainer page.

**Tech Stack:** Next.js 16.2.2, TypeScript, Jest + ts-jest, Upstash Redis, Leaflet, Tailwind CSS. Mirror existing route-handler and cache patterns.

---

## Task 1: Excise constants & baseline city data

**Files:**
- Create: `src/lib/excise/baselines.ts`
- Create: `src/lib/excise/types.ts`

**Content — `types.ts`:**
```typescript
import type { Station } from "@/lib/types";

export type FuelBucket = "ULP" | "DIESEL" | "NA";

export interface BaselineCity {
  name: string;
  state: Station["state"];
  lat: number;
  lng: number;
  ulpBaseline: number;   // cpl, 31 Mar 2026
  dieselBaseline: number;
}

export interface MarketData {
  brent_usd: number;
  aud_usd: number;
  as_of: string;        // source-reported date
  fetched_at: string;   // our fetch timestamp
  source: string;
  stale: boolean;       // computed: true if fetched_at > 36h old
}

export type Verdict = "full" | "partial" | "none" | "price-rose" | "na";
export type Confidence = "high" | "medium" | "low";
```

**Content — `baselines.ts`:** constants + 27-city array. Lat/lng are approximate city-centre coords, fine for nearest-of-27 lookups.

Commit: `feat(excise): add baseline constants and 27-city data`

---

## Task 2: Verdict calculation with tests

**Files:**
- Create: `src/lib/excise/calc.ts`
- Create: `src/lib/excise/__tests__/calc.test.ts`

**Step 1:** Write tests covering the 5 plan scenarios + ULP vs Diesel + threshold boundaries + price-rose + na.

**Step 2:** Implement `calcVerdict({ pumpPriceCpl, fuel, baseline, liveOilUsd, liveAudUsd })` returning `{ expectedPriceCpl, oilImpactCpl, fxImpactCpl, passthroughCpl, passthroughPct, verdict }`.

**Step 3:** `npx jest src/lib/excise/__tests__/calc.test.ts` — all pass.

Commit: `feat(excise): implement verdict calculation with unit tests`

---

## Task 3: Nearest-baseline lookup with tests

**Files:**
- Create: `src/lib/excise/nearest-baseline.ts`
- Create: `src/lib/excise/__tests__/nearest-baseline.test.ts`

Haversine distance, returns `{ city, distanceKm, confidence }`. Thresholds: <50 high, 50–150 medium, >150 low.

Tests: Darwin coords → Darwin, ~0km, high. Tennant Creek → low-confidence. Sydney Harbour → Sydney. Exact baseline coords → 0km.

Commit: `feat(excise): add nearest-baseline lookup with unit tests`

---

## Task 4: Fuel bucket mapping

**Files:**
- Create: `src/lib/excise/fuel-buckets.ts`
- Create: `src/lib/excise/__tests__/fuel-buckets.test.ts`

`toFuelBucket(code: FuelCode): FuelBucket`. U91/E10/P95/P98 → ULP; DL/PD → DIESEL; rest → NA.

Commit: `feat(excise): map fuel codes to excise buckets`

---

## Task 5: Market-data cache module

**Files:**
- Modify: `src/lib/cache.ts`

Add:
- `MARKET_DATA_KEY = "market-data:v1"`
- `cacheMarketData(data: { brent_usd: number; aud_usd: number; as_of: string; source: string })` — adds `fetched_at` = now.
- `getCachedMarketData(): Promise<MarketData | null>` — reads, computes `stale` based on fetched_at age (>36h).

Commit: `feat(excise): add Upstash cache helpers for market data`

---

## Task 6: Market-data fetcher (Anthropic web_search)

**Files:**
- Create: `src/lib/excise/fetch-market-data.ts`

Exports `fetchLiveMarketData(): Promise<{ brent_usd, aud_usd, as_of, source }>`.

Uses `fetch` against `https://api.anthropic.com/v1/messages` with:
- `x-api-key: process.env.ANTHROPIC_API_KEY`
- `anthropic-version: 2023-06-01`
- `content-type: application/json`
- Body: model `claude-sonnet-4-5-20250929` (current sonnet 4.5), `max_tokens: 1000`, `tools: [{ type: "web_search_20250305", name: "web_search" }]`, system prompt per design doc, user message asking for JSON.

Parses final text block, strips markdown fences if present, returns parsed JSON with validation.

No test (network-dependent; will integration-test in Task 7).

Commit: `feat(excise): add Anthropic-backed market data fetcher`

---

## Task 7: Cron integration

**Files:**
- Modify: `src/lib/refresh.ts`
- Modify: `src/app/api/cron/refresh/route.ts` (if needed)

Add `refreshMarketData()` helper; call it inside `refreshAllData()` via try/catch. Include `marketData: { fetched_at, source } | { error }` in response.

Commit: `feat(excise): refresh market data in daily cron`

---

## Task 8: `/api/market-data` route

**Files:**
- Create: `src/app/api/market-data/route.ts`

`GET` handler: reads cache, returns `MarketData` JSON. If cache missing, returns 503.

Commit: `feat(excise): add /api/market-data endpoint`

---

## Task 9: Settings extension

**Files:**
- Modify: `src/lib/settings.ts`

Add `exciseMode: boolean` to `UserSettings` (default false). Defaults in DEFAULTS. Persist with existing mechanism.

Commit: `feat(excise): add exciseMode to user settings`

---

## Task 10: `ExciseToggle` component

**Files:**
- Create: `src/components/ExciseToggle.tsx`

Props: `{ mode: boolean; onToggle: (next: boolean) => void; variant: "desktop" | "mobile-menu" }`.

Desktop: `⛽ Excise: on/off` pill, emerald-on / slate-off. Mobile-menu: full-width menu row.

Commit: `feat(excise): add ExciseToggle component`

---

## Task 11: Wire toggle into header + persist

**Files:**
- Modify: `src/app/page.tsx`

Load settings on mount; track `exciseMode` state; pass to `MapView`; render `ExciseToggle` (desktop + in mobile menu). Save to settings on change.

Commit: `feat(excise): wire excise toggle into header`

---

## Task 12: `ExciseStatusBar` component

**Files:**
- Create: `src/components/ExciseStatusBar.tsx`

Fetches `/api/market-data` once on mount, shows `Excise mode • Oil $X.XX • AUD 0.XXX • Nh ago` or stale/error state. Emits market-data up to parent (render prop or callback) so `MapView` can use it.

Actually simpler — create a small context or useMarketData hook: `src/lib/useMarketData.ts`. Both `ExciseStatusBar` and `MapView` consume it.

Commit: `feat(excise): add market-data hook + status bar`

---

## Task 13: Excise-mode pin colouring in MapView

**Files:**
- Modify: `src/components/MapView.tsx`

When `exciseMode` prop is true:
- Use `useMarketData()` hook
- For each station: `bucket = toFuelBucket(displayFuel)`; if `NA`, grey pin. Else compute `nearest = nearestBaseline(lat, lng)`, pick `pumpPriceCpl` from station.prices, call `calcVerdict(...)`, map verdict → pin colour.
- Fallback: if market-data missing/stale-and-mode-on, render pins in price-mode but with a banner.

Label pins show `XX%` pass-through when excise mode on.

Commit: `feat(excise): recolour map pins by pass-through verdict`

---

## Task 14: Station popup variant for excise mode

**Files:**
- Modify: `src/components/MapView.tsx` (or extract to `StationExcisePopup.tsx`)

In excise mode, popup shows verdict badge, pass-through %, expandable "show working" with oil/FX impacts, expected price, baseline city + distance + confidence. "Learn how this is calculated →" linking `/excise`.

Commit: `feat(excise): add detailed verdict popup for stations`

---

## Task 15: `/excise` explainer page

**Files:**
- Create: `src/app/excise/page.tsx`
- Create: `src/components/ExciseManualOverride.tsx` (session-only inputs)

Server-rendered static content + client component for live values & manual override.

Sections: intro, live market data card, formula with current values substituted, worked example, 27-city baseline table, ACCC link, manual override panel.

Commit: `feat(excise): add /excise methodology explainer page`

---

## Task 16: Mobile menu + "How it's calculated" link

**Files:**
- Modify: `src/app/page.tsx`

Add to mobile ⋯ menu: Excise toggle (via `ExciseToggle mobile-menu`), "How it's calculated" → `/excise`. Desktop: add small "?" next to toggle → `/excise`.

Commit: `feat(excise): add explainer links in nav`

---

## Task 17: Manual verification & commit

**Steps:**
1. `npx jest` — all pass.
2. `npx next build` — build succeeds.
3. `npx next dev` — smoke test: toggle on/off, tap station, visit `/excise`.
4. Final commit if anything cleanup-related.

Commit (if needed): `chore(excise): final polish`

---

## Out of scope (per design doc)

- City-level aggregate leaderboard
- Historical timeline
- Notifications
- OG tags / SEO metadata for `/excise`
- Component tests (no RTL in project)

## Deferred configuration

- `ANTHROPIC_API_KEY` must be added to Vercel env vars before production.
- Consider separate cron for market-data only if station refresh becomes slow.
