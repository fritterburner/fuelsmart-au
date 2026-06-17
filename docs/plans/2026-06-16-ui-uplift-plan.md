# UI uplift — clustered by effort (for working through methodically)

**Date:** 2026-06-16
**Context:** side-by-side review against PetrolSmart. Constraints: keep our colour scheme, stay privacy-first/device-only, single Next.js codebase. Everything below is additive polish unless noted.

---

## ⚠ First, a non-UI gap worth flagging: refresh cadence

PetrolSmart says "refreshed every few minutes." **We refresh once a day** (the Vercel cron is `0 20 * * *`), so the live map can be up to ~24 h stale even though each pin shows its own report time. The state feeds themselves update near-real-time (NSW's 30-min rule, etc.) — we're just not pulling often enough.

- **Fix:** run the refresh cron every ~15–30 min instead of daily.
- **Catch:** Vercel **Hobby crons are limited to once/day** — frequent refresh needs **Vercel Pro**, or an external scheduler (GitHub Actions / cron-job.org / Upstash QStash) hitting `/api/cron/refresh` on a tight schedule. Also re-check each feed's rate limits.
- **Effort:** Medium. **Value: high** — it's the core "live prices" promise. I'd prioritise this above most of the cosmetic items.

---

## Sources — are we on the right ones?

Yes — identical official feeds to PetrolSmart: **NSW FuelCheck (covers ACT), FuelWatch WA, MyFuel NT, QLD Fuel Price Reporting, FuelCheck TAS**, plus **VIC Servo Saver** and **SA FPIS** pending keys. PetrolSmart labels Victoria's feed "Victorian FuelCheck" — that's a loose name; Victoria's official scheme is **Servo Saver** (Service Victoria), which is what we use. No source changes needed; the gap is cadence (above), not provenance.

---

## EASY (high polish-per-effort, low risk)

1. **Cleaner basemap.** Swap the default OSM tiles for a light, low-noise basemap (e.g. Carto Positron — free, attribution required, what PetrolSmart appears to use). ~1-line `TileLayer` change; instantly less "busy" behind the pins.
2. **Pin restyle** (keep the green/amber/red/grey ranks). Redesign `createPriceIcon`: a cleaner price "pill" with a pointer tail, better weight/letter-spacing, subtle shadow, and the cheapest pins visually lifted (slightly larger / ring). Contained to one function. Tasteful, on-brand.
3. **`/terms` page + footer slim-down.** Add a Terms page; move the data-source/attribution prose out of the home footer into `/data-freshness`, `/privacy`, and `/terms`; reduce the footer to a tidy row of links. (You already have `/privacy`.) Stops you hand-editing footer text.
4. **Freshness chip.** A small "Updated Xm ago / source" indicator (we already store per-state timestamps via `/api/meta`) so users see currency at a glance — PetrolSmart leans on this.
5. **Area-average copy/affordance.** Result-on-tap is now fixed; add a one-line hint and a clear "✕ done" to exit area mode.
6. **A11y + control consistency pass.** focus-visible rings, consistent button/disclosure styles, aria labels on the map controls.

## MEDIUM

7. **Persistent station sidebar (desktop).** The thing you liked. A right (or left) panel listing in-view stations **sorted by price**, each row = brand, name, address, price (+ after-discount), click-to-fly-to-pin, and a "cheapest in view" highlight card. Syncs with the map viewport. *What's involved:* a new list panel component fed by the same `stations` MapView already holds, a sort, viewport filtering, and click→`flyTo` wiring. (Distance sort needs geolocation — that's the Hard extension.)
8. **Area-average → fixed result card.** Promote the readout from a map popup to a small persistent card (like PetrolSmart's "cheapest nearby"), so it's always visible while you pan.
9. **Map marker clustering.** At low zoom, dense metros are a wall of overlapping pills. Cluster them (e.g. `react-leaflet-markercluster`) and expand on zoom — big readability win.
10. **Brand / fuel filters on the map.** PetrolSmart has a brand dropdown + fuel chips. We have fuel selection; add a brand filter (we already canonicalise brands) and surface fuel chips on the map view.
11. **Dark mode.** A theme toggle (PetrolSmart has one). Tailwind `dark:` variants + a persisted preference.

## HARD

12. **Full sidebar parity.** #7 plus a virtualised list (hundreds of rows), **distance sort** with geolocation, brand+state filters, and map↔list hover-sync (hover a row → highlight its pin and vice-versa).
13. **PWA + web push** (the separate functional track we discussed) — installable + price alerts. The last real PetrolSmart *feature* gap.
14. **Design-system pass.** Spacing/typography scale, colour tokens, component primitives — so future UI stays consistent. Worthwhile once the above lands.

---

## Suggested order
Quick visual wins first (1 → 2 → 4), then the **refresh-cadence** fix (highest substantive value), then the **sidebar** (7) as the flagship UI upgrade, with `/terms`+footer (3) slotted in anywhere. Clustering, dark mode, and PWA/push follow.
