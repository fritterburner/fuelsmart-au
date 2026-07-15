import { StateCode } from "./types";

/**
 * Canonical state list + display names for the SEO pages (/trends,
 * /prices/[state]). Kept separate from lib/regions.ts, which is about
 * sub-state geography, not top-level state metadata.
 */
export const ALL_STATES: StateCode[] = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT", "ACT"];

export const STATE_NAMES: Record<StateCode, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory",
};

/** URL slug for a state code, e.g. "NSW" -> "nsw". */
export function stateSlug(state: StateCode): string {
  return state.toLowerCase();
}

/** Parse a URL slug back to a StateCode, or null if it isn't one of ours. */
export function slugToState(slug: string): StateCode | null {
  const up = slug.toUpperCase();
  return (ALL_STATES as string[]).includes(up) ? (up as StateCode) : null;
}
