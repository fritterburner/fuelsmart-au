# Brand + State Aware Discounts — Implementation Plan

**Date:** 2026-04-22
**Source:** User ask, 2026-04-22: discounts need per-brand and per-state conditions, and the A/B calculator page should go away in favour of always-on effective pricing on the main map.
**Posture:** Walked the repo. Current `Discount` model + `/discounts` UI + fetcher brand shapes verified against real code. Commits themed. Plan first, implementation after user approval.

> **For Claude:** REQUIRED SUB-SKILL — use `superpowers:executing-plans` once the user approves a subset.

**Goal:** Make saved discounts filter by brand and state so that real-world offers (AANT-only-at-United-in-NT, RACQ-at-Puma-in-QLD, Coles shopper dockets) apply correctly and automatically on the main map — and retire the A/B calculator screen the user says is confusing.

**Architecture:** Extend `Discount` type with two optional filter lists. Update `applyToStation` (already used by map popup + nudge) to check brand/state match before applying. Introduce a canonical brand taxonomy + per-feed normalisation because three state fetchers emit free-form brand strings that don't agree on spelling. Rewrite `/discounts` page as a config-only list; drop the A/B calculator block.

**Tech Stack:** Next.js 16.2.2 App Router, TypeScript, Tailwind v4. Consult `node_modules/next/dist/docs/` per `AGENTS.md` for any Next-specific change.

---

## 1. Current state — verified in repo

| Area | Today | File |
|---|---|---|
| Discount type | `{id, name, type, value, appliesTo: "both"\|"A"\|"B", enabled}` | [src/lib/discounts.ts:7-15](src/lib/discounts.ts) |
| Map-popup discount | `applyToStation(pumpCpl, discounts)` — stacks enabled `appliesTo:"both"` fixed_cpl + percent_cashback | [src/lib/discounts.ts](src/lib/discounts.ts) |
| Seed presets | Coles docket, RACQ, Amex, 7-Eleven — all with `appliesTo:"both"`, no brand/state filter | [src/lib/useDiscounts.ts](src/lib/useDiscounts.ts) |
| Config + calculator UI | One page: lists discounts + runs A/B calculator side-by-side | [src/app/discounts/page.tsx](src/app/discounts/page.tsx) |
| First-run nudge | Points at `/discounts` | [src/components/DiscountNudge.tsx](src/components/DiscountNudge.tsx) |
| Station brand field | `Station.brand: string` (non-empty, sometimes raw retailer) — `Station.state` is one of `NSW\|QLD\|NT\|WA\|TAS` (no SA/VIC/ACT) | [src/lib/types.ts](src/lib/types.ts) |

### Fetcher brand shapes (the ugly part)

| State | Brand comes from | Shape |
|---|---|---|
| QLD | `QLD_BRAND_MAP[site.B]` — curated 20-entry numeric map | Canonical names ("Shell", "BP", "7-Eleven") |
| NT | `NT_BRAND_MAP[brandCode]` — curated 22-entry code map | Canonical names ("United", "AMPOL", "Shell") |
| NSW | `station.brand` from FuelCheck NSW API | **Free-form string** — whatever NSW emits |
| TAS | `station.brand` from FuelCheck TAS API | **Free-form string** — probably same format as NSW |
| WA | `item.brand` from FuelWatch WA | **Free-form string** |

File references: [src/lib/fetchers/qld.ts:71](src/lib/fetchers/qld.ts), [nt.ts:65](src/lib/fetchers/nt.ts), [nsw.ts:98](src/lib/fetchers/nsw.ts), [tas.ts:93](src/lib/fetchers/tas.ts), [wa.ts:59](src/lib/fetchers/wa.ts).

**Consequence:** "Coles Express" in a user's discount might never match a NSW station that emits "ColesExpress" or "Shell Coles Express". Brand normalisation is not optional — it's the foundation the UI sits on.

---

## 2. Data model change

Extend `Discount`:

```ts
interface Discount {
  id: string;
  name: string;
  type: "fixed_cpl" | "percent_cashback";  // drop fixed_rebate — see below
  value: number;
  enabled: boolean;

  // NEW
  brands: string[];   // canonical brand names; empty = any brand
  states: string[];   // AU state codes (NSW/QLD/VIC/SA/WA/NT/TAS/ACT); empty = any state

  // REMOVED
  // appliesTo: "both" | "A" | "B"  — A/B calc is gone
}
```

Backwards-compatible defaults: empty `brands` + empty `states` = "applies everywhere", which matches today's `appliesTo:"both"` behaviour.

**Why drop `fixed_rebate`?** The map popup doesn't know fill size, so fixed-$-off-per-fill can't be expressed as a per-litre number anyway (already filtered out in the current `applyToStation`). With the A/B calculator gone there's no consumer for it. Keeping it around is dead code.

### `applyToStation` semantic extension

```ts
export function applyToStation(
  station: Station,
  pumpCpl: number,
  discounts: Discount[],
): { effectiveCpl: number; applied: Array<{id, name, valueCpl}> }
```

Matching condition per discount:
- `d.enabled` is true, AND
- `d.brands.length === 0 || d.brands.includes(station.brand)`, AND
- `d.states.length === 0 || d.states.includes(station.state)`

Matching discounts stack the same way `effectiveCpl` already does. Signature changes from `(pumpCpl, discounts)` to `(station, pumpCpl, discounts)` — small callsite update in `MapView.tsx` (~3 lines).

### Migration

Existing saved discounts in localStorage predate `brands`/`states`. On load: if those keys are missing, default both to `[]`. Already-saved `appliesTo` is ignored (no migration needed, field just becomes unused).

---

## 3. Brand taxonomy — `src/lib/brands.ts`

New module. Single source of truth.

```ts
export const CANONICAL_BRANDS = [
  "7-Eleven",
  "Ampol",        // formerly Caltex — still partially co-branded
  "Astron",
  "BP",
  "Better Choice",
  "Caltex",
  "Caltex Woolworths",
  "Coles Express",     // Shell Coles Express after 2023 rebrand — TBD how feeds report
  "EG Ampol",
  "Freedom Fuels",
  "Gull",
  "Independent",
  "Liberty",
  "Metro Fuel",
  "Mobil",
  "Puma Energy",
  "Shell",
  "United",
  "X Convenience",     // WA independent
  // ... expand as we see more in live data
] as const;

export type CanonicalBrand = (typeof CANONICAL_BRANDS)[number];

/**
 * Normalise a raw brand string from any fetcher into a canonical brand.
 * Unknown → returned verbatim so the station still has a name.
 */
export function normaliseBrand(raw: string): string { ... }
```

Normalisation strategy: case-insensitive + alias map. `"COLES EXPRESS"` → `"Coles Express"`, `"Shell Coles Express"` → `"Coles Express"`, `"ColesExpress"` → `"Coles Express"`, etc. Alias map grows as we see what the free-form fetchers emit.

### Per-fetcher integration

- NSW, TAS, WA: call `normaliseBrand(rawBrand)` before writing to `Station.brand`.
- QLD, NT: already canonical. Verify their entries match `CANONICAL_BRANDS` and rename any that don't (`"AM/PM"` → `"AMPM"`? Or add as-is).

### Discovery step (required before UI work)

Before writing the multi-select, run a one-shot script that:
1. Calls all five fetchers against real APIs,
2. Tallies the distinct brand strings per state,
3. Dumps them to `docs/reference/brand-samples-2026-04-22.md` as a checklist.

This becomes the input to the `CANONICAL_BRANDS` list and alias map. Without it, the checkbox list in the UI is guesswork and users will silently fail to match stations.

**Effort: ~45 min** (most of that is scheduling a manual run since tests fail without `QLD_FPD_API_TOKEN`). Could be a separate throwaway script — doesn't need to ship.

---

## 4. UI — replace `/discounts` with a config-only page

Current `/discounts` has three sections: (1) Station A input, (2) Station B input, (3) discount list. We delete (1) and (2).

New page shape:

```
┌──────────────────────────────────────────────┐
│ ← Back to map                                 │
│                                                │
│ Your discounts                                 │
│ Applied automatically to every station on     │
│ the map. Leave brand or state empty to make   │
│ a discount match everywhere.                  │
│                                                │
│ ┌────────────────────────────────────────┐    │
│ │ [✓] Coles shopper docket     [edit ⌄]  │    │
│ │     4 c/L off                          │    │
│ │     Brands: Coles Express              │    │
│ │     States: (any)                      │    │
│ └────────────────────────────────────────┘    │
│                                                │
│ ┌────────────────────────────────────────┐    │
│ │ [✓] AANT member               [edit ⌄] │    │
│ │     4 c/L off                          │    │
│ │     Brands: United                     │    │
│ │     States: NT                         │    │
│ └────────────────────────────────────────┘    │
│                                                │
│ + Add discount                                │
└──────────────────────────────────────────────┘
```

Card edit expands inline with:
- Name (text)
- Type (select: "c/L off" / "% cashback")
- Value (number)
- Brands (checkbox group fed from `CANONICAL_BRANDS` + "All brands" clear button)
- States (checkbox group: NSW/QLD/VIC/SA/WA/NT/TAS/ACT + "All states" clear)
- Save / Delete buttons

### Seed presets (updated)

| Name | c/L or % | Brands | States |
|---|---|---|---|
| Coles shopper docket (4c/L) | 4 c/L | `Coles Express` | (any) |
| Woolworths Rewards (4c/L) | 4 c/L | `Caltex Woolworths`, `EG Ampol` | (any) |
| RACQ member (4c/L) | 4 c/L | `Puma Energy`, `Better Choice` | `QLD` |
| AANT member (4c/L) | 4 c/L | `United` | `NT` |
| NRMA member (4c/L) | 4 c/L | `Ampol` | `NSW`, `ACT` |
| RACV member (4c/L) | 4 c/L | `Ampol` | `VIC` |
| RAA member (4c/L) | 4 c/L | `Ampol` | `SA` |
| 7-Eleven Fuel Price Lock | 0 c/L | `7-Eleven` | (any) |
| Amex / card cashback 2% | 2 % | (any) | (any) |

All seed presets ship with `enabled: false` — users opt in per their own memberships. Brand/state values SME-confirmable later.

### Files affected

- Rewrite: [src/app/discounts/page.tsx](src/app/discounts/page.tsx) — drop A/B calc, rebuild as card list.
- Modify: [src/components/DiscountNudge.tsx](src/components/DiscountNudge.tsx) — copy update (still points to /discounts but the page is different).
- Modify: [src/lib/useDiscounts.ts](src/lib/useDiscounts.ts) — update `SEED_DISCOUNTS` with new brands/states fields; add migration on load.
- Unchanged: [src/components/MapView.tsx](src/components/MapView.tsx) — only the `applyToStation` callsite changes (pass `station` as first arg). Line diff is trivial.

---

## 5. Commit plan

Four themed commits. Ordered so each is reviewable and leaves the tree in a working state.

### Commit A — brand taxonomy + per-fetcher normalisation (~2h)

**Why first:** everything else depends on brand names being comparable.

**Files:**
- Create: `src/lib/brands.ts` (canonical list + `normaliseBrand` + alias map)
- Create: `src/lib/__tests__/brands.test.ts` (TDD — "Coles Express variants all normalise", "unknown raw returned verbatim")
- Modify: `src/lib/fetchers/nsw.ts` — normalise before writing
- Modify: `src/lib/fetchers/tas.ts` — normalise before writing
- Modify: `src/lib/fetchers/wa.ts` — normalise before writing
- Modify: `src/lib/fuel-codes.ts` — rename QLD/NT brand-map entries that don't match canonical ("AM/PM"? Double-check feed reality)

**Prerequisite:** Run the discovery script against real APIs (requires `QLD_FPD_API_TOKEN`) and commit the result as `docs/reference/brand-samples-2026-04-22.md`.

**Commit message:** `feat: canonical brand taxonomy with per-fetcher normalisation`

### Commit B — Discount type + applyToStation brand/state matching (~1.5h)

**Files:**
- Modify: `src/lib/discounts.ts` — extend `Discount`, update `applyToStation` signature (+station), drop `fixed_rebate` handling, drop `appliesTo` branching.
- Modify: `src/lib/__tests__/discounts.test.ts` — update existing tests, add:
  - brand filter — matching station
  - brand filter — non-matching station
  - state filter — matching and not
  - combined brand+state — AND semantics
- Modify: `src/components/MapView.tsx` — pass `station` as first arg to `applyToStation`.
- Modify: `src/lib/useDiscounts.ts` — migration: `loadDiscounts()` fills in `brands: []`, `states: []` for entries missing them.

**Risk:** Low. All tests should stay green via TDD.

**Commit message:** `feat: discounts can filter by brand and state`

### Commit C — `/discounts` page rebuild, drop A/B calculator (~3h)

**Files:**
- Rewrite: `src/app/discounts/page.tsx` — config-only card list with inline edit, multi-selects for brands + states.
- Modify: `src/lib/useDiscounts.ts` — update `SEED_DISCOUNTS` with realistic per-chain/per-state presets from §4.
- Modify: `src/components/DiscountNudge.tsx` — copy tweak ("Set up your loyalty cards, memberships, and cashback rules").

**Verify:**
- Dev server. Pick a discount, edit it, confirm save to localStorage. Navigate back to map. Click a station matching the brand/state — popup shows effective price. Click a station that doesn't match — popup shows rack only.
- Delete a seed discount, add a new custom one with a brand+state combo.
- Axe audit this page specifically (most new UI surface).

**Risk:** Medium. Behavioural change — users who relied on the A/B calculator lose it. Mitigated by the map popup showing what the calc used to show, automatically.

**Commit message:** `feat: rebuild /discounts as config-only, drop A/B calculator`

### Commit D — optional polish (~0.5h)

Small cleanups that make sense post-rebuild:
- Home page menu entry: rename "Cashback vs detour" → "Discounts" (was the old A/B framing).
- Footer / about copy if any references the A/B tool.

**Commit message:** `feat: reframe discounts menu entry after A/B removal`

---

## 6. Estimated effort

| Commit | Scope | Effort |
|---|---|---|
| Discovery script + brand sample dump | One-shot fetcher run | ~45m |
| A. Brand taxonomy + fetcher normalisation | New module + 3 fetcher edits + TDD | ~2h |
| B. Discount type + applyToStation | Type extension + 4 new tests + 1 callsite | ~1.5h |
| C. `/discounts` rebuild | Config-only UI + seed presets + nudge copy | ~3h |
| D. Menu rename polish | 1 file edit | ~0.5h |
| **Total** | | **~7.5–8h** |

---

## 7. Explicitly deferred

Same spirit as the UX plan — not in this plan's scope:

| Item | Why deferred |
|---|---|
| **SA / VIC / ACT station coverage** | Data problem, not UX. Canonical-brand presets include them (RACV, RAA, NRMA ACT) so they'll work the moment fetchers land. Separate design doc. |
| **Brand logos beside station names** | Once brand is canonical this becomes trivial, but IP-safe logo sourcing is a day's work on its own. |
| **Loyalty-point accrual** (Woolies earn points, not c/L) | Different mental model — "save" ≠ "earn". Out of scope. |
| **Auto-detect user's home state + surface state presets first** | Nice-to-have. Do after we see how users actually configure. |
| **Shareable discount profiles** ("Email me my discount setup" / QR) | Future-cycle. |

---

## 8. Open questions

1. **Fetcher brand discovery — who runs it?** The discovery script needs `QLD_FPD_API_TOKEN` + working NT source (which is currently upstream-offline per prior commit). If we run it now we miss NT brand data. Options: (a) run partial, backfill NT when their site is back; (b) wait. User to decide when to approve Commit A.

2. **Which Woolies partner is current?** Woolworths Rewards fuel discount has historically been at Caltex/Woolworths co-branded stations, then EG Ampol. Need to confirm the 2026 arrangement before shipping seed presets. SME question.

3. **Do we surface per-state auto club presets, or let users add them manually?** Plan §4 lists RACQ/NRMA/RACV/RAA/AANT. But some users may not drive outside their home state — showing them 6 club presets they don't care about is noise. Alternative: one generic "Auto club member (4c/L)" with the user picking their state. Leaning toward the explicit list (clearer) but user's call.

---

## 9. Execution handoff

Plan saved to `docs/plans/2026-04-22-brand-state-discounts-plan.md`.

**Do not start implementation until the user approves a subset.** Likely approval shapes:

- **Discovery first:** Just the fetcher-brand-sample script (~45m) so we know what we're working with before committing to canonical names.
- **Full build:** Discovery + Commits A–D (~8h).
- **Incremental:** A + B only, A/B calc survives for another round; do C + D once the model proves out.
- **Targeted subset:** user picks.

Once approved, switch to `superpowers:executing-plans` + `superpowers:using-git-worktrees` and work commit-by-commit with review checkpoints.

**Awaiting direction. No code changes yet.**
