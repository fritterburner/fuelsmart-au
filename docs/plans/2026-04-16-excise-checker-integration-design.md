# Excise Pass-Through Checker — Integration Design

**Date:** 2026-04-16
**Status:** Approved (brainstorming complete, implementation plan next)
**Relevance window:** Federal excise halving (52.6 → 26.3 cpl) expires 30 June 2026

---

## Goal

Integrate the standalone fuel excise pass-through calculator into FuelSmart AU as a toggleable *mode* — when on, the existing station map recolours from cheap/expensive semantics to pass-through leaderboard semantics (green = full, amber = partial, red = none, blue = price rose). Users can tap any station to see a detailed verdict with working.

When off, the app behaves as a normal fuel-price lookup tool.

## Key decisions (from brainstorming)

1. **Integration depth: deep + opt-in.** Station pin colours shift when excise mode is enabled. Not a standalone side tool — the map *is* the excise experience.
2. **Station → baseline mapping: nearest-of-27 + confidence indicator.** Every station always gets a verdict; distance from nearest baseline city surfaces as high/medium/low confidence. Station detail modal shows both the per-station verdict and the city-aggregate verdict.
3. **Live oil/AUD data: cron-refreshed Redis cache.** Daily Vercel cron hits Anthropic Messages API with `web_search_20250305` tool, writes `{brent_usd, aud_usd, as_of}` to Upstash Redis. Clients read via thin `/api/market-data` endpoint. Includes tasteful manual override on the explainer page for users who want to fiddle.
4. **Explainer: inline + dedicated page.** Short "show working" section in station detail modal; full methodology + worked example + baseline table at `/excise`. The latter doubles as SEO landing page (Part 3.1).
5. **Navigation:** desktop keeps inline header buttons (room exists); mobile ⋯ menu contains everything. New desktop pill `⛽ Excise: off/on` next to Trip Planner / Settings.

## Architecture

### Data layer (pure, framework-free)

- **`src/lib/excise/baselines.ts`** — constants: oil baseline, AUD baseline, excise cut, FX ratio, crude ratios (ULP 0.45, Diesel 0.50), and the 27-city `BaselineCity[]` array (name, state, lat/lng, ULP baseline cpl, diesel baseline cpl).
- **`src/lib/excise/calc.ts`** — pure `calcVerdict()` function. Translates the plan's formula directly. Input: pump price, fuel bucket, baseline city, live oil, live AUD. Output: expected price, oil impact, FX impact, passthrough cpl + %, verdict enum (`full | partial | none | price-rose`).
- **`src/lib/excise/nearest-baseline.ts`** — haversine lookup returning `{ city, distanceKm, confidence }`. Thresholds: <50km = high, 50–150 = medium, >150 = low.
- **`src/lib/excise/fuel-buckets.ts`** — maps FuelCode → ULP / DIESEL / N/A. Petrols (U91, E10, P95, P98) → ULP; DL, PD → DIESEL; LPG, E85, LAF → N/A (excluded from excise view).

### API layer

- **`GET /api/market-data`** — returns cached `{ brent_usd, aud_usd, as_of, fetched_at, source, stale }` from Redis key `market-data:v1`. No TTL (last-good value persists through failures); `stale: true` when `fetched_at` > 36h ago.
- **Extension to `src/app/api/cron/refresh/route.ts`** — adds a `refreshMarketData()` step. Calls Anthropic Messages API with the plan's proven web_search snippet; writes result to Redis. Wrapped in try/catch so failures don't kill station refresh. Requires `ANTHROPIC_API_KEY` env var on Vercel.

**Per-station verdict computation: client-side.** The stations endpoint is unchanged. When excise mode is on, the client fetches market-data once, then computes verdicts locally for visible stations using `nearestBaseline(lat, lng)` + `calcVerdict()`. ~100 stations × microseconds = negligible.

### UI layer

- **`src/lib/settings.ts`** — extends `UserSettings` with `exciseMode: boolean`, `exciseOilOverride?: number`, `exciseAudOverride?: number`.
- **`ExciseToggle.tsx`** — header pill (desktop) / menu item (mobile). Shows current state (`⛽ Excise: off` / `⛽ Excise: on`). Tapping toggles. "?" icon links to `/excise`.
- **`ExciseStatusBar.tsx`** — slim bar under header, visible only in excise mode. Shows `Excise mode • Oil $112.57 ↓2.1% • AUD 0.627 • 4h ago`. Amber dot + "data 2d old" when stale.
- **`MapView.tsx`** — modified to read excise mode from settings. When on:
  - Fetches `/api/market-data` once.
  - Recolours pins per verdict (full → green, partial → amber, none → red, price-rose → blue, N/A/missing-price → grey).
  - On tap, opens `StationExcisePopup` instead of the normal popup.
- **`StationExcisePopup.tsx`** — verdict badge, pass-through %, expandable "show working" (oil impact, FX impact, expected price, nearest baseline + confidence, station vs city-aggregate). Link: "Learn how this is calculated →" to `/excise`.
- **`/excise/page.tsx`** — full methodology page. Live oil + AUD with timestamp; formula with current values substituted; worked example; 27-city baseline table; ACCC link; manual override panel (session-only, writes to settings state, never persists past reload).

### Error handling

| Scenario | Behaviour |
|---|---|
| Fresh market-data | Normal operation |
| Stale market-data (>36h) | Works, amber dot + age label in status bar, warning banner on `/excise` |
| Market-data 500/network | Excise toggle disabled with tooltip; non-excise app unaffected |
| Anthropic cron fails | Last-good value persists; next cron retries; stale flag flips |
| Station missing price for selected fuel | Grey pin, no verdict |
| Station >150km from any baseline | Low-confidence badge in popup ("Baseline: Cairns, 187km away — rough estimate") |
| Manual override active | Status bar shows "⚙ manual override" |

No silent fallbacks — every degradation is visible. Misleading users about pass-through has real trust cost.

### Testing

- **Unit (Jest, already configured):**
  - `calc.test.ts` — all 5 sanity-check scenarios from plan + boundary thresholds + ULP vs Diesel divergence.
  - `nearest-baseline.test.ts` — known-distance fixtures (Darwin CBD, Tennant Creek, exact-baseline coords).
- **Integration:** `/api/market-data` route test with mocked Redis (fresh / stale / unreachable).
- **Skipped:** component tests (no RTL in project, out of scope), E2E (no Playwright, out of scope), cron-invocation tests (Vercel deployment concern).

## Close calls & decisions flagged for potential revisit

| # | Decision | Alternative considered |
|---|---|---|
| 1 | Extend existing cron route | Separate `/api/cron/refresh-market/` — rejected for Vercel cron quota + conceptual cohesion. |
| 2 | Import baselines module directly | Separate `/api/excise/baselines` endpoint — rejected as YAGNI; Next.js tree-shakes. |
| 3 | Same pin palette, remapped semantics | Distinct "excise-mode palette" — rejected because `ExciseStatusBar` provides persistent mode reminder. |
| 4 | Skip component tests | RTL setup — rejected as scope creep; pure logic layer is where bugs hurt. |
| 5 | No client retry loop for market-data | SWR revalidation — deferred; add if endpoint ever flakes. |

## Out of scope

- Pass-through leaderboard by city (Part 3.1 future work — aggregates anonymous usage data).
- Historical verdict timeline for a station.
- Notifications / alerts when a station flips verdict.
- SEO + Open Graph tags for `/excise` (will be added post-MVP before launch push).

## Success criteria

1. Toggle excise mode on → station pins recolour across the map within 500ms.
2. Tap a station in excise mode → detail popup shows verdict, pass-through %, expandable working, nearest baseline + confidence.
3. `/excise` page shows current live oil/AUD, full formula, and baseline table.
4. Manual override on `/excise` changes displayed verdicts without persisting past reload.
5. All 5 plan sanity-check scenarios pass as unit tests.
6. Cron refreshes market-data daily; stale indicator appears if fetch fails for >36h.
7. Non-excise mode UX is unchanged.
