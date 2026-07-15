/**
 * Pure "which way are prices heading" classifier for the /trends and
 * /prices/[state] SEO pages. Deliberately independent of lib/forecast.ts's
 * fuller cycle model (event overlay, confidence bands, buy/wait
 * recommendation) — these pages only need a coarse rising/falling/steady read
 * plus a one-line "where in the cycle" hint, so it stays simple and
 * unit-testable on its own.
 */

export type Direction = "rising" | "falling" | "steady";

export interface DirectionPoint {
  date: string;
  value: number | null;
}

export interface DirectionResult {
  direction: Direction;
  label: string;
  phaseHint: string | null;
}

/** Below this slope (c/L per day) recent prices are called "steady". */
const STEADY_SLOPE_CPL_PER_DAY = 0.05;

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

/**
 * Classify recent direction from a daily price series (nulls for missing
 * days are skipped, not treated as zero). Returns null when there isn't
 * enough history yet to say anything meaningful.
 */
export function classifyDirection(history: DirectionPoint[]): DirectionResult | null {
  const series = history.filter((p) => p.value != null).map((p) => p.value as number);
  if (series.length < 4) return null;

  const last7 = series.slice(-7);
  const slope = linregSlope(last7);

  let direction: Direction;
  if (Math.abs(slope) < STEADY_SLOPE_CPL_PER_DAY) direction = "steady";
  else direction = slope > 0 ? "rising" : "falling";

  const label = direction === "rising" ? "Rising" : direction === "falling" ? "Falling" : "Steady";

  let phaseHint: string | null = null;
  const recent = series.slice(-28);
  if (recent.length >= 8) {
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const span = Math.max(1, max - min);
    const position = (series[series.length - 1] - min) / span; // 0 = trough, 1 = peak
    if (position <= 0.25) phaseHint = "Near the bottom of the price cycle — a rise may be close.";
    else if (position >= 0.75) phaseHint = "Near the top of the price cycle — a drop may be close.";
    else phaseHint = "Mid-cycle — no clear turning point yet.";
  }

  return { direction, label, phaseHint };
}
