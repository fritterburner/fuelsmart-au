/**
 * Canonical brand taxonomy.
 *
 * Five state fetchers feed the map and three of them (NSW, TAS, WA) emit
 * free-form brand strings. A user who ticks "Coles Express" in their discount
 * config expects matches regardless of whether the feed spelled it
 * "ColesExpress", "COLES EXPRESS", or "Shell Coles Express". This module is
 * the single source of truth for canonical names + an alias map that every
 * fetcher pipes its raw brand through before writing `Station.brand`.
 *
 * Unknown brands are returned title-cased but unchanged — stations still have
 * a human-readable name, they just aren't available as a filter option. The
 * alias map is expected to grow as users report mismatches.
 */

export const CANONICAL_BRANDS = [
  "7-Eleven",
  "AM/PM",
  "Ampol",
  "Astron",
  "BP",
  "Better Choice",
  "Budget",
  "Caltex",
  "Caltex Woolworths",
  "Coles Express",
  "EG Ampol",
  "Freedom Fuels",
  "Gull",
  "Independent",
  "Liberty",
  "Matilda",
  "Metro Fuel",
  "Mobil",
  "Mogas",
  "On The Run",
  "Petrogas",
  "Puma Energy",
  "Shell",
  "Solo",
  "United",
  "Vibe",
  "X Convenience",
] as const;

export type CanonicalBrand = (typeof CANONICAL_BRANDS)[number];

/**
 * Alias → canonical lookup. Keys are uppercase with non-alphanumeric stripped
 * (see `normalise`). Right-hand side must appear in CANONICAL_BRANDS.
 */
const ALIAS_TO_CANONICAL: Record<string, CanonicalBrand> = {
  // 7-Eleven variants
  "7ELEVEN": "7-Eleven",
  "SEVENELEVEN": "7-Eleven",

  // Ampol family (formerly Caltex; EG is the Woolies partner)
  "AMPOL": "Ampol",
  "EGAMPOL": "EG Ampol",

  // Caltex (the brand still exists alongside Ampol at some sites)
  "CALTEX": "Caltex",
  "CALTEXWOOLWORTHS": "Caltex Woolworths",
  "CALTEXWOOLIES": "Caltex Woolworths",
  "WOOLWORTHSCALTEX": "Caltex Woolworths",

  // Coles Express (Shell co-brands post-2023 — users still think "Coles Express")
  "COLESEXPRESS": "Coles Express",
  "SHELLCOLESEXPRESS": "Coles Express",
  "COLES": "Coles Express",

  // Shell
  "SHELL": "Shell",

  // BP
  "BP": "BP",

  // United
  "UNITED": "United",
  "UNITEDPETROLEUM": "United",

  // Puma Energy
  "PUMA": "Puma Energy",
  "PUMAENERGY": "Puma Energy",

  // Mobil
  "MOBIL": "Mobil",

  // Liberty
  "LIBERTY": "Liberty",

  // Better Choice
  "BETTERCHOICE": "Better Choice",

  // Budget
  "BUDGET": "Budget",

  // Freedom Fuels
  "FREEDOMFUELS": "Freedom Fuels",
  "FREEDOM": "Freedom Fuels",

  // Gull
  "GULL": "Gull",

  // Matilda
  "MATILDA": "Matilda",

  // Metro Fuel
  "METROFUEL": "Metro Fuel",
  "METRO": "Metro Fuel",

  // Mogas
  "MOGAS": "Mogas",

  // On The Run
  "ONTHERUN": "On The Run",
  "OTR": "On The Run",

  // Petrogas
  "PETROGAS": "Petrogas",

  // Solo
  "SOLO": "Solo",

  // Vibe
  "VIBE": "Vibe",
  "VIBEPETROLEUM": "Vibe",

  // X Convenience (WA)
  "XCONVENIENCE": "X Convenience",

  // Astron
  "ASTRON": "Astron",

  // Independent / unbranded catch-all
  "INDEPENDENT": "Independent",
  "UNBRANDED": "Independent",
  "INDEP": "Independent",

  // AM/PM
  "AMPM": "AM/PM",
};

const CANONICAL_SET = new Set<string>(CANONICAL_BRANDS);

/**
 * Strip to uppercase alphanumeric so "Coles  Express", "ColesExpress",
 * "COLES-EXPRESS" all collapse to the same key.
 */
function normalise(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isCanonicalBrand(name: string): boolean {
  return CANONICAL_SET.has(name);
}

/**
 * Map a raw brand string from any fetcher to a canonical brand. Falls back
 * to the trimmed input if no alias matches — keeps the station readable even
 * for unknown chains.
 */
export function normaliseBrand(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Exact canonical match (fast path)
  if (CANONICAL_SET.has(trimmed)) return trimmed;

  const key = normalise(trimmed);
  if (!key) return "";

  // Direct alias
  if (ALIAS_TO_CANONICAL[key]) return ALIAS_TO_CANONICAL[key];

  // Case-insensitive canonical match (e.g. "SHELL" → "Shell")
  for (const canonical of CANONICAL_BRANDS) {
    if (normalise(canonical) === key) return canonical;
  }

  // Unknown brand: return as-is so the station keeps a name.
  return trimmed;
}
