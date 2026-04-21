# Fill-Up Finder — click-A-click-B cheapest-fuel recommendation

**Date:** 2026-04-21
**Goal:** Let a user drop two pins on a map (A → B) and get one clear answer: *"this is where you should fill up this afternoon."* Recommendation factors in the detour km needed to reach each candidate station, so a station that is 5 c/L cheaper but 8 km off-route doesn't win when the detour fuel eats the saving.

---

## Scope

A **simpler sibling** to the existing `/trip` multi-stop planner. The mental model is different:

| Feature | `/trip` (existing) | `/fill-up` (new) |
|---|---|---|
| Input | Origin + dest + vias + tank state + arrival prefs | A + B on a map |
| Question it answers | "How do I get from A to B with enough fuel, stopping as little as possible?" | "I'm going from A to B this afternoon and will fill up along the way — where?" |
| Tank / range logic | Core constraint | Ignored (assumes one fill is enough) |
| Output | 3 strategies, waypoints, cost per litre summary | One winner + shortlist + map |

No overlap of code beyond shared helpers (`haversine`, `getCachedStations`, OSRM client).

---

## UX flow

1. User opens `/fill-up` (new route; linked from main `/` three-dot menu).
2. Full-screen Leaflet map, same base tiles as the main map. A top bar reads:
   - *"Tap where you're starting from"* → they tap → pin A drops.
   - *"Tap where you're heading"* → they tap → pin B drops.
3. Inline controls under the bar:
   - Fuel type (inherited from main page / header; read-only badge, click to change).
   - Fill size input, default = `settings.tankSize` L, editable 5–200.
   - "Find the best stop" button (disabled until both pins placed).
4. On submit: spinner, map recentres to fit both pins + winning station.
5. Results card (bottom sheet on mobile, side panel on desktop):
   - **Winner**: station name, suburb, price c/L, detour km, total-trip fuel cost, savings vs the cheapest on-route station.
   - **Shortlist** (up to 4 others): same info, collapsed by default.
   - Footer: `Edit pins` button to re-drop, `Back to map` link.
6. Error states:
   - No stations in corridor → "No fuel stations along this route — try expanding the search or picking different points."
   - OSRM down → "Routing service unavailable, try again in a moment."
   - A == B (or within 1 km) → "Pick two different points at least 1 km apart."

---

## Architecture / files

```
src/app/fill-up/
├── page.tsx                    (NEW — client component; map + form + results)
└── FillUpMap.tsx               (NEW — dynamic-imported leaflet subcomponent)

src/app/api/fill-up/
└── route.ts                    (NEW — POST endpoint; does the heavy lifting)

src/lib/fill-up/
├── find-best-stop.ts           (NEW — pure logic: filter, rank, pick)
├── osrm.ts                     (NEW — thin OSRM client; extracted from trip-planner.ts if clean)
└── __tests__/
    └── find-best-stop.test.ts  (NEW — covers ranking, ties, degenerate inputs)

src/components/
└── (link added to the three-dot menu in page.tsx)
```

Reuses (no modification):
- `getCachedStations()` from `src/lib/cache.ts`
- `haversine()` from `src/lib/haversine.ts`
- `toFuelBucket()` / fuel-fallback logic from `src/lib/excise/fuel-buckets.ts`
- `loadSettings()` for tankSize + consumption defaults

---

## Algorithm

### Inputs (API POST body)

```ts
{
  a: { lat: number, lng: number },
  b: { lat: number, lng: number },
  fuel: FuelCode,          // from header
  fillLitres: number,      // default tankSize
  consumption: number,     // L/100km from settings
}
```

### Server-side flow

```
1. Validate inputs (distinct points, positive litres, valid fuel).

2. Get cached stations + filter by fuel availability (with fallback chain).

3. Compute direct route:
     direct = OSRM(a → b)
     directKm = direct.distance / 1000

4. Corridor pre-filter (cheap, narrows candidates before expensive OSRM):
     For each station:
       bbox check: within expanded A/B bounding box (20 km margin)
       perp check: pointToSegmentDist(station, a, b) ≤ 15 km
     Keep only stations matching both.

5. Top-N-by-price pre-filter:
     Sort by c/L ascending. Keep top 15.
     (These are our OSRM-worthy candidates — anything more expensive can't
      beat the cheapest without a negative detour, which is impossible.)

6. For each candidate (parallel, Promise.all):
     viaRoute = OSRM(a → station → b)
     detourKm = viaRoute.distance/1000 - directKm
     detourFuelCost  = detourKm × (consumption/100) × stationPrice
     fillCost        = fillLitres × stationPrice
     totalCost       = fillCost + detourFuelCost
     netVsOnRouteMin = (onRouteCheapestPrice − stationPrice) × fillLitres − detourFuelCost

7. Sort candidates by totalCost ascending. Pick winner = candidates[0].
   Shortlist = candidates[1..4] (up to 4 more).

8. Also compute the "naive cheapest on-route" (detour ≤ 0.5 km) for savings comparison.

9. Return:
     {
       a, b, directKm,
       fuel,                        // may be fallback code if header fuel unavailable
       fallbackNotice: string|null, // "U91 not available here; showing LAF"
       winner: CandidateResult,
       shortlist: CandidateResult[],
       onRouteCheapest: CandidateResult|null,   // for savings framing
       savingsVsOnRoute: number                 // winner.totalCost - onRouteCheapest.totalCost
     }
```

### Why this is safe on Vercel

- Max 16 OSRM calls (1 direct + 15 candidates), run in parallel → latency ≈ slowest single call (~500ms on `router.project-osrm.org`).
- Total request budget well under Vercel's 10s default.
- No Redis writes — read-only lookup of the stations blob.

---

## Edge cases handled

- **A and B very close (<1 km)**: reject with 400. This isn't a route, it's a nearby search, which is what the main `/` page already does.
- **No stations in corridor**: return 200 with `winner: null` and a friendly message.
- **Selected fuel unavailable at every candidate**: use existing fallback chain (`U91 → LAF → OPAL` etc.) and surface `fallbackNotice`.
- **OSRM returns a route that isn't meaningfully longer via station** (detourKm < 0 due to OSRM quirk): clamp to 0.
- **Extreme long routes** (say Darwin → Sydney, 4000 km): corridor would be huge and full of stations. Cap corridor pre-filter candidates at 200 before top-15 price sort, to avoid projecting thousands of stations.

---

## Testing

- Unit tests on `find-best-stop.ts` with mocked OSRM responses:
  - winner picks truly cheapest total (not lowest c/L when detour dominates)
  - ties broken by lower c/L then alphabetical by name
  - empty candidate list → `winner: null`
  - corridor filtering (station 50 km off-route excluded)
  - fallback fuel chain applied
- Integration-ish test on the API route with a fixed station list + mocked OSRM, verifying JSON shape.
- No live HTTP in tests.

---

## Out of scope (deliberate YAGNI)

- Multi-waypoint (that's `/trip`'s job).
- Time-of-day cost / opening hours (data not reliable enough in our cache).
- Traffic-aware routing (OSRM public server doesn't support it).
- Return-trip toggle (covered by `/trip`).
- "Best station for my weekly driving" (needs history we don't collect).
- Map drag-to-adjust pins (MVP uses click-to-re-drop only).

---

## Open for sign-off

- Page name `/fill-up` (alternative: `/best-stop`, `/route-fuel`) — current pick matches "this afternoon I'm going to fill up".
- Corridor threshold 15 km perp / 20 km bbox margin — narrows fast without missing reasonable detour candidates.
- Top-15 price pre-filter before OSRM — caps worst-case cost.
