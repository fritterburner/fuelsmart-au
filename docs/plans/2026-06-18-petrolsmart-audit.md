# FuelSmart AU vs PetrolSmart — parity audit & improvement backlog

**Date:** 2026-06-18
**Method:** Feature set verified against the live PetrolSmart site (petrolsmart.app) and cross-checked with 2026 reviews of the AU fuel-app field (PetrolSpy, MotorMouth). Our side reflects the current `fuelsmart-au` working tree.
**Bottom line:** We match or beat PetrolSmart on almost every *feature*. The one promise we don't keep is their headline — **"refreshed every few minutes."** That, plus **price alerts** and **installability (PWA)**, are the only things standing between us and clear parity-plus.

---

## 1. Parity matrix

Legend: ✅ match · ⭐ we exceed · ❌ gap · 🛈 deliberately different (privacy-first)

| Capability | PetrolSmart | FuelSmart | Notes |
|---|---|---|---|
| Live price map, colour-coded pins | ✅ | ⭐ | We add rank-based clustering with cheapest-price bubbles + a desktop station-list sidebar with brand filter |
| Official state feeds | NSW, WA, VIC, QLD, TAS, NT, SA, ACT | ✅ (NSW, WA, NT, QLD, TAS, ACT) / ❌ VIC, SA pending keys | Only true coverage gap; external dependency (keys applied for) |
| **Refresh cadence** | **Every few minutes** | ❌ **Daily** | The biggest substantive gap — see §3.1 |
| Per-station freshness ("mins since sync") | ✅ | ✅ | We show per-pin age + a global freshness chip |
| 7-day cycle-aware forecast | ✅ | ⭐ | Ours is also **excise/policy-event aware** (e.g. 30 Jun 2026 excise step) |
| 30-day price history | station + state | ⭐ | We add **region** history and **tap-an-area** averaged history |
| Trip / route planner | ✅ | ✅ | Both rank by detour tolerance, not just nearest |
| **Price alerts (station/state target → push)** | ✅ | ❌ | Their marquee retention feature — see §3.2 |
| **Installable app (iOS/Android/PWA)** | native apps | ❌ web only | See §3.3 |
| Accounts / sign-in | ✅ | 🛈 none | We're device-only by design; alerts can still be done without accounts (§3.2) |
| Fuel **logbook** (personal fill tracking) | ✅ | ❌ | Device-local version fits our model — see §3.5 |
| Spending **reports** | ✅ | ❌ | Pairs with logbook |
| National **trends** overview page | ✅ | ❌ (have `/history` w/ dropdown) | See §3.4 |
| SEO per-state / per-station pages | ✅ `/prices/[state]`, `/station/[id]` | ❌ (API only) | Discoverability — see §3.6 |
| After-discount / loyalty pricing | ❌ | ⭐ | Our differentiator |
| Running-cost + additives tools | ❌ | ⭐ | `/compare`, `/additives`, `/fill-up` |
| Ads | none | none | Both clean |

---

## 2. Where FuelSmart already leads (protect these — don't regress)

- **After-discount / loyalty pricing** — pins and the sidebar can show what *you'd actually pay*, not just the board price. PetrolSmart has nothing like it.
- **Excise/policy-aware forecast** — cycle model *plus* known policy events. More honest than a pure-cycle forecast around the excise step.
- **Tap-an-area average + 30-day area history** — arbitrary-radius local market read; PetrolSmart only does station/state.
- **Region granularity** — named ABS-based hubs, so metro cycles aren't blended into state mush.
- **Privacy-first, no accounts, no ads** — a genuine positioning wedge against an account-gated competitor.
- **Running-cost / additives / discount tools** — utilities they simply don't offer.

---

## 3. Gap backlog — prioritized by value × effort

### 3.1 Refresh cadence — daily → every few minutes  ⟵ #1, do this first
**Value: very high (it's their headline claim and our weakest point). Effort: medium.**
The state feeds update near-real-time; we only *pull* once a day (`vercel.json` cron `0 20 * * *`). The map can be ~24 h stale even though each pin shows its own report time.
- **Blocker:** Vercel **Hobby** crons are capped at once/day.
- **Options:** (a) **Vercel Pro** → cron every 1–15 min; (b) **external scheduler** — GitHub Actions scheduled workflow, cron-job.org, or **Upstash QStash** — hitting `/api/cron/refresh` every 5–15 min (cheapest, no plan change).
- **Watch:** re-check each feed's rate limits; stagger if needed. Keep the snapshot/history writes idempotent per day (already are).
- **Decision needed from you:** Pro vs external scheduler.

### 3.2 Price alerts (station or state target → notification)  ⟵ #2
**Value: high (retention/marquee). Effort: medium-high. Needs web push.**
- **Privacy-preserving design (no accounts):** Web Push uses a *pseudonymous browser subscription endpoint* — not a login. Store `{subscription, target, scope}` in Redis keyed by the existing pseudonymous id; the frequent cron (§3.1) compares live prices to targets and sends a push; **re-arm every 24 h** (mirror PetrolSmart).
- **Prereq:** the PWA/service worker in §3.3 (Push API needs a service worker) + VAPID keys (server env).
- **Flag (per your brief's "no accounts unless a feature needs one"):** alerts need a *server-stored push subscription*, but **not** a user account. We'd disclose the stored endpoint in the privacy policy. iOS requires the PWA to be installed to the home screen for push to fire — note in UI.

### 3.3 PWA / installability  ⟵ #3 (also unlocks §3.2)
**Value: high. Effort: medium.**
Add a web manifest + service worker so FuelSmart is installable ("Add to Home Screen") and offline-tolerant for the last-seen map. This closes the "Get the app" gap without building native apps, and is the foundation for push alerts.

### 3.4 National "Trends" overview page
**Value: medium. Effort: low-medium.**
PetrolSmart's `/trends` is a national landing: each state's cheapest + cycle position at a glance. We already have the data (state/region history + forecast); add a `/trends` page that surfaces all states' current cheapest, direction arrow, and "where in the cycle" — a strong shareable/SEO landing.

### 3.5 Personal fuel logbook + simple reports
**Value: medium (stickiness). Effort: medium. Fits privacy model perfectly.**
A **device-local** logbook (IndexedDB/localStorage): record fill-ups (litres, $, odometer), get c/L paid, $/100km, monthly spend. Pure client-side = "your logbook never leaves your device" — a privacy differentiator vs their account-based one. Pairs with a lightweight reports view.

### 3.6 SEO / shareable per-state & per-station pages
**Value: medium (discoverability/growth). Effort: medium.**
PetrolSmart has indexable `/prices/[state]` and `/station/[id]` pages with OG images. We have the APIs but no public pages. Adding server-rendered per-state and per-station pages (+ OG image) would drive organic traffic and make links shareable.

### 3.7 Smaller polish (easy, opportunistic)
- **Dark mode** (parked, low priority per your call) — Tailwind `dark:` + persisted pref.
- **Favourites / saved stations** — device-local star on a station; quick-access list.
- **Share a price** ("heads up for your mates", à la MotorMouth) — share-sheet link to a station/area.
- **Map: distance sort + "near me"** in the sidebar (geolocation) — sort the list by distance, not just price.
- **A11y pass** — focus-visible rings, aria labels on map controls, keyboard nav of the sidebar.

---

## 4. Recommended sequence

1. **Refresh cadence (§3.1)** — biggest credibility win; pick Pro or external scheduler.
2. **PWA (§3.3)** — install + offline + prerequisite for push.
3. **Price alerts (§3.2)** — the marquee retention feature, account-free.
4. **Trends page (§3.4)** + **SEO pages (§3.6)** — growth/discoverability (can run in parallel; low risk).
5. **Logbook (§3.5)** — stickiness, privacy-aligned.
6. **Polish (§3.7)** — slot in anywhere.

Coverage (VIC/SA) lands whenever the keys arrive — independent of the above.

---

## 5. Open decisions for you

1. **Refresh:** Vercel Pro, or external scheduler (GitHub Actions / QStash)? Determines §3.1.
2. **Alerts:** OK to store a *pseudonymous push subscription* server-side (no account, disclosed in privacy policy)? That's the one privacy concession alerts require.
3. **Priority order:** comfortable with §4 as written, or reshuffle?
