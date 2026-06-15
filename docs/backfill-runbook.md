# One-off history backfill — runbook

Goal: pre-populate ~6 months of per-state daily price history (NSW + ACT + QLD)
so the 30-day charts and the 7-day forecast start with real data instead of
waiting for the nightly cron to accrue it.

This uses the temporary, secret-gated endpoint `GET /api/admin/backfill-history`.
It streams an open-data "price history" CSV, aggregates per-state daily avg/min,
and writes the same `history:state:<date>` keys the live cron uses (long TTL, so
it persists). It writes **per-state aggregates only** (ID-agnostic, exactly what
the forecast needs). The data lives in Redis, so it survives after you delete the
endpoint.

## 1. Deploy with the endpoint + set the secret
- This branch already contains the route. In Vercel, set an env var:
  `BACKFILL_SECRET=<a long random string>` (Production).
- Push/deploy.

## 2. Get the CSV download URLs
- **NSW + ACT:** Data.NSW → "FuelCheck" dataset → the monthly *price history* CSV
  resources. Open the last ~6 monthly resources and copy each "Download" URL.
  https://data.nsw.gov.au/data/dataset/fuel-check
- **QLD:** data.qld.gov.au → "Fuel price reporting 2025 / 2026" → monthly CSV
  resources; copy each "Download" URL.
  https://www.data.qld.gov.au/dataset/fuel-price-reporting-2025
- (One NSW file = NSW + ACT, since they share the scheme. WA/SA/VIC are **not**
  done this way — see the compliance register.)

## 3. Dry-run each file first (no writes)
Confirms the columns parsed correctly before touching Redis:

```
curl -H "Authorization: Bearer $BACKFILL_SECRET" \
  "https://<your-app>.vercel.app/api/admin/backfill-history?state=NSW&dryRun=1&url=<CSV_URL>"
```
Check the JSON: `columnsDetected`, `rowsKept` (should be most of `rowsParsed`),
`dateRange`, and the `sample` daily aggregates look sane (cents/L, right month).
If `columnsDetected` is wrong, send me the `error` / headers and I'll adjust the
detector.

## 4. Real run (writes to Redis)
Drop `dryRun=1`. Run once per file:

```
curl -H "Authorization: Bearer $BACKFILL_SECRET" \
  "https://<your-app>.vercel.app/api/admin/backfill-history?state=NSW&url=<CSV_URL>"
```
Repeat for each NSW month and each QLD month (use `state=QLD` for QLD files).
ACT rides the NSW files automatically (NSW data is bucketed under NSW; ACT is a
separate live feed split — backfilled NSW history covers the NSW series).
One state+month per call keeps it inside the 60s function limit.

## 5. Verify
Open `/history`, pick NSW or QLD — the chart should now show the backfilled
months, and the 7-day outlook should read "medium" confidence.

## 6. Remove the endpoint (data stays)
On the next commit, delete `src/app/api/admin/backfill-history/` and remove the
`BACKFILL_SECRET` env var, then redeploy. The endpoint is gone; the history
remains in Redis.

## Notes
- Idempotent: re-running a month overwrites that month's keys (no duplication).
- Per-day price = mean of that day's price-change events (rough) and the day's
  min (robust). The forecast can use either.
- Same open (CC-BY) data we already attribute — no new licensing.
