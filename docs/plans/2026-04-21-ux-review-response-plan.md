# UX Review Response — Implementation Plan

**Date:** 2026-04-21
**Source:** UX/strategy review brief delivered in a separate Claude session (reviewer had static HTML only).
**Posture:** Walked the repo. Each finding verified against real code. Commits are themed. Nothing ships until reviewed.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task — but only after the user approves a subset.

**Goal:** Land the high-ROI fixes the UX review surfaced (trust-critical copy, discoverability of already-shipped features, quick station-level polish) without pulling in work that deserves its own design effort (CarQuery, 30-day trends, brand logos, SA/VIC data sources).

**Architecture:** All changes are local UI/copy tweaks or small logic additions in existing files under `src/app/` and `src/components/`. No new API routes. No new data sources. No schema changes. Two small helpers extracted (`formatAge`, navigate URL).

**Tech Stack:** Next.js 16.2.2 (App Router), TypeScript, Tailwind v4. Read `node_modules/next/dist/docs/` before implementation (per AGENTS.md).

---

## 1. Verification summary

| ID | Finding | Verdict | File reference |
|---|---|---|---|
| P0.1 | Footer says "Prices updated daily" | **Confirmed** — misleading global claim | `src/app/page.tsx:211` |
| P0.2 | No SA/VIC/ACT coverage | **Partially handled** — trip planner warns, home map doesn't | `src/lib/trip-planner.ts:385–390` |
| P0.3 | "⛽ Excise: off" is unclear | **Confirmed** | `src/components/ExciseToggle.tsx:32` |
| P1.1 | 9 fuel types in flat pill bar | **Partially correct** — it's actually a native `<select>`, not a pill bar, but the flatness problem stands | `src/components/FuelSelect.tsx:11–25` |
| P1.2 | First-run flow weak | **Confirmed** — geolocation fires, but no Trip Planner CTA surfaces | `src/components/MapView.tsx:96–124`, `src/app/page.tsx` |
| P1.3 | Station popup missing age/nav/trends/effective-price | **Confirmed across the board** | `src/components/MapView.tsx:290–310` |
| P1.4 | Discounts not discoverable | **Confirmed** — menu-only, no first-run prompt | `src/app/discounts/page.tsx` |
| P2.1 | Vehicle setup is engineering-spec | **Confirmed** — no CarQuery; manual L/100km + tank | `src/components/TripForm.tsx:449–485` |
| P2.2 | "Arrive with full tank" buried | **Partially correct** — a visible checkbox, but page headline is just "Trip Planner" | `src/components/TripForm.tsx:507–522` |
| P2.3 | Jerry cans default-visible | **Confirmed — compromise agreed** (tickbox reveal, not "Advanced options" burial) | `src/components/TripForm.tsx:474–483` |
| P2.4 | 10% reserve too low for remote routes | **Confirmed** — no auto-bump; defer | `src/components/TripForm.tsx:535` |
| P2.5 | Google Maps import unclear | **Already handled** — errors + validation exist; just polish the placeholder | `src/components/TripForm.tsx:239–262` |
| P2.6 | "Save" button ambiguous | **Confirmed** — does save to localStorage; 1-line copy fix | `src/components/TripForm.tsx:79–93` |
| P2.7 | Return trip leaves savings on the table | **Not applicable** — verified as single-leg OSRM optimisation with clear UI signal | `src/app/api/trip-plan/route.ts:44–51` |
| P3.1 | Accessibility spotty | **Partially correct** — toggles OK; fuel `<select>` relies on native semantics | multiple |
| P3.2 | No offline cache | **Confirmed** — no service worker; defer | — |
| P3.3 | No price alerts | **Confirmed** — defer; reviewer flagged as future | — |
| P3.4 | Monetisation angles | **Defer** — reviewer said "flag, don't build" | — |

### Extra findings (reviewer didn't flag)
1. **NSW coverage warning is stale.** `src/lib/trip-planner.ts:385–390` still lists NSW as missing, but a NSW fetcher exists and runs. Fix alongside P0.1.
2. **Brand mapping is built but unused visually.** `src/lib/fuel-codes.ts` has 58-entry QLD_BRAND_MAP + NT_BRAND_MAP. Brand displays as plain text, no logos. Leaving alone; brand logo work deserves a dedicated design pass (IP, asset store, retina handling).
3. **Settings page has a `homeLocation` that never auto-centres the home map.** Opportunity but not in this plan.

---

## 2. Where I disagree with the reviewer

- **P0.2 (SA/VIC/ACT coverage) is not a P0.** The fix the reviewer proposes ("investigate SA SafePrice API" / "scope VIC scraping") is a multi-week data-integration project, not a UX trust repair. The real P0 trust failure is **the global "updated daily" label**, which is already on the list. The coverage story is adequately handled today in the trip planner (warnings) and the home map shows empty — that's honest, not deceptive. I'd move this to a separate design doc.
- **P2.3 (jerry cans) — compromise.** Reviewer wanted it under "Advanced options"; I pushed back because the target audience (NT regional, grey nomads) genuinely uses jerry cans. Agreed middle ground: a **binary tickbox** ("I'm carrying jerry cans") as the default control. Only if ticked does the litre-input reveal. Simpler mental model, one click for the nomads who need it, zero noise for the Brisbane→Gold Coast case. Folded into Commit 5.
- **P2.7 (return trip) resolved.** Verification shows it's a single OSRM call with UI signal ("route back via same stops"). No action.
- **P1.1 (fuel selector) framing.** Reviewer calls it a "pill bar" — it's a native `<select>`. That changes the right fix: swap for a primary-chip + "more" pattern rather than shrinking an existing pill bar. Also: OPAL geofencing is a good call, but the NT/SA/WA remote regions are actually where most of this app's traffic comes from, so OPAL should probably **stay visible** here specifically. Marginal call — keep OPAL as a non-primary but not-hidden option.

---

## 3. Commit-sized tasks

Six commits, each small enough to review in one sitting. Ordered by ROI per hour.

### Commit 1 — Trust & labelling (P0.1, P0.3, NSW warning)

**Why first:** Misleading copy is the fastest credibility drain. Fixes are 5–30 min each.

**Files:**
- Modify: `src/app/page.tsx:211` (footer)
- Modify: `src/components/ExciseToggle.tsx:31–32, 45` (label text)
- Modify: `src/components/ExciseToggle.tsx:24–28` (tooltip copy)
- Modify: `src/lib/trip-planner.ts:385–390` (remove NSW from missing-states warning)

**Changes:**

1. Replace footer line 211:
   ```tsx
   <a
     href="/data-freshness"
     className="underline opacity-80"
   >
     Data freshness varies by state →
   </a>
   ```

2. Create `src/app/data-freshness/page.tsx` (short static MDX-style page):
   - NSW: near real-time via FuelCheck
   - QLD: 30-min rule (legally mandated updates on price change)
   - WA: 24h delay by law (FuelWatch publishes next-day prices)
   - NT: varies by retailer
   - TAS: varies
   - Why "updated daily" is a simplification and how the popup timestamp is authoritative.

3. Rename excise toggle. Desktop pill:
   ```tsx
   <span>{mode ? "Pre-rebate view: on" : "Excise checker"}</span>
   ```
   Mobile menu row keeps "Excise mode" label but adds a 1-line helper under it explaining the April 2026 excise halving.

4. In `src/lib/trip-planner.ts:385–390`, remove NSW from the `missing = ["NSW", "SA", "VIC", "TAS"]`-style array. Verify against surrounding lines — the list currently looks stale.

**Risk:** Low. Pure copy + one page create.

**Verify:** Dev server, click header toggle, hover tooltip on desktop. Plan a trip through NSW → confirm warning doesn't mention NSW.

**Commit message:** `fix: clarify data-freshness labelling and excise toggle copy`

---

### Commit 2 — Station popup upgrades (P1.3 timestamps + navigate)

**Why second:** Extends the `formatAge` helper already written in `ExciseStatusBar.tsx:14–19` — trivial reuse. Adds navigation deeplinks (pure URL scheme, no API). Both visible on every popup open.

**Files:**
- Create: `src/lib/time-format.ts` (extract `formatAge`)
- Modify: `src/components/ExciseStatusBar.tsx` (import from new location; delete local copy)
- Modify: `src/components/MapView.tsx:290–310` (swap `toLocaleDateString` for `formatAge`, add Navigate links)
- Create: `src/lib/__tests__/time-format.test.ts`

**Step-by-step:**

1. **Write the failing test** for `formatAge`:
   ```ts
   import { formatAge } from '../time-format';
   describe('formatAge', () => {
     it('returns minutes for ages under 1h', () => {
       const ts = new Date(Date.now() - 30 * 60_000).toISOString();
       expect(formatAge(ts)).toBe('30m ago');
     });
     it('returns hours for ages 1–48h', () => {
       const ts = new Date(Date.now() - 5 * 60 * 60_000).toISOString();
       expect(formatAge(ts)).toBe('5h ago');
     });
     it('returns days for ages over 48h', () => {
       const ts = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
       expect(formatAge(ts)).toBe('3d ago');
     });
   });
   ```
2. Run `npx jest src/lib/__tests__/time-format.test.ts` — expect red (module not found).
3. Create `src/lib/time-format.ts` with the exact `formatAge` from `ExciseStatusBar.tsx:14–19`.
4. Run test — expect green.
5. Delete the local copy in `ExciseStatusBar.tsx`; add `import { formatAge } from "@/lib/time-format";`
6. In `MapView.tsx:304–306`, replace:
   ```tsx
   Updated: {new Date(priceEntry.updated).toLocaleDateString()}
   ```
   with:
   ```tsx
   Updated {formatAge(priceEntry.updated)}
   ```
7. Add a Navigate row below the prices block (inside the default popup, before the `<div className="text-xs...">`):
   ```tsx
   <div className="flex gap-2 mt-2 text-xs">
     <a
       href={`https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`}
       target="_blank"
       rel="noopener noreferrer"
       className="underline text-blue-600"
     >
       Google Maps
     </a>
     <a
       href={`http://maps.apple.com/?daddr=${station.lat},${station.lng}`}
       className="underline text-blue-600"
     >
       Apple Maps
     </a>
     <a
       href={`https://waze.com/ul?ll=${station.lat},${station.lng}&navigate=yes`}
       target="_blank"
       rel="noopener noreferrer"
       className="underline text-blue-600"
     >
       Waze
     </a>
   </div>
   ```
8. Run full Jest suite.
9. Dev-server check: pin popup now shows "Updated 3h ago" + three nav links.
10. Commit: `feat: station popup shows relative age and navigate deeplinks`

**Risk:** Low. URL schemes are stable. Deeplinks open the user's preferred app — no SDK involvement.

---

### Commit 3 — Fuel type reorganisation (P1.1)

**Why:** Cheap cognitive-load win. 90%+ of users want the first four options.

**Files:**
- Modify: `src/components/FuelSelect.tsx` (rewrite as two-tier chip + disclosure)
- Modify: `src/lib/fuel-codes.ts` (add `primary: boolean` flag to each entry)

**Changes:**

1. Tag fuel codes. In `src/lib/fuel-codes.ts`, annotate the top four: ULP91, PULP95, PULP98, Diesel get `primary: true`. Others `primary: false`.
2. Rewrite `FuelSelect.tsx` as a 4-chip row + "More fuel types ▾" button that reveals a dropdown of the remaining 5.
3. Persist selection as today (`value` prop, `onChange` callback — no behavioural change).
4. `aria-pressed` on each chip; `aria-expanded` on disclosure button.

**Risk:** Low–medium. Visual regression possible on mobile breakpoints (header is compact). Test at 360 / 768 / 1280 widths.

**Verify:** Dev server. Click each primary chip; click "More" → confirm dropdown. Reload → selection persists if it was persisted before.

**Commit message:** `feat: surface four primary fuel types, hide niche types behind disclosure`

---

### Commit 4 — Discount discoverability + effective price in popup (P1.4 + P1.3 effective-price)

**Why:** Discount engine already shipped (Part 2.1, 2026-04-16). It's invisible unless the user digs into a menu. Surfacing it on the home map via popup is the highest-leverage move because it makes the already-built differentiator land.

**Files:**
- Create: `src/components/DiscountNudge.tsx` (one-time dismissible card)
- Modify: `src/app/page.tsx` (render nudge above map on first visit if no discounts enabled)
- Modify: `src/components/MapView.tsx:290–310` (apply active discounts to displayed price; show rack as secondary)
- Create: `src/lib/__tests__/discount-apply.test.ts` (or extend existing discounts tests)
- Modify: `src/lib/discounts.ts` (expose a `applyToStation(station, activeDiscounts)` helper if not already present)

**Step-by-step:**

1. **Write failing tests** for `applyToStation`:
   - returns rack price when no discounts active
   - applies a 4¢/L fixed c/L discount correctly
   - applies a % cashback discount correctly (effective = rack × (1 − pct/100))
   - applies the lowest-effective-price discount when multiple match
2. Implement helper in `src/lib/discounts.ts`.
3. Run tests green.
4. In `MapView.tsx:298–303`, swap the headline price rendering:
   ```tsx
   {station.prices.map((p) => {
     const eff = applyToStation(station, p, activeDiscounts);
     return (
       <div key={p.fuel} className="flex justify-between gap-4">
         <span>{p.fuel}</span>
         <span className="text-right">
           <strong>{eff.price.toFixed(1)} c/L</strong>
           {eff.applied && (
             <span className="block text-[11px] text-gray-500 line-through">
               {p.price.toFixed(1)}
             </span>
           )}
         </span>
       </div>
     );
   })}
   ```
5. Thread `activeDiscounts` from `useDiscounts` (or equivalent hook — verify name during implementation) into `MapView` props.
6. Build `DiscountNudge.tsx`: a compact card — "Set your discounts to see real prices. AANT members save 8¢/L. [Set up] [Not now]". On "Not now" set a localStorage key `fuelsmart-discount-nudge-dismissed=true`. On "Set up" navigate to `/discounts`.
7. Render conditionally in `src/app/page.tsx` above the map only if:
   - `localStorage["fuelsmart-discount-nudge-dismissed"] !== "true"`, AND
   - `activeDiscounts.length === 0`.
8. Dev-server check: clear localStorage, reload → see nudge. Enable a discount → map popup shows effective price in bold with rack struck through.

**Risk:** Medium. This is the one commit with a real behaviour change. Get the rack-struck-through semantics right — some users may confuse struck-through with "out of date."

**Commit message:** `feat: surface active discount as effective price, prompt on first visit`

---

### Commit 5 — Trip Planner framing (P2.2 headline, P2.3 jerry-can tickbox, P2.5 placeholder, P2.6 Save rename)

**Why:** Four small copy/UX polishes on the Trip Planner. Cheap to ship together because they touch the same file.

**Files:**
- Modify: `src/app/trip/page.tsx` (page headline + subhead)
- Modify: `src/components/TripForm.tsx:79–93` (Save button rename + helper text)
- Modify: `src/components/TripForm.tsx:239–262` (Google Maps import: placeholder example)
- Modify: `src/components/TripForm.tsx:474–483` (jerry-can field → tickbox + conditional reveal)

**Changes:**

1. Trip Planner headline. Replace `"Trip Planner"` with:
   ```tsx
   <h1 className="text-2xl font-semibold">Arrive with a full tank — cheapest fuel along your route</h1>
   <p className="text-sm text-gray-400">We'll plan your fill-ups so you get to your destination with whatever tank level you choose — not just "not empty."</p>
   ```
2. "Save" button → `"Remember this vehicle on this device"` with a helper hint:
   ```tsx
   <button>Remember on this device</button>
   ```
   Small help text underneath: `Saved to your browser — not synced across devices.`
3. Google Maps import field placeholder:
   ```tsx
   <input
     placeholder="https://maps.app.goo.gl/... or google.com/maps/dir/..."
     ...
   />
   ```
   Plus a 1-line hint under the field: `Paste a share link from Google Maps → Directions → Share.`

4. Jerry-can field → tickbox reveal. In `TripForm.tsx:474–483`, replace the always-visible L input with a two-stage control:
   ```tsx
   <label className="flex items-center gap-2">
     <input
       type="checkbox"
       checked={form.hasJerryCans}
       onChange={(e) =>
         setForm({
           ...form,
           hasJerryCans: e.target.checked,
           jerryL: e.target.checked ? form.jerryL || 20 : 0,
         })
       }
     />
     <span>I'm carrying jerry cans</span>
   </label>
   {form.hasJerryCans && (
     <input
       type="number"
       min={0}
       step={1}
       value={form.jerryL}
       onChange={(e) => setForm({ ...form, jerryL: Number(e.target.value) })}
       className="..." // same classes as the other numeric inputs
       placeholder="Litres (e.g. 20)"
     />
   )}
   ```
   Add `hasJerryCans: boolean` to the form state type and default to `false`. If a saved vehicle has `jerryL > 0`, set `hasJerryCans: true` on load so it still displays correctly. Default litres when first ticked: 20L (standard jerry can size).

**Risk:** Low — copy/placeholder changes plus one conditional render. The jerry-can save/load needs the `hasJerryCans: jerryL > 0` reconciliation on vehicle-profile load (verify `src/lib/vehicles.ts` round-trip).

**Commit message:** `feat: clarify Trip Planner headline and input labelling`

---

### Commit 6 — Accessibility sweep (P3.1)

**Why last:** Good end-of-sprint hygiene pass once the other copy is settled (otherwise the ARIA labels you add will get rewritten).

**Scope:**
- Run axe DevTools against `/`, `/trip`, `/discounts`, `/compare`, `/additives`, `/excise`, `/settings`.
- Fix anything flagged as A or AA.
- Manual check: tab through every interactive element on the home page — confirm focus ring visible, order makes sense.
- Zoom browser to 200% — confirm no horizontal scroll on mobile breakpoint.
- Contrast check: `text-gray-400` on `bg-slate-800` (likely fine), `text-gray-500 mt-1` on white popup (check).

**Files:** Many, likely small edits each.

**Risk:** Low. Pure attribute additions + Tailwind class tweaks.

**Commit message:** `a11y: close AA gaps flagged by axe audit`

---

## 4. Explicitly deferred

These are **not** in this plan. Each warrants its own design pass.

| Item | Why deferred |
|---|---|
| **P2.1 CarQuery integration** | Biggest genuine gap the reviewer found, and the highest-leverage single change — *but* it's its own project (API selection, caching, fallback handling, data freshness, make/model/year autocomplete UX). Write a separate design doc. |
| **P1.3 30-day price trend** | No historical-price store exists. Either needs a new Upstash collection with daily snapshots (cron job already exists — could piggyback) or pulls from QLD/NSW gov APIs that expose history. 1-week scope. |
| **P1.3 Brand logos** | Asset sourcing (IP-safe logos), retina handling, fallback for unknown brands. ~3 days incl. legal check. |
| **P0.2 SA/VIC/ACT fetchers** | Engineering project, not UX fix. SA SafePrice API investigation, VIC scraping feasibility, ACT rollup from NSW. Own design doc. Current warnings are honest — not a trust failure. |
| **P2.4 Remote-route reserve auto-bump** | Needs a "longest gap between stations on route" analysis hook that doesn't yet exist. Logic would live in `src/lib/trip-planner.ts`. Scope with CarQuery. |
| **P3.2 Offline / service worker** | Real engineering. Needs a strategy discussion (Workbox? manual?) and an offline UI story. |
| **P3.3 Price notifications** | Push infra + subscription management + per-area price tracking. New feature, not a fix. |
| **P3.4 Monetisation/segments** | Reviewer flagged as "flag, don't build." Persist in memory, revisit quarterly. |

---

## 5. Estimated effort

| Commit | Scope | Effort |
|---|---|---|
| 1. Trust & labelling | 1 page create, 3 copy edits | ~1h |
| 2. Popup upgrades | 1 helper extract, 1 Jest file, 2 popup edits | ~1.5h |
| 3. Fuel type reorg | Refactor + chip design | ~1.5h |
| 4. Discount discoverability | Tests + helper + nudge + popup rework | ~3h |
| 5. Trip Planner framing | Copy + jerry-can tickbox reveal | ~1h |
| 6. A11y sweep | Audit + fixes | ~2h |
| **Total** | | **~9.5–10.5h** |

---

## 6. Execution handoff

Plan complete and saved to `docs/plans/2026-04-21-ux-review-response-plan.md`.

**Do not start implementation until the user approves a subset.** Likely approval shape:

- **Fastest trust fix:** Commits 1 + 2 only (~2.5h) — lands the things the reviewer correctly flagged as trust-damaging.
- **Full sprint:** Commits 1–6 (~9–10h) — complete response, new items stay deferred.
- **Targeted:** User picks specific commits.

Once a subset is approved, two execution options:

1. **Subagent-driven (this session)** — dispatch a fresh subagent per commit, code-review between each. Fast iteration, tight loop.
2. **Parallel session** — open a new Claude session in a worktree, batch commits 1–3 with checkpoints.

**Awaiting user direction. No code changes yet.**
