# FuelSmart AU — itinerary-driven fill planning (plan only, 30 Oct 2026)

Goal as stated: plan a trip the way the Darwin→Toowoomba planner (Move HQ) does — ordered stops with dates — and have FuelSmart say exactly where to fill, how many litres, at what live price, for a given car's economy. This is the original purpose of FuelSmart; the pieces exist but are not joined.

Status: **plan, not build.** ~80 % of the thinking is here; nothing below has been coded. Pre-departure items are sized for Sat 31 Oct – Sun 1 Nov; departure is Mon 2 Nov.

## 0. Prerequisites from the verification report (`docs/plans/2026-10-30-fuelsmart-verification-report.md`)

The integration is worthless until F1 (stale prices in the planner) and F2 (intraday refresh dead) are fixed; F3 (map tiles) is cosmetic but is what you will look at on the road. All three are small.

| Fix | Effort | File |
|---|---|---|
| F1 stale-price guard (per-state max age; stale → excluded from planner/fill-up, badged on map) | 1–2 h incl. jest case in `src/lib/__tests__/trip-planner.test.ts` | `src/lib/trip-planner.ts`, `src/lib/fill-up/find-best-stop.ts`, `src/app/api/stations/route.ts` |
| F2 re-enable GitHub Actions schedule + verify secrets; push a commit | 10 min (Fred, in GitHub UI) | `.github/workflows/refresh-data.yml` |
| F3 basemap swap to OSM + dark CSS filter | 15 min | `src/components/MapView.tsx`, `src/app/globals.css` |
| F5 add `Z` to QLD timestamps | 5 min | `src/lib/fetchers/qld.ts` |

## 1. What exists already (hooks)

| Piece | Where | Reusable as-is? |
|---|---|---|
| Ordered via-points on the planner API (`via=lat,lng|lat,lng`) | `src/app/api/trip-plan/route.ts` | Yes — an itinerary is just an ordered via list |
| Google Maps share-link import → waypoints | `src/app/api/parse-gmaps/route.ts`, trip page "Import from Google Maps" | Yes — same shape (`{waypoints:[{label,lat,lng}]}`) the itinerary needs |
| Vehicle profiles (tank, consumption, jerry) | `src/lib/vehicles.ts` (localStorage) | Yes, add a "towing" variant |
| Three strategies, per-stop litres/cost/arrival fuel | `src/lib/trip-planner.ts` → `TripStop` in `src/lib/types.ts` | Yes |
| 7-day state/region forecast | `src/lib/forecast.ts`, `/api/forecast/region/[id]` | Partly — region level only |
| 35-day per-station history | `src/lib/history.ts`, `/api/history/station/[id]` | Yes, for "expected price on day N" |
| Deep link | only `/?station=<id>` on the map; trip page reads **no** URL params | No — must add |

## 2. Target design

### 2.1 Itinerary contract (the join between Move HQ and FuelSmart)

A single JSON document, producible by Move HQ (or any planner) and consumable by FuelSmart:

```json
{
  "version": 1,
  "vehicle": { "tankL": 45, "lPer100": 11.5, "jerryL": 40, "reserveL": 8, "fuel": "U91", "startFuelPct": 100 },
  "days": [
    { "date": "2026-11-02", "from": {"label":"Durack NT","lat":-12.48,"lng":130.98},
      "to":   {"label":"Daly Waters","lat":-16.25,"lng":133.37}, "via": [] },
    { "date": "2026-11-03", "from": {"label":"Daly Waters","lat":-16.25,"lng":133.37},
      "to":   {"label":"Mount Isa","lat":-20.725,"lng":139.494}, "via": [{"label":"Tennant Creek","lat":-19.647,"lng":134.19}] }
  ],
  "constraints": { "avoidTolls": true, "avoidAreas": ["Brisbane metro"] }
}
```

Each day is one planner leg; fuel at the end of day N is the `startFuel` of day N+1. Multi-night stops are simply days with no leg.

### 2.2 Fill plan output (what FuelSmart hands back)

Per day: ordered stops with station, address, litres to buy, price used, **price timestamp**, cost, fuel on arrival/departure, and a "confidence" (live price < 24 h / live but older / forecast). Plus per-day and whole-trip totals and a receipt-check column to fill in on the road.

### 2.3 Day-aware pricing

- Day 1–2: use live price (post-F1 guard).
- Later days: use live price as the estimate, flagged "expected"; where the station's 35-day history exists, show its min/median/max so the number is honest. A region-level forecast adjustment (`src/lib/forecast.ts`) can come later — remote NT/QLD roadhouses barely cycle, so the live price is already a good predictor there; it is the coastal QLD towns (Cairns, Bundaberg, Toowoomba) with price cycles where the forecast matters.
- Re-run nightly: the plan is recomputed every evening from the current position; the "Optimised" plan for tomorrow is what you act on.

### 2.4 Reserve and remote-leg logic (the towing case)

- Reserve expressed in litres (not % of tank+jerry) — 8 L on a 45 L tank is the floor.
- Jerry cans modelled as a separate pool: only filled when the next gap exceeds tank range, not at every stop (saves carrying 40 L of 290 c/L Barkly fuel to Mt Isa where it is 237.5).
- A leg whose gap exceeds tank+jerry usable range is a hard error, not a warning string.

## 3. Phasing

### Phase A — usable by Sunday 1 Nov (≈ 4–6 h, in-session, Claude Code)

| Step | What | Done when |
|---|---|---|
| A0 | Fixes F1, F2, F3, F5 above | Map renders, planner excludes any price > 7 days old, `/api/meta` shows fresh stamps every ~15 min |
| A1 | Trip page reads URL params: `?origin=&dest=&via=&tank=&consumption=&jerry=&fuel=&reservePct=&startFuel=` and auto-runs | Pasting a link shows the plan without typing |
| A2 | A one-page "FuelSmart link" generator inside the existing Move HQ artifact (or a plain text block in it): for each driving day, a prefilled link per §A1 | Each day's card in Move HQ has a "Plan fuel" link |
| A3 | Vehicle preset "RAV4 towing camper" (45 L, 11.5 L/100, 40 L jerry) saved via `vehicles.ts` | One click on the trip page |
| A4 | A printable/offline fallback: run every day's plan on Sunday night, export to a single markdown/PDF in `docs/plans/` (station, litres, price, timestamp) — Telstra drops out on the Barkly | File on your phone before departure |

Phase A gives you the thing you asked for, in the form "open today's link, read the stops". It does not carry fuel-level over between days (you type `startFuel` each morning from the gauge — arguably better than a model).

### Phase B — post-move (≈ 2–3 days)

| Step | What |
|---|---|
| B1 | `POST /api/itinerary-plan` accepting the §2.1 document; loops `planTripComparison` per day with carried-over fuel; returns §2.2 |
| B2 | Itinerary page `/itinerary` with day tabs, map, and the receipt-check column (device-local, like the logbook) |
| B3 | Jerry-can pool model and litre-denominated reserve (§2.4) with jest cases on the Katherine→Mt Isa and Three Ways→Mt Isa legs |
| B4 | Day-aware pricing: history band per station, forecast adjustment for cycling regions |
| B5 | Routing constraints: `exclude=toll`, avoid-areas via ORS, "inland after Townsville" presets |
| B6 | Move HQ ↔ FuelSmart sync: Move HQ exports the §2.1 JSON (shared-storage capability or copy/paste); FuelSmart imports it on `/itinerary` |
| B7 | Replace GitHub cron dependency: Vercel Pro cron, or a Cloudflare Worker cron hitting `/api/cron/refresh` — anything without the 60-day inactivity switch |

### Explicitly not planned

- Khuller-style DP replacing the greedy planner (within 0.1 % on the measured leg — not worth it yet).
- A native app.

## 4. Open questions (answer when convenient; defaults in brackets)

1. Day-by-day itinerary for 2–17 Nov: confirm the driving days and overnight points so A2/A4 can be generated. [Default: Durack → Daly Waters → Tennant Creek/Three Ways → Mt Isa → Hughenden → Mareeba (Tablelands 2 nights) → inland via Charters Towers/Clermont → Orion (1 night) → Bundaberg (2 nights) → Toowoomba.]
2. Fuel for the RAV4: U91 with LAF fallback accepted? (LAF is the only unleaded in Katherine, Tennant Creek and Camooweal.) [Default: yes.]
3. Move HQ: is it still a claude.ai artifact with the shared-storage fault unresolved? If so A2 is a text block, not live data. [Default: text block.]
4. Does the MyFuel NT `serverJson` carry a report timestamp? Determines whether F4 is fixable. [Default: label as snapshot.]

## 5. Monetisation and scaling flag

This is the product nobody else ships: tow-profile, reserve-aware, multi-day fill planning for remote Australia. PetrolSmart and PetrolSpy show pins; neither answers "where do I fill tomorrow with a 45 L tank and a camper on the back". The market is grey nomads, caravan clubs, 4WD tourers and fleet relocations — a $5–8/month "Trip Pro" tier or a one-off per-trip plan ($10–15) with the printable offline pack as the hook. Partnerships: caravan park chains, Hema/WikiCamps, RACQ/AANT. The data pipeline is already national; the itinerary contract in §2.1 is the API a partner would integrate. Cost side is near zero (Vercel Hobby + Upstash + public OSRM) until volume forces an ORS/Valhalla key.
