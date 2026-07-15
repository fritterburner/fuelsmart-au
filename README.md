# FuelSmart AU

FuelSmart AU is a privacy-first fuel price app for Australia. No accounts, no
logins, no ads, no trackers — just live prices, an honest 7-day outlook, and a
few tools to help you spend less at the pump. Everything you configure (fuel
type, tank size, discounts, home location) lives in your own browser storage;
the only thing the server keeps is aggregate, non-personal price data.

## What it does

- **Live map** — thousands of stations nationwide, coloured by price, with
  per-pin "last reported" freshness so you can tell a real-time price from a
  stale one.
- **Discount-aware pricing** — configure the loyalty programs, fuel-card
  discounts and cashback rules you actually use; matching stations show the
  after-discount price on the map. Brand names are normalised against a
  canonical list (e.g. "Shell Coles Express" and "COLES EXPRESS" both match
  "Coles Express"), because state feeds don't agree on spelling.
- **7-day price forecast** — a transparent cycle model (recent trough/peak
  position) overlaid with known policy events (e.g. excise changes), always
  shown as a range with an honest confidence level, never false precision.
- **Trip planner** — plans fuel stops along a route, comparing a naive
  cheapest-price strategy against a detour-aware one, and shows the true
  cost including a fill-up at the destination.
- **30-day price history** — state and region-level charts (~50 ABS-grounded
  regional hubs, metro kept whole, thin regions rolled up into "Rest of
  <state>"), plus a per-station sparkline.
- **National trends & per-state/per-station SEO pages** — `/trends` (cheapest
  price, average and 7-day direction for every state), `/prices/[state]`
  (cheapest stations in one state) and `/station/[id]` (one station's current
  prices, 30-day trend and cheaper alternatives within 5 km) — server-rendered
  and crawlable, degrading gracefully to "no data yet" for states whose feed
  isn't live.
- **Installable PWA** — works offline-ish via a service worker and can be
  added to the home screen.

## Coverage by state

| State/territory | Feed | Status | Cadence | Attribution required |
|---|---|---|---|---|
| NSW | FuelCheck NSW | Live | Near real-time (30 min reporting rule) | Source attribution + report timestamp; no NSW Gov endorsement implied |
| ACT | FuelCheck NSW (shared feed) | Live | Near real-time | Same as NSW |
| QLD | Fuel Price Reporting (aggregated by Informed Sources) | Live | 30-minute rule | Source attribution + currency shown |
| WA | FuelWatch WA | Live | 24-hour delay (locked-in pump price) | Attribution + 24h cadence explained honestly |
| NT | MyFuel NT | Live | Varies (self-reported) | Attribution + currency shown |
| TAS | FuelCheck TAS | Live | Varies (self-reported) | Attribution + currency shown |
| VIC | Servo Saver Open API (Service Victoria) | Fetcher built, dormant until `VIC_SERVO_SAVER_API_KEY` is set | 24-hour delay once live | Attribute Service Victoria/Vic Gov on go-live |
| SA | Fuel Pricing Information Scheme (Informed Sources aggregator) | Fetcher built, dormant until `SA_FPIS_API_TOKEN` is set | Not yet confirmed | Terms confirmed — see below |

Until the VIC and SA feeds are switched on, the map, `/trends` and
`/prices/vic` / `/prices/sa` show no data for those two rather than guessing —
see `/data-freshness` in the app for the full per-state breakdown.

**SA licence obligations** (Data Publisher T&Cs, confirmed): any SA data must
carry the attribution *"Based on or contains data provided by the State of
South Australia (Office of Consumer and Business Services) 2021-2023.
Copyright of the State of South Australia."*, be visibly distinct from other
states' data, and give SA users a way to report a stale price straight to CBS.
The app already ships a gated `SaObligations` component that renders this
automatically wherever an SA station is shown, and stays inert until the SA
feed is live.

**Derived data:** the ~50 named region hubs in `lib/regions.ts` (e.g. "Greater
Sydney", "Newcastle & Hunter") are selected using Australian Bureau of
Statistics Significant Urban Area / population data (© ABS, CC BY 4.0) — we
use it only to place region anchors, not to redistribute ABS datasets.

Full obligations register (per-feed licence terms, what's implemented, what's
still open): `docs/data-feed-compliance-register.md`.

## Architecture

```
                 +----------------------------+
                 |  GitHub Actions (*/15 min) |--+
                 +----------------------------+  |  hits /api/cron/refresh
                 +----------------------------+  |  (bearer: CRON_SECRET)
                 |  Vercel Cron (once daily,  |--+
                 |  Hobby-plan fallback)      |  |
                 +----------------------------+  v
                                     +------------------------+
State fuel-price feeds (NSW/ACT,    | Next.js 16 App Router   |
QLD, WA, NT, TAS live; VIC/SA       | on Vercel (syd1 region) |
gated on env keys) ----fetch------> |  - per-state fetchers   |
                                     |  - brand/fuel           |
                                     |    normalisation        |
                                     |  - price-sanity checks  |
                                     +-----------+-------------+
                                                 | cacheStations() +
                                                 | recordDailySnapshot()
                                                 v
                                     +------------------------+
                                     |   Upstash Redis         |
                                     |  - stations:all (blob)  |
                                     |  - history:state:*      |
                                     |  - history:region:*     |
                                     |  - history:stations:*   |
                                     |  - market-data:v1       |
                                     +-----------+-------------+
                                                 | read at request/ISR time
                                                 v
                          Map, history/forecast, trip planner,
                          /trends, /prices/[state], /station/[id]
```

- **Framework:** Next.js 16 (App Router), React 19, Tailwind v4 with a
  token-based theme system (`--fs-*` CSS variables in `globals.css`, several
  built-in style/palette combinations).
- **Data store:** a single Upstash Redis instance holds the latest station
  blob (`stations:all`, ~2,700 stations today) plus daily per-station,
  per-state and per-region price snapshots for history and forecasting.
  Nothing user-identifying is stored server-side.
- **Refresh cadence:** GitHub Actions hits `/api/cron/refresh` roughly every
  15 minutes (`.github/workflows/refresh-data.yml`); Vercel's own daily cron
  (`vercel.json`) is a backstop, since the Hobby plan only allows one
  cron/day. Both call the same `refreshAllData()` in `src/lib/refresh.ts`,
  which fetches every state fetcher in parallel, caches whatever succeeded
  (partial success beats none), and records a daily snapshot for history.
- **SEO pages** (`/trends`, `/prices/[state]`, `/station/[id]`) read the same
  Redis-backed cache, with the underlying aggregation wrapped in
  `unstable_cache` (`src/lib/state-pricing.ts`) revalidated every 15 minutes
  to match the refresh cadence, plus `src/app/sitemap.ts` / `robots.ts`.
- **Forecast:** a transparent cycle/phase model over recent history plus a
  policy-event overlay (`src/lib/forecast.ts`), not a black-box ML model —
  the confidence level is explicit and low until enough history accrues.

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. Nothing is
required to run the app read-only against already-cached data other than the
Upstash pair; the rest gate individual features/fetchers.

| Variable | Required for | Notes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Everything | Free tier at [upstash.com](https://upstash.com) is enough to start. |
| `QLD_FPD_API_TOKEN` | QLD fetcher | Queensland Fuel Price Reporting API token. |
| `NSW_FUEL_API_KEY` / `NSW_FUEL_API_SECRET` | NSW/ACT fetcher | Apply at api.nsw.gov.au. |
| `CRON_SECRET` | `/api/cron/refresh` | Bearer secret; generate any random string in production. |
| `OPENROUTESERVICE_API_KEY` | Trip planner routing fallback | Optional — OSRM's public demo server is used if unset; outages surface to the user instead of silently failing. |
| `VIC_SERVO_SAVER_API_KEY` / `VIC_SERVO_SAVER_URL` | VIC fetcher | Fetcher stays dormant until the key is set. |
| `SA_FPIS_API_TOKEN` / `SA_FPIS_URL` | SA fetcher | Fetcher stays dormant until the token is set. |
| `USAGE_REPORT_SECRET` | `/api/usage/report` | Bearer secret for the aggregate usage report (satisfies the SA licence's usage-reporting clause). |
| `BACKFILL_SECRET` | `/api/admin/backfill-history` | One-off historical backfill; set, run once, then remove the route. |
| `NEXT_PUBLIC_ENABLE_EXCISE` | Excise-checker UI | Off by default (the Apr-Jun 2026 excise-cut content goes stale after 30 Jun 2026); set to `"true"` to revive. |
| `NEXT_PUBLIC_SITE_URL` | SEO metadata/sitemap | Optional — not in `.env.example` yet. Canonical origin used for `metadataBase`, `sitemap.xml` and `robots.txt` (`src/lib/site.ts`). Falls back to the example URL already referenced in `.github/workflows/refresh-data.yml`; set it once a production domain is confirmed. |

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in at least the Upstash pair
npm run dev                  # http://localhost:3000
```

Other useful commands:

```bash
npx tsc --noEmit    # type-check
npx jest             # unit tests (a few fetcher tests need live network/API
                      # tokens and are expected to fail without them)
npm run lint
npm run build         # production build
```

The map and history/forecast pages read from Redis, so local dev against a
real Upstash instance shows real cached data — there's no separate mock mode.

## Licence & attribution

FuelSmart AU redistributes no third-party datasets — it reads live feeds at
request time and shows each state's official price with its own report
timestamp. Where a feed's terms require attribution, it's shown in-app (see
the coverage table above and `docs/data-feed-compliance-register.md` for the
full obligations register, kept up to date as each provider's terms are
confirmed). Region-hub placement is informed by ABS Significant Urban Area
data (© Australian Bureau of Statistics, CC BY 4.0).

This project itself has no separate open-source licence file at this time;
treat it as all-rights-reserved unless told otherwise by the project owner.
