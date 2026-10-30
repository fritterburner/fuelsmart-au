# FuelSmart AU — verification report (30 Oct 2026)

Live site `https://fuelsmart-au.vercel.app`, source at `C:\Users\bdoecke\projects\Development\fuelsmart-au` (HEAD `d350236`, 28 Jul 2026). Checks run 08:30–08:45 ACST, Fri 30 Oct 2026, from the browser pane plus a read-only source audit. All prices in cents per litre.

## 1. Verdict at a glance

| Area | Status | One-line finding |
|---|---|---|
| Price accuracy vs scheme data | **PASS** | 19 of 20 station/fuel pairs identical to the NT/QLD mandatory-scheme data (via PetrolSpy republication); the one delta (1.0 c/L) is explained by snapshot age |
| Data freshness | **FAIL** | Every state stamped `2026-10-29T20:59Z` = the once-daily Vercel cron. The 15-minute GitHub Actions refresh is not running |
| Trip planner optimality | **PASS** | Katherine→Mt Isa: app $373.56 vs independent DP optimum $373.15 (0.1 %) |
| Trip planner data hygiene | **FAIL** | Optimised plan for the full trip buys 76.5 L at a station whose price is 13.5 months old |
| Map basemap | **FAIL** | CARTO tiles now watermark "API KEY REQUIRED" (`src/components/MapView.tsx` line 716) |
| Discounts, running-cost compare, geocode, deep link, station history | PASS | Pages render, APIs 200, no console errors except one 404 (see §6) |
| SA feed | Not live | `/api/meta` shows `SA: null`; `/data-freshness` page says SA is "newly connected" — copy is ahead of reality |

## 2. Price comparison — app vs scheme data

Reference source: NT (MyFuel NT) and QLD (Fuel Price Reporting) scheme data as republished by PetrolSpy's station JSON (`petrolspy.com.au/webservice-1/station/box`), retrieved 08:38–08:42 ACST. The government consumer sites are JavaScript shells and could not be fetched directly; data.nt.gov.au / data.qld.gov.au publish only monthly historical CSVs. App values from `/api/stations` at 08:35 ACST (snapshot taken 06:29 ACST).

| Town | Station | Fuel | App | Scheme (PetrolSpy) | Δ |
|---|---|---|---|---|---|
| Katherine | United Katherine (Pieface) | LAF | 236.5 | 236.5 | 0 |
| Katherine | United Katherine (Pieface) | DL | **282.5** | **281.5** | **−1.0** (see note) |
| Katherine | BP Katherine | LAF | 244.2 | 244.2 | 0 |
| Daly Waters | Hi-Way Inn | LAF / DL | 260.9 / 295.9 | 260.9 / 295.9 | 0 |
| Dunmarra | Dunmarra Roadhouse | LAF / DL | 265.0 / 295.0 | 265.0 / 295.0 | 0 |
| Tennant Creek | Lone Star (Ampol) | LAF | 255.9 | 255.9 | 0 |
| Tennant Creek | BP Complex | LAF / DL | 279.9 / 307.9 | 279.9 / 307.9 | 0 |
| Three Ways | Threeways Roadhouse | LAF | 283.0 | 283.0 | 0 |
| Barkly Hwy | Barkly Homestead | U91 / DL | 289.0 / 315.0 | 289.0 / 315.0 | 0 |
| Camooweal | Caltex/Puma Camooweal | LAF / DL | 287.9 / 311.9 | 287.9 / 311.9 | 0 |
| Mount Isa | Astron Mount Isa | U91 / DL | 237.5 / 269.9 | 237.5 / 269.9 | 0 |
| Mount Isa | Reddy Express Truckport | U91 / DL | 256.9 / 283.9 | 256.9 / 283.9 | 0 |
| Cloncurry | BP Cloncurry | U91 / DL | 271.9 / 293.9 | 271.9 / 293.9 | 0 |
| Hughenden | Flinders Star | U91 / DL | 249.9 / 279.9 | 249.9 / 279.9 | 0 |
| Hughenden | BP Lights On The Hill | U91 / DL | 259.9 / 286.9 | 259.9 / 286.9 | 0 |
| Mareeba | BP Mareeba | U91 / DL | 249.9 / 287.9 | 249.9 / 287.9 | 0 |
| Emerald | Ampol Foodary Emerald | U91 / DL | 255.9 / 279.9 | 255.9 / 279.9 | 0 |
| Bundaberg | Freedom Fuels | U91 / DL | 229.3 / 273.3 | 229.3 / 273.3 | 0 |
| Toowoomba | U-Go Central | U91 | 230.5 | 230.5 | 0 |

Note on the Katherine diesel delta: the app's NT snapshot is from 06:29 ACST; PetrolSpy's is from 08:37 ACST. A 1.0 c/L move in two hours is ordinary. It cannot be settled either way because the NT feed carries no retailer timestamp (§3, finding F2). Everything else is identical to the tenth of a cent, so the fetchers and fuel-code mapping (`src/lib/fuel-codes.ts`) are correct.

## 3. Defects, ranked

| # | Severity | Finding | Evidence | Where | Fix |
|---|---|---|---|---|---|
| F1 | **Critical** | Planner uses stale prices as current. Full Darwin→Toowoomba "Optimised" and "Cheapest Fill-Up" plans both buy 76.5 L at United Cardwell for 174.9 c/L; that price was reported `2025-09-10`. Neighbours: BP Seaview 245.9 (11 Oct), Caltex 245.9 (29 Oct), Liberty 239.5 (19 Oct). Real saving claimed is fictitious and the plan would under-fuel the next leg | `/api/trip-plan` response, station `qld-61477101` | `src/lib/trip-planner.ts` (`prepareRouteStations`), `src/app/api/stations/route.ts` — no age check anywhere; `src/lib/price-sanity.ts` checks magnitude only | Drop (or heavily penalise) any price older than a per-state max age (QLD/NSW/ACT/TAS/SA: 7 days; WA: 2 days; VIC: 3 days) in the planner, fill-up finder and map; show "stale" badge instead of hiding silently |
| F2 | **High** | Intraday refresh is dead. `/api/meta` shows every live state at `20:59:29Z` (one minute apart) and the map badge reads "Prices updated 2h ago" at 08:44 ACST. The README promises ~15-minute refresh via `.github/workflows/refresh-data.yml`; the only thing running is the daily Vercel cron (`vercel.json`, 20:00 UTC = 05:30 ACST). Probable cause: GitHub disables scheduled workflows in repositories with no commits for 60 days — last commit 28 Jul 2026, so the schedule would have been switched off about 26 Sep 2026 | `/api/meta`; NT `updated` field equals cron time for every NT price | GitHub → Actions → "Refresh fuel data" | Re-enable the workflow in the Actions tab and confirm `APP_URL` / `CRON_SECRET` secrets still exist; push any commit to reset the 60-day clock. Longer term: a keep-alive commit step or move the schedule to a provider without the inactivity rule |
| F3 | **High** | Map basemap broken: CARTO raster tiles now require an API key, rendering "API KEY REQUIRED" watermarks across the main map. Trip and fill-up maps use OSM tiles and are unaffected | Screenshot supplied by Fred; `src/components/MapView.tsx` lines 713–717 | `MapView.tsx` | Option A (15 min): switch to `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with a CSS invert filter for the dark palette (same provider the other two maps use; mind OSM tile policy at scale). Option B: register a CARTO key and inject via `NEXT_PUBLIC_CARTO_API_KEY` |
| F4 | Medium | NT price timestamps are fetch time, not report time. `nt.ts` stamps `new Date()` on every price, so the pin's "Updated 2h ago" for NT is the cron time and staleness is undetectable; `/data-freshness` tells users the pin timestamp is "the only number that matters" | `src/lib/fetchers/nt.ts`; `/api/station/nt-61` | NT fetcher | Check whether MyFuel NT's `serverJson` carries a last-updated field (documented in `docs/myfuelnt-api-documentation.md`); if not, label NT timestamps "snapshot" in the UI |
| F5 | Medium | QLD `updated` strings have no timezone suffix (`2026-10-29T03:10:00.2`) while NT has `Z`; JavaScript parses the former as local time of the browser, so the "x h ago" badge can be off by the viewer's UTC offset | `/api/stations` output | `src/lib/fetchers/qld.ts` (`TransactionDateUtc`) | Append `Z` when normalising |
| F6 | Medium | Planner breaches its own reserve unnecessarily. Katherine→Mt Isa: app warns "Arrive at Astron Mount Isa with only 8L (below 9L reserve)" yet the DP found a cheaper plan ($373.15) that respects the reserve | §4 | `trip-planner.ts` greedy lookahead | Allow the lookahead to top up at the last station before a long gap when the gap exceeds usable range |
| F7 | Low | `/data-freshness` claims SA is connected; `/api/meta` says `SA: null` (no `SA_FPIS_API_TOKEN`) | Page text vs API | `src/app/data-freshness/page.tsx` | Drive the page from `/api/meta` rather than static copy |
| F8 | Low | Discounts page lists a pre-seeded "Puma Energy, Better Choice — QLD" rule; Camooweal is served as "Caltex" by the app and "Puma" by PetrolSpy — brand canonicalisation differs by source | Discounts page; station `qld-61470160` | `src/lib/brands.ts` | Verify against the QLD brand reference table |
| F9 | Low | Route cannot be constrained (no tolls, avoid Brisbane). OSRM picked the coast via Cardwell and Townsville for Mareeba→Emerald; only via-points steer it | `/api/trip-plan` geometry | `src/lib/routing/get-route.ts` | Add `exclude=toll` (OSRM) / `avoid_features` (ORS) as an option |

## 4. Trip planner — mechanism checks

| Check | Result |
|---|---|
| Full trip API, RAV4 towing profile (tank 45, 11.5 L/100 km, 2×20 L jerry, 10 % reserve), 7 via points | HTTP 200 in 27.2 s; 4,655.6 km; 56.5 h; 26,917 geometry points; three strategies returned (Optimised $1,055.38 / Cheapest Fill-Up $1,151.18 / Stop when low $1,360.35) — but see F1, the first two are built on a stale price |
| UI trip Katherine→Mount Isa (geocode, jerry cans, consumption edit, submit) | Works; 1,283 km; map, three strategy cards, fuel-level chart, per-stop cards with Google/Apple/Waze links |
| LAF/OPAL fallback | Correct: Katherine, Tennant Creek, Three Ways, Camooweal served as LAF with notice; Elliott, Barkly Homestead as U91 |
| Corridor logic | 15 km perpendicular. Tennant Creek township (25 km south of Three Ways on this routing) is excluded, so the planner never sees Lone Star at 255.9 — fine geometrically, but worth knowing when you plan to stop there anyway |
| Independent DP cross-check (Katherine→Mt Isa, 12 candidate sites, 0.1 L resolution, reserve enforced at every arrival, final top-up to full at 237.5) | Optimum $373.15 vs app Optimised $373.56. Greedy heuristic is within 0.1 % here; replacing it with a Khuller-style DP is not a priority. Script: `scratchpad/fs/dp_check.py` (session scratch; reproduce from the candidate list in this report) |
| Jerry cans | Modelled as extra tank capacity (85 L total), refilled at every stop; no decanting model. Acceptable for planning, but the 636 km Three Ways→Mt Isa hop at 11.5 L/100 km needs 73 L — both cans go in |
| Routing supply | Single public OSRM demo-server request; falls back to OpenRouteService only if `OPENROUTESERVICE_API_KEY` is set; `/api/trip-plan` has no `maxDuration` set (27 s observed; Vercel Hobby limit is 60 s with Fluid, 10 s without) |

## 5. Feeds — what is actually live

| State | Upstream | Gate | Live today | Timestamp carried |
|---|---|---|---|---|
| NT | MyFuel NT page scrape (`serverJson`) | none | yes | fetch time (F4) |
| QLD | fppdirectapi-prod.fuelpricesqld.com.au | `QLD_FPD_API_TOKEN` | yes | `TransactionDateUtc` (F5) |
| NSW / ACT | FuelCheck API | none | yes | `lastupdated` (Sydney) |
| WA | FuelWatch RSS | none | yes | RSS date |
| TAS | FuelCheck TAS | none | yes | `lastupdated` (Hobart) |
| VIC | Servo Saver open data | `VIC_SERVO_SAVER_API_KEY` | yes (24 h delayed by design) | `updatedAt` |
| SA | FPIS (host unverified) | `SA_FPIS_API_TOKEN` | **no** | — |

## 6. Minor observations

- One console 404 on every page load (static asset; not user-visible). Identify via Network panel; likely the missing `/api/data-freshness` route or a manifest icon.
- `/api/stations` and `/api/trip-plan` are `robots`-disallowed, which is why external fetchers cannot verify the API; harmless.
- `package.json` has no `test` script although 24 jest files exist; `npx jest` works but nothing runs them in CI.
- The repo working tree now contains `fuelsmart-src-snapshot.tgz` (created by this audit) — delete it; it is not committed.

## 7. External check applied

- Prices: the scheme data (NT and QLD mandatory reporting) is the standard. The app matched it to the tenth of a cent on 19/20 pairs; the 20th is within the age of the app's snapshot. Verified against a secondary republication, not the government sites directly — those are JS apps that cannot be fetched from here. Spot-check two of the rows above in the MyFuel NT and fuelpricesqld.com.au apps on your phone before you leave; if they match, the chain is closed.
- Algorithm: the dynamic-programming enumeration beat the app by $0.41 on $373 — the app is not provably optimal but it is not wrong.
- The real check is the drive: keep receipts; the plan's predicted spend per leg is in the Stage 2 plan.
