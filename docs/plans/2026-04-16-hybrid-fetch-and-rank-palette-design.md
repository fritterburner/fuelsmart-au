# Hybrid market-data fetch + rank-based pin palette

**Date:** 2026-04-16
**Goal:** Make excise mode work on Vercel without an Anthropic API key, and replace the default-mode percentile palette with a rank-based scheme that highlights the cheapest stations onscreen.

---

## Part A — Hybrid market-data fetch

### Problem

The excise pass-through feature needs live Brent crude (USD/bbl) and AUD/USD. The current implementation calls the Anthropic Messages API with `web_search_20250305`. This requires `ANTHROPIC_API_KEY` in Vercel env vars. The key isn't set, so the nightly cron throws, the Redis cache stays empty, and `/api/market-data` serves 503 forever. Users see a red banner with "Live market data unavailable" and must set a manual override to get any map colouring.

### Solution

**Primary fetch path — free, no auth:**

| Variable | Source | Endpoint | Format |
|---|---|---|---|
| AUD/USD | Frankfurter (European Central Bank reference rates) | `https://api.frankfurter.app/latest?from=AUD&to=USD` | JSON |
| Brent USD/bbl | Stooq (CB.F futures contract) | `https://stooq.com/q/l/?s=cb.f&f=sd2t2ohlcv&h&e=csv` | CSV |

Both verified working on 2026-04-16. Frankfurter returns `{amount, base, date, rates: {USD: 0.71364}}`. Stooq returns `Symbol,Date,Time,Open,High,Low,Close,Volume\nCB.F,2026-04-16,08:18:12,94.65,95.29,94.44,94.78,`.

**Fallback path:** If either free fetch fails and `ANTHROPIC_API_KEY` is set, call the existing Anthropic web_search path. If no key, the failure bubbles up and the existing manual-override UI remains the escape hatch.

**On-demand populate:** `/api/market-data` currently returns 503 on cache miss. Change it to trigger a fetch on cache miss, cache the result, and return. Simple in-process lock (Promise-keyed by `MARKET_DATA_KEY`) prevents the thundering-herd problem under concurrent first-users.

### File layout

```
src/lib/excise/
├── fetchers/
│   ├── frankfurter.ts      (NEW — AUD/USD)
│   ├── stooq.ts            (NEW — Brent)
│   ├── anthropic.ts        (MOVED from fetch-market-data.ts)
│   └── __tests__/
│       ├── frankfurter.test.ts
│       └── stooq.test.ts
├── fetch-market-data.ts    (REWRITTEN as orchestrator)
└── __tests__/
    └── fetch-market-data.test.ts  (NEW — orchestrator tests)

src/app/api/market-data/
└── route.ts                (MODIFIED — on-demand fetch on cache miss)
```

### Orchestrator behaviour

```
fetchLiveMarketData():
  try:
    [oil, aud] = await Promise.all([fetchStooqBrent(), fetchFrankfurterAUD()])
    return { brent_usd: oil, aud_usd: aud, as_of: today, source: "frankfurter+stooq" }
  catch freeErr:
    if ANTHROPIC_API_KEY:
      try:
        return await fetchAnthropicMarketData()
      catch anthropicErr:
        throw combined error
    throw freeErr
```

### Error handling

- Each fetcher validates response shape and value ranges (oil 1–500 USD/bbl, AUD 0.1–2.0).
- Network/parse errors throw with a contextual message so the orchestrator can decide to try Anthropic.
- The `/api/market-data` route catches any orchestrator error and returns 503 with the error message — same contract as before, so the UI error-state still fires.

### Testing

- Parse-only tests for `frankfurter.ts` (mock fetch with sample JSON) and `stooq.ts` (sample CSV).
- Orchestrator test covers: all-free-succeeds, free-fails-anthropic-succeeds, free-fails-no-key-fails.
- No live HTTP in tests.

---

## Part B — Rank-based pin palette

### Problem

Default mode (`src/components/MapView.tsx` `getPriceColor`) uses a 20/60/20 percentile split across the visible price range. When prices cluster (they usually do in metro viewports), everything is green, and one outlier at the top turns red for no meaningful reason.

### Solution

Rank by visible price, not percentile. Three tiers with different logic:

```
sort visible stations by price ascending
N = settings.cheapestHighlightCount  (default 3, user-configurable 1–10)
total = visible count

if total < 10:
  top N          → GREEN
  rest           → GRAY

else:
  top N                     → GREEN  (#22c55e)
  bottom 10% of total       → RED    (#ef4444)
  next 20% above red        → ORANGE (#f59e0b)
  all remaining             → GRAY   (#6b7280)
```

Edge case: if N exceeds total, all stations are green.

### Settings

- Add `cheapestHighlightCount: number` to `UserSettings` in `src/lib/settings.ts`, default `3`.
- Add a number input to `/settings` page labelled "Highlight N cheapest stations onscreen", range 1–10.

### Scope

- Default (non-excise) price mode only. Excise mode keeps its current verdict palette (green/amber/red/blue/gray by pass-through %) — not layered, not changed.
- No legend component. The green pins are self-evidently "best". Red/orange retain their universal bad-news semantics.

---

## Out of scope

- Replacing the Anthropic fallback entirely (free path is enough to make the feature usable; Anthropic is retained as optional insurance).
- Exposing palette hex codes as user settings (YAGNI).
- Adding a visual legend (adds clutter for marginal benefit — revisit if users complain).
