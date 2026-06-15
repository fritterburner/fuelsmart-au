# National Coverage + Roadmap — Planning Doc (for sign-off)

**Date:** 2026-06-15
**Status:** PLAN ONLY — no feature code until P0 is agreed.
**Scope of this doc:** orient on the feed abstraction, deep-plan P0 national coverage (SA/VIC/ACT), confirm the excise flag-off, and lightly sketch P1/P2.

---

## 0. Orientation — how the 5 feeds are abstracted

It's a **convention-based adapter**, not a formal interface/class. Each state is a self-contained module `src/lib/fetchers/<state>.ts` exporting one async function `fetch<STATE>Stations(): Promise<Station[]>`. Each module owns its own transport (NSW/TAS/QLD = JSON REST, WA = XML/RSS, NT = HTML scrape of `serverJson`), maps the feed's fuel codes → the canonical `FuelCode` enum via a per-state map in `fuel-codes.ts`, and canonicalises brands either through the shared `normaliseBrand()` alias engine (`brands.ts`) or a per-state brand map. Every module returns the **same canonical `Station` shape** (`types.ts`). `refresh.ts` is the orchestrator: it fans all fetchers out with `Promise.allSettled` (partial success is fine), concatenates into one `allStations` array, stamps a per-state "last updated" (`setStateLastUpdate`), and writes one cached blob (`cache.ts`). Shared helpers: `price-sanity.ts` (reject 999.9 sentinels / decimal slips) and `tz.ts` (local-wall-time → ISO).

**Net:** adding a jurisdiction = (1) new `fetchers/<state>.ts`, (2) fuel + brand maps, (3) register it in `refresh.ts`, (4) surface it in the UI (map already plots any `Station`; the work is freshness/state-list copy). The type system is already national-ready — `StateCode` in `types.ts` already includes `"ACT" | "SA" | "VIC"`, and `discounts/page.tsx` already lists all 8 codes.

---

## 1. Triage table — confirmed vs changed

| Item | Your hypothesis | Verdict | Note |
|---|---|---|---|
| **ACT coverage** | Likely rides NSW FuelCheck; near-free | ✅ **Confirmed — even cheaper than thought** | ACT joined NSW FuelCheck in Nov 2022. The NSW fetcher **already ingests ACT** (`nsw.ts` parses `(NSW\|ACT)` from the address and tags `state:"ACT"`). Data is *already flowing*; this is a surfacing job, not a feed job. |
| **SA feed** | Own scheme; confirm feed + terms | ⚠️ **Confirmed scheme, gated access** | SA Fuel Pricing Information Scheme, aggregated by **Informed Sources**. Access = register as a "data publisher" via Consumer & Business Services (CBS). Terms/cost **not public** — likely an application + possible commercial agreement. This is the access-risk jurisdiction. |
| **VIC feed** | Open question — official vs crowd-sourced; don't assume | ✅ **Resolved — official feed now exists** | **Servo Saver Public API** (Service Victoria, on data.vic.gov.au), backed by mandatory reporting. JSON, **free**, but requires an application → API Consumer ID, and the public tier is **24-hour delayed** (real-time lives only in Vic's own app). Not crowd-sourced. |
| **Sequence** | ACT → SA → VIC | 🔧 **Changed: ACT → VIC → SA** | VIC is now a clean, free, JSON feed that fits the abstraction directly; SA is gated behind an aggregator with unknown terms/lead time. Do the certain, free one before the gated one. (Your call — see Open Questions.) |
| **7-day forecast (P2)** | Build, differentiate (cycle + excise/policy aware) | ✅ Kept as P2 | Differentiator stands. |
| **30-day history (P2)** | Cheap retention win | 🔧 Kept, with one caveat | Needs a small **server-side daily snapshot store** — device-only can't accumulate national history. Still no accounts. Flagged below. |
| **After-discount pricing** | Protect | ✅ Kept | Biggest everyday-accuracy edge. Adding states must not regress brand matching (see brand-gap edge case). |
| **Detour-ranking kernel** | "Locate or rebuild" | ✅ **Located — already built** | `src/lib/fill-up/find-best-stop.ts` ranks candidates by **total cost net of detour fuel**, on **after-discount** price. P1 = fold this kernel into the multi-stop `/trip` planner; no rebuild needed. |
| **Excise checker** | Flag OFF, keep code | ✅ Kept as P1 discrete task | Mechanism below. |
| **Native + push** | Park until native/PWA decision | ✅ Parked | Web-only blocker noted; no work now. |
| **Logbook** | Defer | ✅ Deferred | — |

---

## 2. P0 — National coverage deep dive

### 2A. ACT — *near-free surfacing* (data already ingested)

| Field | Detail |
|---|---|
| Source | NSW FuelCheck API (already wired in `nsw.ts`) — ACT stations are in the same feed. |
| Access | None new. Same `api.onegov.nsw.gov.au` endpoint and timestamp header already in use. |
| Cadence | Near real-time (30-min mandatory reporting), same as NSW. |
| Fit | Perfect — `state:"ACT"` is already emitted; `StateCode` already includes ACT. |

**Tasks**
- `refresh.ts`: split the NSW result into NSW/ACT counts and call `setStateLastUpdate("ACT")` (currently only NSW is stamped) — ~5 lines.
- `data-freshness/page.tsx`: pull ACT out of the "SA / VIC / ACT — not covered" row into its own row ("FuelCheck NSW/ACT, near real-time"). Update the amber "why some regions are empty" box.
- Verify the address-parse regex catches ACT postcodes/format reliably; stations that fail the regex currently default to `"NSW"` (cosmetic mis-label only — no dedupe risk, see edge cases).
- Sanity-check ACT pin density on the map (Canberra) once stamped.

**Edge cases:** ACT/NSW are partitioned by the `state` field — each station appears **once**, so there is no NSW↔ACT duplication. The only failure mode is a malformed ACT address falling back to the NSW label (cosmetic). No brand/fuel gaps (same feed as NSW).

**Estimate:** **~0.5 day.** Mostly copy + one stamping change + a verification pass.

---

### 2B. VIC — *official free JSON feed, 24h cadence*

| Field | Detail |
|---|---|
| Source | **Servo Saver Public API** (Service Victoria / data.vic.gov.au). JSON. |
| Access | Free, but **application required** → you receive an API Consumer ID (key). Subject to a Terms / Acceptable Use policy + rate limits. **Apply now** — the key lead time is the critical-path risk, not the code. |
| Cadence | **24-hour delayed** on the public tier (real-time is exclusive to Vic's own app). Treat exactly like WA's "yesterday's locked-in price" model — we already have UI language for this. |
| Fit | Clean. New `fetchers/vic.ts` (JSON, like NSW/QLD), a VIC fuel-code map, brand additions, one line in `refresh.ts`. |

**Tasks**
- Apply for the Servo Saver API key (do this first — blocks integration testing).
- `fetchers/vic.ts`: fetch + normalise to `Station`. Confirm the real JSON shape against a live response before building the parser (don't assume field names).
- VIC fuel map in `fuel-codes.ts` (map Servo Saver's fuel labels → our `FuelCode`).
- Brand canonicalisation: add VIC-heavy brands missing from `CANONICAL_BRANDS` (e.g. **Apco** — already appears in the QLD map but is *not* canonical; plus United/Liberty/BP variants as the feed spells them). Add aliases.
- Register VIC in `refresh.ts` (`Promise.allSettled` slot + count + `setStateLastUpdate("VIC")`).
- `data-freshness/page.tsx`: VIC row — "Servo Saver, 24-hour delay" (reuse the WA explanation pattern).
- Wire the `as_of`/timestamp so a 24h-old VIC price shows an honest "updated yesterday" on the pin (don't let it read as live).

**Edge cases:** 24h staleness must be surfaced, not hidden (matches the "timestamp is the only number that matters" ethos). Confirm whether Servo Saver exposes premium-diesel / LPG / E85 distinctly or collapses them — map only what's real. Check the daily Victorian price-cap doesn't introduce a non-standard field.

**Estimate:** **~1.5–2 days** of code/test, **+ key-approval lead time** (out of our hands — start the application immediately).

---

### 2C. SA — *gated through the aggregator (access risk)*

| Field | Detail |
|---|---|
| Source | SA Fuel Pricing Information Scheme; aggregated by **Informed Sources** (same firm that runs QLD's scheme — but SA has no free self-serve portal equivalent to QLD's FPDAPI). |
| Access | Register as a **data publisher** via CBS / the aggregation system. **Terms and cost are not published** — expect an application and possibly a commercial agreement and/or redistribution conditions. Needs a direct CBS/Informed Sources conversation. |
| Cadence | Real-time (30-min mandatory reporting) — *if* access is granted. |
| Fit | Clean *once access exists* (new `fetchers/sa.ts`, SA fuel map, brand additions). The blocker is commercial/legal, not technical. |

**Tasks**
- **Decision/contact step first:** approach CBS / Informed Sources, get the terms + any fee in writing, and check redistribution conditions against our no-ads / no-revenue / device-only model. **Do not build until terms are acceptable.**
- Then: `fetchers/sa.ts`, SA fuel-code map, brand additions (On The Run/**OTR** and **X Convenience** are already canonical; add SA independents — e.g. Smart Fuel, Peregrine/OTR group, Liberty).
- Register in `refresh.ts` + `setStateLastUpdate("SA")`.
- `data-freshness/page.tsx`: SA row.

**Edge cases:** terms may forbid the kind of free public redistribution we do, or carry a fee that doesn't fit a no-revenue app — this is the real risk and why SA is sequenced last. Brand gaps (SA-specific independents) and fuel-type mapping are minor by comparison.

**Estimate:** **~1.5 days code** once unblocked, **but gated by an unknown-length commercial/access step.** Could be days or could stall — hence last.

---

### P0 recommended sequence & rollup

| # | Jurisdiction | Code effort | External blocker | Risk |
|---|---|---|---|---|
| 1 | **ACT** | ~0.5 day | none | trivial |
| 2 | **VIC** | ~1.5–2 days | API key approval (start now) | low |
| 3 | **SA** | ~1.5 days | publisher access + terms/fee | **medium–high** |

Ship ACT immediately (it's already in the data). Fire the VIC key application on day one so approval runs in the background. Open the SA/CBS conversation in parallel, but treat SA build as conditional on acceptable terms. **Net P0: ~3.5–4 dev-days of code, plus two external approvals running concurrently.**

---

## 3. Excise flag-off — discrete task (confirmed small)

**Mechanism (recommended):** a single source-of-truth flag — a `src/lib/features.ts` constant `export const EXCISE_ENABLED = false;` (or `NEXT_PUBLIC_ENABLE_EXCISE` env if you'd rather flip it without a deploy). Guard four touchpoints:

1. The two nav links to `/excise` in `app/page.tsx` (the "📘 How excise is calculated" links, ~lines 130 & 266).
2. The excise-mode toggle in the map header + the `ExciseToggle` / settings entry (so the mode can't be switched on).
3. The `/excise` route — `return notFound()` (or redirect to `/`) when disabled, so the page is unreachable but the file stays.
4. Optionally short-circuit the market-data fetch in `refresh.ts` when disabled (harmless to leave running; flag it only if you want the cron quiet).

**What stays (untouched, dormant):** all of `src/lib/excise/**`, the market-data fetchers (`frankfurter`/`stooq`/`anthropic`), `baselines.ts`, every excise component (`ExciseStatusBar`, `ExciseToggle`, `StationExcisePopup`, `ExciseManualOverride`), tests, and the `/excise` page itself. Re-enable later = flip one flag.

**Estimate:** **~0.5 day** incl. a test that the route 404s and no excise UI renders when the flag is off.

> Rationale reminder: the Apr–Jun 26.3¢/L excise halving ends **30 Jun 2026**, so the content goes stale within ~2 weeks of today — hence hide-not-delete.

---

## 4. P1 / P2 — light sketch (not deep-planned yet)

**P1 — protect & sharpen (after P0):**
- **After-discount pricing:** no rebuild; the risk is *regression* — every new state's brands must canonicalise so discount matching keeps firing. Covered by the brand-gap tasks above.
- **Detour-ranking kernel → `/trip`:** the kernel already exists in `fill-up/find-best-stop.ts` (ranks by total cost net of detour, on after-discount price). P1 = reuse that per-candidate net-saving logic inside the multi-stop `/trip` planner, which today selects cheapest-within-tolerance. Mostly a refactor to share one ranking function.
- **Excise flag-off** (Section 3).
- Running-cost + additives tools: keep as-is.

**P2 — retention:**
- **7-day forecast:** cycle-aware **and** excise/policy-event aware (the differentiator a pure oil-cycle model can't match).
- **30-day history charts:** needs a **server-side daily snapshot store** (device-only can't accumulate national history). It's aggregate price data, not user data, so it doesn't break privacy-first — but it's the one item that adds a small server-side store. Flagged for your OK.

**Later:** native app / PWA push alerts — blocked by web-only; park until a native/PWA-push decision is made.

---

## 5. Open questions for you (need answers before/at build start)

1. **Sequence:** OK to swap to **ACT → VIC → SA** (you'd hunched ACT → SA → VIC)? Rationale: VIC is now a clean free feed; SA is gated.
2. **SA terms:** are you willing to register as a CBS/Informed Sources data publisher, and is a **possible fee / commercial agreement** acceptable for a no-ads, no-revenue app? If the terms don't fit, SA may stay uncovered rather than crowd-sourced (which would break the official-feed model). Want me to open that conversation as a first step?
3. **VIC 24h delay:** acceptable to ship VIC at a 24-hour cadence (labelled like WA), and shall I treat "apply for the API key now" as approved so approval runs in the background?
4. **30-day history store:** OK to add a small **server-side daily price-snapshot store** (aggregate data only, still no accounts) to enable P2 history? If not, P2 history is effectively off the table.
5. **Excise flag:** prefer a **code constant** (`features.ts`) or an **env var** (`NEXT_PUBLIC_ENABLE_EXCISE`) for the toggle? And is leaving the market-data cron running (harmless) fine, or flag-gate it too?
6. **"State pages":** today coverage surfaces are the **map + the data-freshness page** — there are no per-state landing pages. Is a per-state page in scope for P0, or is map + freshness sufficient?

**I'll stop here for your sign-off before writing any feature code.**
