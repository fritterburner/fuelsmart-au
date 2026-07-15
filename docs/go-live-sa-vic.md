# Go-live: SA + VIC fuel-price feeds

Owner-facing checklist for turning on the South Australia (Informed Sources
FPDAPI) and Victoria (Fair Fuel Open Data API / "Servo Saver") fetchers once
their API keys arrive. Both fetchers stay dormant (return no stations, no
errors) until their key env var is set — the rest of the app is unaffected
either way.

---

## 1. Where the keys go

Both keys are read server-side only (cron + `/api/cron/refresh`), never
exposed to the browser.

**Production/Preview (Vercel):**

1. Vercel dashboard → your project → **Settings → Environment Variables**.
2. Add:
   - `SA_FPIS_API_TOKEN` — the SA data-publisher subscriber token.
   - `VIC_SERVO_SAVER_API_KEY` — the VIC API Consumer ID.
3. Tick **all environments** you use (Production, Preview, Development) so
   preview deployments and the scheduled Action also pick it up.
4. **Redeploy** — Vercel doesn't hot-reload env vars into already-running
   functions; the next deploy (or a manual redeploy of the current commit)
   is what actually picks up the new values.

**Local dev (optional):** add the same two vars to `.env.local` (already
git-ignored). See `.env.example` for the full set of related override vars
(`SA_FPIS_COUNTRY_ID`, `SA_FPIS_GEOREGION_LEVEL`, `SA_FPIS_GEOREGION_ID`,
`VIC_SERVO_SAVER_URL`) — leave them at their defaults unless troubleshooting
tells you otherwise (see §3).

---

## 2. Verifying it worked

**Option A — GitHub Action (preferred):**

1. Repo → **Actions** → "Refresh fuel data" (or whatever the scheduled
   refresh workflow is named) → **Run workflow** (workflow_dispatch).
2. Open the run, expand the step that prints the refresh summary JSON.
3. Look for non-zero `vic:` and `sa:` counts, e.g.:
   ```json
   { "vic": 1834, "sa": 612, "total": 9213, "errors": [] }
   ```
   Zero counts with no error usually means the key isn't set in that
   environment yet (or the environment used by the Action doesn't have it).
   A non-empty `errors[]` entry for `VIC:` or `SA:` means the request itself
   failed — see the troubleshooting table below.

**Option B — hit the cron endpoint directly:**

```bash
curl -s https://<your-domain>/api/cron/refresh \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

Same JSON shape as above. Useful for a quick check without waiting for the
next scheduled run.

---

## 3. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `errors[]` has `VIC: ... 403` | Bad/unapproved VIC API Consumer ID | Re-check `VIC_SERVO_SAVER_API_KEY` in Vercel matches what Service Victoria issued; confirm the key has been activated (not just requested). |
| `errors[]` has `VIC: ... 429` | Rate limited (10 req/60s) | The fetcher only makes 2 calls/refresh, so this shouldn't happen under normal cron cadence. If it does, check nothing else (a second cron, manual testing loop) is hammering the same key concurrently. |
| `errors[]` has `VIC: VIC_SERVO_SAVER_API_KEY not set` | Env var missing in that environment/deployment | Add it in Vercel for the environment that ran (Production vs Preview vs Development are separate), then redeploy. |
| `errors[]` has `SA: ... bounding box ...` | `SA_FPIS_COUNTRY_ID` and/or `SA_FPIS_GEOREGION_ID` are wrong — most of the returned "SA" sites are actually in another state's tenant | See the discovery steps below; set `SA_FPIS_COUNTRY_ID` / `SA_FPIS_GEOREGION_ID` overrides once you know the right values, then redeploy. |
| `errors[]` has `SA: ... 401` or `SA: ... 403` | Bad token or wrong header format | Confirm `SA_FPIS_API_TOKEN` is the exact subscriber token from SA. The fetcher sends `Authorization: FPDAPI SubscriberToken=<token>` — if SA's docs specify a different scheme, that's a code change, not just an env change. |
| `errors[]` has `SA: SA_FPIS_API_TOKEN not set` | Env var missing in that environment/deployment | Same as the VIC equivalent above. |
| `vic`/`sa` counts are 0 with no error | Key not configured (fetcher deliberately no-ops) | Expected until the key is set — not a bug. |

### Discovering SA's real `countryId` / `geoRegionId`

The scaffold's `countryId=21` is **confirmed to be QLD's tenant id, not SA's**
— reusing it against SA's docs/key is a guess that may point at the wrong
state's data entirely (hence the bounding-box guard). Once you have the SA
subscriber token, call `GetCountryGeographicRegions` to find SA's real ids:

```bash
curl -s "https://fppdirectapi-prod.safuelpricinginformation.com.au/Subscriber/GetCountryGeographicRegions?countryId=21" \
  -H "Authorization: FPDAPI SubscriberToken=<your-sa-token>" | jq
```

- If that returns SA regions under `countryId=21`, `SA_FPIS_COUNTRY_ID` can
  stay at its default (21) — set it explicitly anyway for clarity.
- If it returns nothing sensible for SA, try other small integers (the QLD
  tenant is 21; SA's is unknown but likely nearby) until you get a region
  list that includes South Australia.
- In the response, find the entry for **South Australia at
  `geoRegionLevel=3`** (level 3 = state, confirmed) and read its
  `GeoRegionId` — that's your `SA_FPIS_GEOREGION_ID`.
- Set both as env overrides in Vercel:
  - `SA_FPIS_COUNTRY_ID=<value>`
  - `SA_FPIS_GEOREGION_ID=<value>`
  - `SA_FPIS_GEOREGION_LEVEL` can stay at `3`.
- Redeploy, then re-run the verification in §2. If the bounding-box error
  disappears and counts look sane (roughly matching SA's known station
  count, in the low hundreds to ~1,000), you've got the right ids.

The host `fppdirectapi-prod.safuelpricinginformation.com.au` (default of
`SA_FPIS_URL`) is also an unverified guess by analogy with QLD's host —
override `SA_FPIS_URL` if SA's onboarding docs specify something different.

---

## 4. What's still unverified until the keys are live

- **SA host, `countryId`, `geoRegionId`:** all best-effort guesses (see §3).
  The code defends against a wrong guess two ways: it self-corrects fuel-type
  ids at runtime (`GetCountryFuelTypes`, tolerant name matching, falling back
  to the static QLD-derived map only where that fails) and validates
  geography at runtime (the SA bounding-box check, which throws a
  loud, specific error into the cron's `errors[]` rather than silently
  showing another state's stations on the SA map).
- **SA brand-id table:** joined live via `GetCountryBrands`; unresolved ids
  fall back to `Independent`.
- **VIC brand reference-data schema:** not verbatim-confirmed. The fetcher
  parses defensively (accepts either `{ brands: [...] }` or a bare array,
  with either `id` or `brandId` as the key field); any parse failure falls
  back to `Independent` per station rather than failing the whole fetch.
- Once real data flows, spot-check a handful of VIC and SA stations against
  a source you trust (e.g. PetrolSpy) for price sanity and correct
  brand/suburb rendering before considering either feed fully live.

---

## 5. VIC compliance notes

- **Attribution:** the VIC licence (CC BY 4.0) requires the notice *"© State
  of Victoria accessed via the Victorian Government Service Victoria
  Platform"* on any copy of the data. This string now exists as
  `VIC_ATTRIBUTION` in `src/lib/attribution.ts` (same pattern as the existing
  `SA_ATTRIBUTION`), but **is not yet rendered anywhere in the UI** — wiring
  it into a component (mirroring `src/components/SaObligations.tsx`, which
  currently only renders for `station.state === "SA"`) and into
  `MapView.tsx`'s station popup is a small follow-up task before VIC can be
  considered fully compliant, not just fetching data.
- **24-hour delay:** the public VIC tier is 24-hour delayed. Nothing in the
  fetcher or the app should present a VIC price as "live" — the existing
  per-pin "last reported" timestamp already conveys this honestly, since it's
  populated straight from the feed's own `updatedAt` field rather than the
  fetch time. `src/app/data-freshness/page.tsx` currently lists VIC as
  "Coming soon" under a combined "SA / VIC" row; once the feed is live, that
  row should be split and the VIC row's cadence text should say "24-hour
  delay" explicitly (same treatment as the existing WA row).
