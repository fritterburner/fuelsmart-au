/**
 * Rank-based pin palette for the default (non-excise) map view.
 *
 * Highlights the N cheapest visible stations in green, reserves red/orange
 * for the most expensive tail, leaves the middle neutral gray. This keeps
 * the map readable even when prices cluster (metro viewports) — the pure
 * percentile-across-visible-range approach tended to paint nearly everything
 * green and colour one outlier red for no meaningful reason.
 *
 * Rules (for a given visible station count `total`):
 *   - top N (cheapest)          → GREEN
 *   - if total < 10             → rest are GRAY
 *   - else:
 *       - bottom 10% of total   → RED
 *       - next 20% above red    → ORANGE
 *       - everything else       → GRAY
 *
 * If N >= total, all stations are GREEN.
 */

export const RANK_COLORS = {
  green: "#22c55e",  // cheapest N
  orange: "#f59e0b", // expensive-ish tail
  red: "#ef4444",    // most expensive
  gray: "#6b7280",   // middle / not flagged
} as const;

export type RankColor = (typeof RANK_COLORS)[keyof typeof RANK_COLORS];

/**
 * Given a list of prices and a highlight count, return a map from price-list
 * index → colour. We return by index because the caller has richer objects
 * (stations) that we don't want this module to know about.
 *
 * Ties: stations with equal prices get the same tier if they're on a tier
 * boundary. We implement this by computing thresholds first, then assigning
 * each station to a tier based on price comparisons (not rank index) so that,
 * e.g., three stations tied at the cheapest price all go green even if N=1.
 */
export function assignRankColors(
  prices: number[],
  highlightCount: number,
): RankColor[] {
  const total = prices.length;
  if (total === 0) return [];

  const n = Math.max(1, Math.min(highlightCount, total));
  const sorted = [...prices].sort((a, b) => a - b);

  // Green threshold: the Nth cheapest price (0-indexed at n-1). Any station
  // priced <= this goes green — ties at the boundary all win.
  const greenMax = sorted[n - 1];

  // If fewer than 10 stations, there's no meaningful "10% / 20% tail" — just
  // green vs gray.
  if (total < 10) {
    return prices.map((p) => (p <= greenMax ? RANK_COLORS.green : RANK_COLORS.gray));
  }

  // Bottom 10%: the most-expensive floor(10%) stations. If floor is 0 (shouldn't
  // happen at total >= 10 but defensive), use at least 1.
  const redCount = Math.max(1, Math.floor(total * 0.1));
  const orangeCount = Math.max(1, Math.floor(total * 0.2));

  // Red starts at the (total - redCount)th index in sorted order.
  const redMin = sorted[total - redCount];
  // Orange starts at (total - redCount - orangeCount)th.
  const orangeStartIdx = Math.max(0, total - redCount - orangeCount);
  const orangeMin = sorted[orangeStartIdx];

  return prices.map((p) => {
    if (p <= greenMax) return RANK_COLORS.green;
    if (p >= redMin) return RANK_COLORS.red;
    if (p >= orangeMin) return RANK_COLORS.orange;
    return RANK_COLORS.gray;
  });
}
