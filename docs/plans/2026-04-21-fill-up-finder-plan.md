# Fill-Up Finder Implementation Plan

> **For Claude:** Execute in order, committing after each numbered task. Tests before impl where the skill fits; UI tasks are structural, so commit after each route works end-to-end.

**Goal:** Build the "click A → click B → here's where to fill up" feature described in `2026-04-21-fill-up-finder-design.md`.

**Architecture:** Pure-logic core (`find-best-stop.ts`) + thin OSRM client + Next 16 API route + Leaflet client page. No changes to `/trip`.

**Tech Stack:** Next.js 16.2.2, TypeScript, Leaflet (react-leaflet), Jest.

---

### Task 1 — Shared OSRM client

**Files:**
- Create: `src/lib/fill-up/osrm.ts`

Thin wrapper around the public OSRM endpoint, used by both the `/api/fill-up` route and (later) any other feature that needs via-routes. Two functions:

- `osrmRoute(coords: [lat,lng][], opts?)` → `{ distanceKm, durationMin, geometry }`
- `OSRM_BASE` exported for tests to override if needed

Keep it minimal — a single `fetch` call that throws on non-Ok. No retry logic (failure bubbles to the caller, which returns a 503).

**Commit:** `feat(fill-up): shared OSRM client helper`

---

### Task 2 — Pure find-best-stop logic

**Files:**
- Create: `src/lib/fill-up/find-best-stop.ts`
- Create: `src/lib/fill-up/__tests__/find-best-stop.test.ts`

`find-best-stop.ts` exports `findBestStop(input, deps)` where `deps` takes `{ osrmRoute }` so tests can inject a mock.

**Input:**
```ts
interface FindBestStopInput {
  a: { lat: number; lng: number };
  b: { lat: number; lng: number };
  stations: Station[];        // pre-fetched from cache
  fuel: FuelCode;
  fillLitres: number;
  consumption: number;        // L/100km
}
```

**Algorithm** (matches design doc §Algorithm):
1. Resolve fuel with fallback chain; record `fallbackNotice` if applied.
2. Reject stations without that fuel. Keep only those within bbox-margin(a,b, 20km) AND `pointToSegmentDist ≤ 15 km`. Cap to 200.
3. Sort by c/L, take top 15.
4. `directRoute = await osrmRoute([a, b])`.
5. In parallel: `viaRoute = osrmRoute([a, station, b])` per candidate.
6. Compute `detourKm`, `detourFuelCost`, `fillCost`, `totalCost` per candidate.
7. Rank by `totalCost` ascending. Winner = [0]. Shortlist = [1..4].
8. `onRouteCheapest` = lowest-total-cost candidate with `detourKm ≤ 0.5`.
9. Return `{ directKm, fuelUsed, fallbackNotice, winner, shortlist, onRouteCheapest, savingsVsOnRoute }`.

**Tests** (mock `osrmRoute` with a function that returns distances based on coords):
- Happy path: 3 stations, winner is not cheapest c/L because detour swings it.
- Empty input → `winner: null`.
- Single station → it wins.
- Fuel fallback: primary unavailable, fallback chain kicks in, `fallbackNotice` set.
- Corridor filter: station 50 km off-route is excluded before OSRM call (verify mock OSRM called N times not N+1).
- Negative detour (OSRM quirk where via is shorter) clamped to 0.

**Commit:** `feat(fill-up): pure find-best-stop logic + tests`

---

### Task 3 — API route

**Files:**
- Create: `src/app/api/fill-up/route.ts`

POST endpoint. Validates JSON body, calls `getCachedStations()`, calls `findBestStop()`. Returns JSON result or appropriate error status:
- 400: missing fields, a/b within 1 km, fillLitres out of range.
- 503: OSRM error or Redis unavailable.
- 200: success (winner may be null if no candidates).

`maxDuration = 30` for the 16 parallel OSRM calls worst case.

**Commit:** `feat(fill-up): POST /api/fill-up route`

---

### Task 4 — Client page + map

**Files:**
- Create: `src/app/fill-up/page.tsx`
- Create: `src/app/fill-up/FillUpMap.tsx`

`page.tsx` is a "use client" page:
- State: `a`, `b`, `placingState` ("a" | "b" | "done"), `fuel` (from localStorage settings.defaultFuel as first paint fallback, can change via small select), `fillLitres` (default `settings.tankSize`), `consumption` (from settings), `result`, `loading`, `error`.
- Top bar with instructions and fuel/fill controls.
- Dynamic-imported `<FillUpMap>` (ssr:false) — Leaflet map that calls `onPointClick(lat,lng)`. Also receives `a`, `b`, `winnerLatLng` to render pins + a winner ring.
- "Find best stop" button fires `POST /api/fill-up`.
- Results card at bottom (fixed on mobile, side panel on md+).
- "Edit pins" → clears `b` then `a` (resets to placing state).
- "Back to map" → link to `/`.

`FillUpMap.tsx`:
- Leaflet MapContainer with tile layer, saved-position restore (reuse MAP_POS_KEY pattern from MapView).
- `useMapEvents.click` → calls `onPointClick(e.latlng.lat, e.latlng.lng)`.
- Two coloured pin icons (green "A", red "B"). Winner station icon if provided.
- Route polyline if `geometry` provided (from result).

**Commit:** `feat(fill-up): /fill-up page with two-click map placement`

---

### Task 5 — Nav link

**Files:**
- Modify: `src/app/page.tsx` (three-dot menu)

Add a menu item "🚏 Where should I fill up?" linking to `/fill-up`. Slot it above the "Compare" item or below "Trip Planner" — somewhere that reads as casual-use-first.

**Commit:** `feat(nav): link to fill-up finder from main menu`

---

### Task 6 — Verify + ship

- `npx tsc --noEmit`
- `npx jest` (expect pre-existing qld test fail only)
- `npx next build` — clean
- Push

**Commit messages:** already done per task.

---

## Out of scope for this iteration

See design doc §Out of scope. Worth revisiting after user feedback:
- Drag-to-adjust pins
- "Save this trip" history
- Return-trip toggle in this tool (user can use `/trip` for that)
