# FuelSmart AU — ship the 30 Oct changes (paste into Claude Code)

Everything below is already in the working tree at `C:\Users\bdoecke\projects\Development\fuelsmart-au`. Nothing is committed or pushed. The Vercel site rebuilds on push to `main`.

## What changed (14 modified, 7 new)

| Area | Files | Effect |
|---|---|---|
| Stale-price guard | `src/lib/price-age.ts` (new), `src/lib/trip-planner.ts`, `src/lib/fill-up/find-best-stop.ts`, `src/app/api/stations/route.ts`, `src/app/api/trip-plan/route.ts` | Prices older than the state's limit (NT/WA 3 d, VIC 4 d, others 7 d) are ignored by the planner, fill-up finder and map. Fixes the United Cardwell 174.9 c/L (Sep 2025) fill |
| Timestamps | `src/lib/fetchers/qld.ts` | QLD `TransactionDateUtc` now carries a `Z` so browsers stop parsing it as local time |
| NT tomorrow price | `src/lib/fetchers/nt.ts`, `src/lib/types.ts`, `src/components/TripResults.tsx` | Captures MyFuel NT's `PriceScheduled` (tomorrow's locked price, published from 2:30 pm) as `StationPrice.scheduled`; stop cards show "Tomorrow x c/L" when it differs |
| Map tiles | `src/components/MapView.tsx`, `src/app/globals.css` | CARTO (now key-walled) replaced by OpenStreetMap raster; dark palette via CSS invert |
| Road trip fuel plan page | `src/app/itinerary/page.tsx`, `src/lib/itinerary.ts`, `src/lib/itinerary-presets.ts` (new), `src/app/page.tsx` | `/itinerary`: the 4 Trip Planner route options + blank, add/remove/reorder stops, nights, RAV4 towing defaults, "Calculate best stops" (one `/api/trip-plan` call, only on demand), fill plan grouped by leg with cans-needed flags, then the usual map/strategy cards. Draft saved in `localStorage` key `fuelsmart-itinerary-v1`. Linked from the home panel and the More menu |
| Cron | `vercel.json` | Second daily refresh at 05:30 UTC (15:00 ACST) so the NT 2:30 pm prices are picked up |
| Tests | `src/lib/__tests__/price-age.test.ts` (new), `src/lib/__tests__/trip-planner.test.ts`, `src/lib/fill-up/__tests__/find-best-stop.test.ts` | Staleness regression (Cardwell), timestamp parsing; fill-up fixture given a live timestamp |
| Docs | `docs/plans/2026-10-30-fuelsmart-verification-report.md`, `docs/plans/2026-10-30-fuelsmart-itinerary-integration-plan.md`, this file | Verification and plan |

Verified in the cloud workspace: `tsc --noEmit` clean, `jest` 336 passed / 3 failed (the three are the pre-existing live-network fetcher tests `nt.test.ts`, `qld.test.ts`, `wa.test.ts`, which cannot reach the internet from there — they should pass on your machine), `eslint` clean on the new files, `/itinerary` rendered and exercised with Playwright. `next build` could not complete there only because Google Fonts is unreachable from that sandbox.

## Prompt for Claude Code

```
cd C:\Users\bdoecke\projects\Development\fuelsmart-au

1. Run `npx tsc --noEmit`, `npx jest`, `npx eslint src/app/itinerary src/lib/itinerary.ts src/lib/price-age.ts` and `npx next build`. All must pass (jest's nt/qld/wa fetcher tests hit live APIs; they may fail only if offline).
2. Delete the folder `_to_delete\` (it holds a temporary source snapshot, nothing else).
3. Commit everything in two commits:
   a. fix: ignore stale prices in planner/fill-up/map; QLD UTC stamps; OSM tiles; NT scheduled price
   b. feat: /itinerary road-trip fuel plan with route presets and leg-by-leg fills
   Each commit message ends with:
   Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01JzGVbiLtsgsZwnySzyBCfk
4. Push to origin main and report the Vercel deployment URL/status.
5. GitHub Actions: run `gh workflow list -R fritterburner/fuelsmart-au` and `gh run list -R fritterburner/fuelsmart-au --workflow refresh-data.yml --limit 3`. If "Refresh fuel data" shows as disabled (GitHub turns off schedules after 60 days without commits), run `gh workflow enable refresh-data.yml -R fritterburner/fuelsmart-au`, then `gh workflow run refresh-data.yml -R fritterburner/fuelsmart-au` and confirm the run succeeds (it needs the APP_URL and CRON_SECRET repository secrets — `gh secret list -R fritterburner/fuelsmart-au`).
6. Report back: commit SHAs, deployment status, workflow state before/after, and the JSON the refresh run printed.
```

## After it deploys — 3-minute check on the phone

1. `https://fuelsmart-au.vercel.app/` — map tiles render (no "API KEY REQUIRED").
2. `https://fuelsmart-au.vercel.app/itinerary` — pick **Outback**, press **Calculate best stops**. Expect ~30 s, then a leg-by-leg list. No stop should quote a price under ~225 c/L anywhere north of Rockhampton; if one does, note the station and timestamp.
3. After 2:30 pm ACST, open any NT stop card — a blue "Tomorrow … c/L" chip should appear where tomorrow's price differs (only after the next refresh has run; the 15:00 ACST cron or the 15-minute Action).
4. `https://fuelsmart-au.vercel.app/api/meta` — timestamps should now be within ~20 minutes if the Action is alive.

## Not done (post-move, see the integration plan)

Per-day re-planning with carried-over fuel, litre-denominated reserve and a separate jerry-can pool, day-aware pricing from history/forecast, toll/Brisbane avoidance, Trip Planner artifact ↔ FuelSmart sync, replacing the GitHub schedule with something that has no inactivity switch.
