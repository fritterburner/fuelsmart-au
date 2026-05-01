/**
 * Shared fetch wrapper for the public OSRM demo server.
 *
 * router.project-osrm.org has no SLA — it intermittently returns 502/503/504
 * when its backend is restarting or under load. A single retry after a brief
 * pause clears almost all of these. Don't retry on 429 (rate-limited; another
 * call would just deepen the throttle) or 4xx (client error).
 */

const RETRY_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 600;

export async function osrmFetch(url: string): Promise<Response> {
  const first = await fetch(url);
  if (!RETRY_STATUSES.has(first.status)) return first;
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  return fetch(url);
}
