import { Station, StationPrice, FuelCode } from "../types";
import { SA_FUEL_MAP, SA_BRAND_MAP } from "../fuel-codes";
import { isRealisticPrice } from "../price-sanity";
import { normaliseBrand } from "../brands";

/**
 * South Australia — Fuel Pricing Information Scheme via the Informed Sources
 * FPDAPI (the same vendor/API family as `qld.ts`). Auth header format is
 * confirmed: `Authorization: FPDAPI SubscriberToken=<token>`.
 *
 * UNCONFIRMED until the SA data-publisher key/docs arrive:
 *  - `countryId`: QLD's tenant id (21) is confirmed to be wrong for SA. The
 *    real value is unknown, so this stays configuration-driven — set
 *    `SA_FPIS_COUNTRY_ID` once known, no code change needed.
 *  - `geoRegionId` for "SA, statewide": geoRegionLevel=3 means "state" (this
 *    part is confirmed), but the id itself is unconfirmed. QLD's statewide
 *    convention (geoRegionId=1) is a better-grounded default than the old
 *    guess of 4, but it's still a guess for SA specifically.
 *  - Host `fppdirectapi-prod.safuelpricinginformation.com.au` is a plausible,
 *    unverified guess by analogy with QLD's host.
 *
 * Because a wrong countryId could silently point at another state's tenant
 * and pollute the map, `fetchSAStations` runs a defensive SA bounding-box
 * filter on returned sites (see `isWithinSABounds`) and throws if the
 * majority of sites fall outside it, so the misconfiguration surfaces in the
 * refresh cron's errors[] instead of quietly showing wrong-state pins.
 *
 * Fuel-type ids are self-correcting: `fetchSAFuelTypes` calls
 * GetCountryFuelTypes (resilient, like the brands join) and name-matches the
 * results to FuelCodes at runtime, falling back to the static SA_FUEL_MAP
 * (currently an alias of QLD_FUEL_MAP) only where the live lookup can't
 * resolve an id.
 *
 * Gated by `SA_FPIS_API_TOKEN` so it only runs once configured.
 */

const BASE_URL =
  process.env.SA_FPIS_URL ?? "https://fppdirectapi-prod.safuelpricinginformation.com.au";

// Likely wrong — QLD's tenant id, kept only as a placeholder default. Override
// with the real SA countryId via env once known (see docs/go-live-sa-vic.md
// for how to discover it from GetCountryGeographicRegions).
const COUNTRY_ID = process.env.SA_FPIS_COUNTRY_ID ?? "21";
const GEOREGION_LEVEL = process.env.SA_FPIS_GEOREGION_LEVEL ?? "3";
// QLD's statewide convention (1) is a better default guess than the old "4",
// but still unconfirmed for SA specifically.
const GEOREGION_ID = process.env.SA_FPIS_GEOREGION_ID ?? "1";

// Generous SA bounding box (roughly covers the whole state with margin) used
// only to catch a misconfigured countryId/geoRegionId pointing at another
// state's tenant, not to validate real SA geography precisely.
const SA_BOUNDS = { minLat: -38.5, maxLat: -25.5, minLng: 129, maxLng: 141.5 };

function isWithinSABounds(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= SA_BOUNDS.minLat &&
    lat <= SA_BOUNDS.maxLat &&
    lng >= SA_BOUNDS.minLng &&
    lng <= SA_BOUNDS.maxLng
  );
}

interface SASite {
  S: number; // SiteId
  N: string; // Name
  A: string; // Address
  B: number; // BrandId
  P: string; // Postcode
  Lat: number;
  Lng: number;
}

interface SAPrice {
  SiteId: number;
  FuelId: number;
  Price: number; // tenths of a cent
  TransactionDateUtc: string;
}

function getHeaders(): HeadersInit {
  const token = process.env.SA_FPIS_API_TOKEN;
  if (!token) throw new Error("SA_FPIS_API_TOKEN not set");
  return {
    Authorization: `FPDAPI SubscriberToken=${token}`,
    "Content-Type": "application/json",
  };
}

async function fetchSASites(): Promise<SASite[]> {
  const resp = await fetch(
    `${BASE_URL}/Subscriber/GetFullSiteDetails?countryId=${COUNTRY_ID}&geoRegionLevel=${GEOREGION_LEVEL}&geoRegionId=${GEOREGION_ID}`,
    { headers: getHeaders() }
  );
  if (!resp.ok) throw new Error(`SA sites request failed: ${resp.status}`);
  const data = await resp.json();
  return data.S;
}

async function fetchSAPrices(): Promise<SAPrice[]> {
  const resp = await fetch(
    `${BASE_URL}/Price/GetSitesPrices?countryId=${COUNTRY_ID}&geoRegionLevel=${GEOREGION_LEVEL}&geoRegionId=${GEOREGION_ID}`,
    { headers: getHeaders() }
  );
  if (!resp.ok) throw new Error(`SA prices request failed: ${resp.status}`);
  const data = await resp.json();
  return data.SitePrices;
}

interface SABrand {
  BrandId: number;
  Name: string;
}

/** SA brand reference (id -> name); mirrors qld.ts. Resilient to failure. */
async function fetchSABrands(): Promise<Map<number, string>> {
  try {
    const resp = await fetch(`${BASE_URL}/Subscriber/GetCountryBrands?countryId=${COUNTRY_ID}`, {
      headers: getHeaders(),
    });
    if (!resp.ok) return new Map();
    const data = await resp.json();
    const map = new Map<number, string>();
    for (const b of (data.Brands ?? []) as SABrand[]) {
      if (typeof b.BrandId === "number" && b.Name) map.set(b.BrandId, b.Name);
    }
    return map;
  } catch {
    return new Map();
  }
}

interface SAFuelTypeEntry {
  FuelId?: number;
  Id?: number;
  Name?: string;
}

/**
 * Tolerant name -> FuelCode matcher. Checks the FuelCode enum first (see
 * types.ts) rather than inventing new codes; anything that doesn't match a
 * known pattern is left unmapped so the price row is skipped, not guessed.
 */
export function matchFuelCodeByName(name: string): FuelCode | undefined {
  const n = name.toLowerCase();
  if (n.includes("e10")) return "E10";
  if (n.includes("e85")) return "E85";
  if (n.includes("91")) return "U91";
  if (n.includes("95")) return "P95";
  if (n.includes("98")) return "P98";
  if (n.includes("diesel") && n.includes("premium")) return "PD";
  if (n.includes("diesel")) return "DL";
  if (n.includes("lpg") || n.includes("autogas")) return "LPG";
  if (n.includes("opal") || n.includes("low aromatic")) return "LAF";
  return undefined;
}

/**
 * Live FuelId -> FuelCode reference (GetCountryFuelTypes), resilient like
 * fetchSABrands. Falls back to the static SA_FUEL_MAP per-id in the caller
 * when this doesn't resolve an id (empty map on any failure).
 */
async function fetchSAFuelTypes(): Promise<Map<number, FuelCode>> {
  try {
    const resp = await fetch(
      `${BASE_URL}/Subscriber/GetCountryFuelTypes?countryId=${COUNTRY_ID}`,
      { headers: getHeaders() }
    );
    if (!resp.ok) return new Map();
    const data = await resp.json();
    const list = (data.FuelTypes ?? data.Fuels ?? data.FuelType ?? []) as SAFuelTypeEntry[];
    const map = new Map<number, FuelCode>();
    for (const item of list) {
      const id = item.FuelId ?? item.Id;
      if (typeof id !== "number" || !item.Name) continue;
      const code = matchFuelCodeByName(item.Name);
      if (code) map.set(id, code);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchSAStations(): Promise<Station[]> {
  const [sites, prices, apiBrands, apiFuelTypes] = await Promise.all([
    fetchSASites(),
    fetchSAPrices(),
    fetchSABrands(),
    fetchSAFuelTypes(),
  ]);

  // Defensive geography check: a wrong countryId/geoRegionId could point at
  // another state's tenant entirely. Individual out-of-box sites are dropped
  // silently (no log/throw), but if the majority fall outside SA, that's a
  // configuration problem, not a handful of border sites — surface it.
  const withinBounds = sites.filter((s) => isWithinSABounds(s.Lat, s.Lng));
  if (sites.length > 0 && withinBounds.length / sites.length < 0.5) {
    throw new Error(
      `SA sites: ${sites.length - withinBounds.length}/${sites.length} fell outside the expected SA ` +
        "bounding box — likely SA_FPIS_COUNTRY_ID/SA_FPIS_GEOREGION_ID is misconfigured " +
        "(pointing at another state's tenant). See docs/go-live-sa-vic.md for how to find the right ids."
    );
  }

  const priceMap = new Map<number, StationPrice[]>();
  for (const p of prices) {
    const fuel = apiFuelTypes.get(p.FuelId) ?? SA_FUEL_MAP[p.FuelId];
    if (!fuel) continue;
    const cpl = p.Price / 10; // tenths of a cent -> cents/L
    if (!isRealisticPrice(cpl, fuel)) continue;

    if (!priceMap.has(p.SiteId)) priceMap.set(p.SiteId, []);
    priceMap.get(p.SiteId)!.push({
      fuel,
      price: cpl,
      updated: p.TransactionDateUtc,
    });
  }

  return withinBounds.map((site) => ({
    id: `sa-${site.S}`,
    name: site.N,
    brand: normaliseBrand(apiBrands.get(site.B) ?? SA_BRAND_MAP[site.B] ?? "Independent"),
    brandCode: String(site.B),
    address: site.A,
    suburb: "",
    state: "SA" as const,
    postcode: site.P,
    lat: site.Lat,
    lng: site.Lng,
    prices: priceMap.get(site.S) || [],
  }));
}
