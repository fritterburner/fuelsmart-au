# Data-feed compliance register

**Date started:** 2026-06-15
**Why this exists:** every price feed we consume comes with licence terms. This is the living checklist we satisfy *before* a feed goes live, and the place to record obligations (attribution, currency display, usage reporting, redistribution limits). Update it whenever a feed's terms are confirmed or change.

> Note on process: accepting any feed's Terms / Acceptable Use / data-licence is a decision **Fred makes** during each provider's application flow — not something automated here. This register records what those terms require of the app.

---

## Live feeds — obligations & current status

| Feed | Licence basis | Key obligations | Status in app |
|---|---|---|---|
| **NSW + ACT FuelCheck** | NSW open data (FuelCheck) | Attribute source; present prices with their report timestamp; don't imply NSW Gov endorsement. | ✅ Attributed on `/data-freshness`; per-pin timestamps shown; ACT now labelled honestly. |
| **QLD Fuel Price Reporting** | QLD open data (aggregated by Informed Sources) | Attribute; show currency. | ✅ Attributed on `/data-freshness`. |
| **WA FuelWatch** | WA FuelWatch terms | Attribute; make clear the 24-hour-ahead / locked-price nature. | ✅ Attributed + 24h cadence explained. |
| **NT MyFuel** | NT open data | Attribute; show currency. | ✅ Attributed. |
| **TAS FuelCheck** | TAS FuelCheck | Attribute; show currency. | ✅ Attributed. |

General posture that already helps us comply: per-pin "last reported" timestamps, honest per-state cadence on `/data-freshness`, no claim of official endorsement, no resale.

---

## VIC — Servo Saver Open API (pre-build)

- **Access:** free; requires an approved **API Consumer ID**. Applied for (awaiting callback).
- **Terms:** must accept **Servo Saver Open API Terms & Acceptable Use policy** at application; subject to **rate limits**.
- **Obligations to honour in code:**
  - Display the **24-hour delay** honestly (treat like WA — never present a delayed price as live). Wire the feed `as_of` into the pin timestamp.
  - Respect rate limits (nightly cron + cache already does; confirm against documented limits once we have the key).
  - Attribute Service Victoria / Victorian Government on `/data-freshness`.
- **To confirm on approval:** exact JSON shape, documented rate limit, any attribution wording they mandate.

---

## SA — Fuel Pricing Information Scheme — TERMS CONFIRMED (Data Publisher T&Cs v1, Feb 2021)

Source: licence PDF supplied by Fred (`safuelpricinginformation.com.au/documents/TermsandConditions.pdf`). Access still gated on the data-publisher application/callback, but the terms are now known.

**Cost:** nominal **$1.10 (GST inclusive), payable on demand** (cl. 2.3). Effectively a peppercorn — not a commercial fee. Data must be **free to consumers** (cl. 2.4).

**Obligations to build:**
- **Attribution (cl. 3.1):** show on any copy of the data — *"Based on or contains data provided by the State of South Australia (Office of Consumer and Business Services) 2021-2023. Copyright of the State of South Australia."* (Confirm the year range is current with CBS.)
- **Distinguish sources (cl. 3.2):** SA data must be visibly distinct from other states' data.
- **Stale-data complaint path (cl. 3.3):** SA consumers must have an option to immediately raise a complaint to the State if data isn't current — i.e. a "report stale price to CBS" link on SA stations.
- **No endorsement / no logos (cl. 3.5):** must not imply SA Gov endorsement or use its logos/trademarks.
- **Stop on termination (cl. 3.4):** kill the SA feed if the licence ends.
- **API key monitoring (cl. 2.2):** the key carries unique credentials; access is monitored.
- **Audit cooperation (cl. 4):** must cooperate with reasonable State audits of our practices/records relating to the data.
- **Disclaimer + indemnity (cl. 5):** ⚠ we accept all risk of using the data AND **indemnify the State** against loss caused by our use of it (except where caused by the aggregator). This is a real liability commitment — Fred should read cl. 5 before signing.

**The "user report" (cl. 3.6 / 3.7) — Usage Data, on request, within 10 business days, in a State-specified format:**
- Active Users / New Users / Returning Users — **by month**, for **SA** and **by region (country / city / continent)**.
- Definitions (cl. 1.7–1.9): New = never visited before; Returning = has visited before; Active = used at least once in the period.
- The report paths quoted (e.g. "Audience > Active Users > 30 Day Active Users", "Audience > Geo > Location") are **Google Analytics** menu paths — the State expects standard aggregate analytics, **not** any individual-level data.

### Privacy assessment — resolved
The obligation is **aggregate counts only** (new/returning/active by month + coarse region). No names, no accounts, no individual profiles. Satisfiable while staying privacy-first via a **minimal first-party, pseudonymous counter**:
- one **random device ID** persisted in the existing device storage (localStorage), no PII, no login;
- a tiny server-side tally (the app already runs **Upstash Redis**) recording new/returning/active per month and a coarse region derived from IP **at request time** (store the region label, not the IP).

This is the one genuinely new server-side piece, but it's the same category as the planned P2 history store: aggregate, non-personal. **Open decision:** which mechanism (own minimal counter vs a privacy-analytics tool vs Google Analytics) — see chat. A short **privacy policy** disclosing these metrics should ship with SA regardless.

---

## Pre-go-live checklist (per new feed)

1. Terms/licence accepted by Fred in the provider's flow; link + date recorded above.
2. Attribution shown wherever the licence requires (map/pins and/or `/data-freshness`).
3. Cadence/staleness presented honestly (feed `as_of` -> pin timestamp).
4. Rate limits respected by the cron + cache path.
5. Feed-specific obligations implemented: SA stale-data complaint link; SA usage-counter; SA attribution string.
