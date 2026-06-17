# Regional granularity — design (for sign-off)

**Date:** 2026-06-16
**Status:** PLAN ONLY — build after sign-off.
**Why:** Australian fuel-price *cycles* are metro-specific (Brisbane and regional QLD move on different rhythms), so a whole-state average blends a sawtoothing capital with flat country towns into mush — coarse for the chart and actively muddy for the forecast. Adding a region dimension makes both sharper, and is the thing users mean by "prices vary wildly by region."

## v1 scope
Two buckets per state — **Metro** (capital city) vs **Regional** (rest) — with ACT as a single region. Deliberately simple, but the plumbing is **region-agnostic**: the snapshot stores per-`regionId` aggregates and the UI lists whatever regions exist, so finer named regions (Hunter, Cairns, etc.) drop in later by changing one function, with no re-plumbing.

> Separate, NOT in this spec: the "tap an area on the map → live average here" idea. That's a live, on-the-fly aggregation over the currently-cached stations (no storage, no forecast) — a nice map feature to spec on its own. This spec is specifically the **history + forecast** granularity, which needs stable, pre-aggregated series.

---

## 1. Region definition — `lib/regions.ts` (new)

```ts
export interface Region { id: string; label: string; state: StateCode; }
export function regionOf(station: Station): string;   // -> regionId
export function regionsForState(state: StateCode): Region[];
export const REGIONS: Region[];
```

- **v1 rule:** `regionOf` returns `"<STATE>-metro"` if the station is within R km of the state capital (haversine on the lat/lng we already store), else `"<STATE>-regional"`. ACT → `"ACT"` (single region).
- **Capitals + radius table** (lat/lng + default 60 km commuter belt): Sydney, Melbourne, Brisbane, Adelaide, Perth, Hobart, Darwin; ACT = whole territory.
- **Why distance, not postcodes, for v1:** no lookup table to build/maintain, uses coordinates every station already has, and captures the one split that matters most for forecasting. Finer named regions later = extend `regionOf` + `REGIONS` only.
- **Edge cases:** missing/insane coords → fall back to `"<STATE>-regional"` (still counted in the state aggregate regardless). Region ids embed the state so they're globally unique.

## 2. Snapshot — `lib/history.ts` (extend)

- New key **`history:region:<date>`** → `{ [regionId]: { [fuel]: {avg,min,count} } }`, written with the existing **STATE_TTL (~13 months)**.
- `recordDailySnapshot` gains a third accumulator keyed by `regionOf(station)`, computed in the same loop as the state aggregate — one extra `redis.set`. Footprint is trivial (≤ ~16 regions × 9 fuels × 400 days).
- New read helper `getRegionHistory(regionId, fuel, days)` mirroring `getStateHistory`.
- (Optional, later) `mergeRegionDay` mirroring `mergeStateDay`, for regional backfill.

## 3. API (new routes, mirror the state ones)

- `GET /api/history/region/[id]?fuel=&days=` → `{ region, fuel, series }` (same `StatePricePoint[]` shape).
- `GET /api/forecast/region/[id]?fuel=` → runs `buildForecast` on the region series.
- Both validate `id` against the `REGIONS` registry (400 otherwise).

## 4. Forecast — no model change

`buildForecast` already takes a generic history series, so it's scope-agnostic: the region endpoint just feeds it the region's series. Bonus — cleaner, single-cycle metro series should make the forecast *more* accurate than the blended state average.

## 5. UI — `/history` page (extend)

- Add a **region sub-selector** under the state buttons: `Whole state · Metro · Regional` (from `regionsForState(selectedState)`). Default = **Whole state** (today's behaviour, unchanged).
- When a region is picked, the existing fetch swaps `/state/<code>` → `/region/<id>` for both history and forecast. Everything else (chart, outlook card) is unchanged.

## 6. Backfill note

Regional backfill is feasible from the *same* open-data CSVs (they carry postcode + lat/lng → `regionOf`), if/when the QLD egress issue is solved. Not part of v1 — and remember the live cron will be accruing regional history from the deploy onward anyway.

## 7. Timing — ship the bucketing soon

The moment region bucketing is in the live snapshot, **regional history starts accruing on the same ~3-week clock** as the state-level data. Adding it later just restarts that clock. So even though the *forecast* needs weeks to ripen, the bucketing change is worth landing early.

## 8. Effort + sequence

`regions.ts` → extend `history.ts` → 2 API routes → `/history` sub-selector → tests (region classification + aggregation). **~2–2.5 days.** Backward-compatible and additive — existing state endpoints/keys untouched.

---

## Open questions for sign-off

1. **v1 granularity:** Metro vs Regional per state — enough to start? Or do you want **named country regions** (Hunter, North Coast, Gold Coast…) now? That needs a postcode→region table and pushes effort up; I'd recommend metro/regional first, refine later.
2. **Metro radius:** 60 km default OK, or tune per state (Sydney's commuter belt is bigger than Hobart's)?
3. **Multi-metro states:** v1 gives each state one metro. Want a second metro for QLD (Cairns/Townsville) or WA later?
4. Confirm **"Whole state" stays the default** view (region is opt-in).

---

# v2 — resolved decisions (supersedes §1 and the open questions above)

Decisions: (1) named regions, ambitious; (2) tune per state; (3) ABS-density-informed metros; (4) default to the region nearest the map centre.

These collapse into **one scheme: named-hub anchors**, ABS-grounded, classified by lat/lng.

## Region model — `lib/regions.ts`
- A curated **anchor table** per state: `{ id, label, state, lat, lng, catchmentKm, kind: "metro" | "regional" }`.
  - Capital anchor = the **metro** region, labelled "Greater \<Capital\>" (kept as ONE region — the metro cycles as a unit; do NOT split it into sub-areas).
  - Regional anchors = named towns/cities (Newcastle, Wollongong, Coffs Harbour, Wagga, Cairns, Townsville, Geelong, Bunbury, Launceston, …), **chosen from ABS Significant Urban Areas / population** so the set is principled, not arbitrary. (This is where Q3's "ABS density" lands — secondary cities each become their own named region.)
- `regionOf(station): regionId` = nearest anchor within its `catchmentKm`; beyond every catchment → `"<STATE>-rest"` ("Rest of \<state\>").
  - Uses **lat/lng**, deliberately — WA's feed (and some QLD rows) have no postcode, so a postcode→region table would fail there. Coordinates are on every station.
  - Q2 "tune per state" → realised as per-anchor `catchmentKm` (Sydney's catchment > Hobart's).
- `nearestRegion(lat, lng): regionId` = same nearest-anchor maths; powers the Q4 default.
- Attribute ABS (CC-BY) for the hub selection, per the compliance register.

**Why anchors over ABS SA4 polygons:** SA4 over-splits the metro (≈15 SA4s in Greater Sydney all share one price cycle → fragmented, thin, muddier forecast) and needs bundled boundary geometry + point-in-polygon. Anchors give recognisable names, ABS-grounded selection, lat/lng classification (handles missing postcodes), and reuse for the map-centre default. SA4 polygons remain a possible later upgrade if statistical rigor is wanted.

## Snapshot / API / forecast — as before, keyed by these richer regionIds
- `history:region:<date>` → `{ [regionId]: { [fuel]: {avg,min,count} } }`, STATE_TTL (~13mo).
- **Thin-region rollup:** a region with fewer than `MIN_REGION_STATIONS` reporting that day folds into `"<STATE>-rest"` so averages aren't noisy on 2–3 stations.
- `/api/history/region/[id]`, `/api/forecast/region/[id]`. Forecast model unchanged (scope-agnostic).

## UI — `/history`
- Region becomes a **grouped dropdown** (too many for a button row): `Whole state` · `Greater <Capital>` · regional hubs… for the selected state.
- **Default selection = region nearest the last map centre** (persisted to localStorage by the map on move), else `Whole state`. A tiny resolve (`nearestRegion`, or `/api/region/nearest?lat=&lng=` over cached stations) picks it on load; graceful fallback.

## Scope + honest caveats
- **~3.5–4 days** (was ~2.5). The added work: curating + validating the ABS-grounded hub list, thin-region rollup, the dropdown UI, and the map-centre default plumbing.
- Named regions will be **visibly sparse for ~3 weeks** until live history accrues (backfill shelved) — correct structurally, thin at first.

## New open questions (for sign-off before build)
1. I'll draft the **hub list per state** from ABS SUAs (~6–12 per big state, fewer for TAS/NT/ACT) for you to eyeball before build — OK?
2. `MIN_REGION_STATIONS` rollup threshold — start at ~5 reporting/day?
3. Confirm the **anchor model** over the ABS-SA4-polygon model.
