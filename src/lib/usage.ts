import { Redis } from "@upstash/redis";

/**
 * Pseudonymous usage tally for the SA Fuel Pricing Information Scheme
 * (Data Publisher T&Cs cl. 3.6 / 3.7): on request we must be able to report
 * aggregate New / Returning / Active users by month and by coarse region.
 *
 * Privacy-first by construction:
 *  - we store only an opaque random visitor ID (generated client-side),
 *  - a coarse region label (ISO country code) derived from the request IP at
 *    write time — the IP itself is never stored,
 *  - month-bucketed sets so all reads are simple SCARDs.
 * No accounts, no names, nothing that identifies a person.
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SEEN_KEY = "usage:seen"; // set of every visitor ID ever seen (new vs returning)

export interface UsageRegion {
  /** ISO country code, e.g. "AU". "unknown" when geo headers are absent. */
  country: string;
  /** Coarse city label; may be "". Stored only in aggregate counts. */
  city: string;
}

export function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Record one visit. Determines new-vs-returning from whether the visitor ID has
 * ever been seen, then adds it to the month's active/new/returning/region sets.
 * SADD dedupes, so repeated pings in a month don't inflate counts.
 */
export async function recordVisit(vid: string, region: UsageRegion): Promise<void> {
  const month = monthKey();
  const country = region.country || "unknown";

  // sadd returns the number of newly-added members: 1 => first time ever => new.
  const added = await redis.sadd(SEEN_KEY, vid);
  const bucket = added === 1 ? "new" : "returning";

  await Promise.all([
    redis.sadd(`usage:active:${month}`, vid),
    redis.sadd(`usage:${bucket}:${month}`, vid),
    redis.sadd(`usage:active:${month}:${country}`, vid),
    redis.sadd(`usage:countries:${month}`, country),
  ]);
}

export interface MonthlyUsage {
  month: string;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  /** Active users keyed by ISO country code. */
  byCountry: Record<string, number>;
}

/**
 * Build the report the SA scheme can request (cl. 3.7). Returns the most recent
 * `months` calendar months, newest first.
 */
export async function getUsageReport(months: number = 12): Promise<MonthlyUsage[]> {
  const now = new Date();
  const out: MonthlyUsage[] = [];

  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const month = monthKey(d);

    const [active, fresh, returning] = await Promise.all([
      redis.scard(`usage:active:${month}`),
      redis.scard(`usage:new:${month}`),
      redis.scard(`usage:returning:${month}`),
    ]);

    const countries = ((await redis.smembers(`usage:countries:${month}`)) as string[]) ?? [];
    const byCountry: Record<string, number> = {};
    for (const c of countries) {
      byCountry[c] = await redis.scard(`usage:active:${month}:${c}`);
    }

    out.push({
      month,
      activeUsers: active ?? 0,
      newUsers: fresh ?? 0,
      returningUsers: returning ?? 0,
      byCountry,
    });
  }

  return out;
}
