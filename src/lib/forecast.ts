import { FuelCode, StateCode } from "./types";
import { eventsInWindow } from "./forecast-events";

/**
 * 7-day price outlook. A deliberately simple, transparent v1:
 *  - a cycle/phase model over recent history (AU metro prices sawtooth: a sharp
 *    hike from the trough, then a slow grind down),
 *  - a policy-event overlay (e.g. the excise-cut expiry) — the differentiator a
 *    pure oil-cycle model can't see,
 *  - a volatility-based confidence band that widens with the horizon.
 * Forecasting fuel prices is genuinely uncertain, so the output is ranges +
 * confidence, never false precision. Accuracy improves as history accrues.
 */

export interface HistoryPoint {
  date: string;
  value: number | null;
}

export interface ForecastPoint {
  date: string;
  projected: number;
  lower: number;
  upper: number;
}

export type Recommendation = "buy_now" | "wait" | "neutral";

export interface ForecastResult {
  asOf: string;
  horizonDays: number;
  lastPrice: number | null;
  forecast: ForecastPoint[];
  recommendation: Recommendation;
  rationale: string;
  confidence: "low" | "medium";
  events: { date: string; label: string; impactCpl: number }[];
}

interface BuildOpts {
  fuel: FuelCode;
  state?: StateCode;
  horizonDays?: number;
  today?: Date;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function linregSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function stdev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
}

export function buildForecast(history: HistoryPoint[], opts: BuildOpts): ForecastResult {
  const horizonDays = opts.horizonDays ?? 7;
  const today = opts.today ?? new Date();
  const asOf = dayKey(today);
  const fuel = opts.fuel;

  const series = history.filter((p) => p.value != null).map((p) => p.value as number);
  const lastPrice = series.length ? series[series.length - 1] : null;

  const events = eventsInWindow(dayKey(addDays(today, 1)), dayKey(addDays(today, horizonDays)), fuel).map(
    (e) => ({ date: e.date, label: e.label, impactCpl: e.impactCpl }),
  );

  // --- Not enough data: flat projection + any known step, low confidence. ---
  if (series.length < 8 || lastPrice == null) {
    const forecast: ForecastPoint[] = [];
    let step = 0;
    for (let d = 1; d <= horizonDays; d++) {
      const date = dayKey(addDays(today, d));
      step += events.filter((e) => e.date === date).reduce((a, e) => a + e.impactCpl, 0);
      const projected = round1((lastPrice ?? 0) + step);
      forecast.push({ date, projected, lower: projected, upper: projected });
    }
    return {
      asOf,
      horizonDays,
      lastPrice,
      forecast,
      recommendation: events.length ? "buy_now" : "neutral",
      rationale: events.length
        ? "A known price step is coming this week — fill up before it lands."
        : "Not enough price history yet to forecast — check back as data builds up.",
      confidence: "low",
      events,
    };
  }

  // --- Cycle / phase model. ---
  const recent = series.slice(-28);
  const last7 = series.slice(-7);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const rangeSpan = Math.max(1, max - min);
  const position = (lastPrice - min) / rangeSpan; // 0 = trough, 1 = peak
  const slope = linregSlope(last7);

  const diffs = series.slice(-14).map((v, i, arr) => (i === 0 ? 0 : v - arr[i - 1])).slice(1);
  const vol = stdev(diffs);

  const cycleLen = 30; // typical AU metro cycle (days)
  const hikeRate = rangeSpan / 4; // sharp climb: ~4 days trough->peak
  const declineRate = rangeSpan / Math.max(8, cycleLen - 6); // slow grind down

  let rising: boolean;
  if (position >= 0.6) rising = false;
  else if (position <= 0.25) rising = true;
  else rising = slope >= 0;

  const forecast: ForecastPoint[] = [];
  let cur = lastPrice;
  let dir = rising;
  let eventStep = 0;
  for (let d = 1; d <= horizonDays; d++) {
    const date = dayKey(addDays(today, d));
    cur += dir ? hikeRate : -declineRate;
    if (dir && cur >= max) {
      cur = max;
      dir = false;
    } else if (!dir && cur <= min) {
      cur = min;
      dir = true;
    }
    eventStep += events.filter((e) => e.date === date).reduce((a, e) => a + e.impactCpl, 0);
    const projected = cur + eventStep;
    const band = Math.max(1.5, 1.5 * vol * Math.sqrt(d));
    forecast.push({
      date,
      projected: round1(projected),
      lower: round1(projected - band),
      upper: round1(projected + band),
    });
  }

  const minAhead = Math.min(...forecast.map((f) => f.projected));
  const hasUpStep = events.some((e) => e.impactCpl > 0);

  let recommendation: Recommendation;
  let rationale: string;
  if (hasUpStep) {
    recommendation = "buy_now";
    rationale = "A policy change pushes prices up within the week — fill up before it takes effect.";
  } else if (minAhead <= lastPrice - 2) {
    recommendation = "wait";
    rationale = `Prices look likely to ease by about ${round1(lastPrice - minAhead)} c/L over the next ${horizonDays} days.`;
  } else if (rising && position <= 0.3) {
    recommendation = "buy_now";
    rationale = "Prices are near the bottom of the cycle and a hike looks imminent — fill up now.";
  } else {
    recommendation = "neutral";
    rationale = "No clear move expected over the next week — buy when convenient.";
  }

  const confidence: "low" | "medium" = series.length >= 21 && vol < rangeSpan ? "medium" : "low";

  return {
    asOf,
    horizonDays,
    lastPrice: round1(lastPrice),
    forecast,
    recommendation,
    rationale,
    confidence,
    events,
  };
}
