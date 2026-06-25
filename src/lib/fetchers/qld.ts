import { Station, StationPrice } from "../types";
import { QLD_FUEL_MAP, QLD_BRAND_MAP } from "../fuel-codes";
import { isRealisticPrice } from "../price-sanity";
import { normaliseBrand } from "../brands";

const BASE_URL = "https://fppdirectapi-prod.fuelpricesqld.com.au";

interface QLDSite {
  S: number; // SiteId
  N: string; // Name
  A: string; // Address
  B: number; // BrandId
  P: string; // Postcode
  Lat: number;
  Lng: number;
  GPI: string; // Google Place ID
}

interface QLDPrice {
  SiteId: number;
  FuelId: number;
  Price: number; // tenths of a cent
  TransactionDateUtc: string;
}

function getHeaders(): HeadersInit {
  const token = process.env.QLD_FPD_API_TOKEN;
  if (!token) throw new Error("QLD_FPD_API_TOKEN not set");
  return {
    Authorization: `FPDAPI SubscriberToken=${token}`,
    "Content-Type": "application/json",
  };
}

async function fetchQLDSites(): Promise<QLDSite[]> {
  const resp = await fetch(
    `${BASE_URL}/Subscriber/GetFullSiteDetails?countryId=21&geoRegionLevel=3&geoRegionId=1`,
    { headers: getHeaders() }
  );
  const data = await resp.json();
  return data.S;
}

async function fetchQLDPrices(): Promise<QLDPrice[]> {
  const resp = await fetch(
    `${BASE_URL}/Price/GetSitesPrices?countryId=21&geoRegionLevel=3&geoRegionId=1`,
    { headers: getHeaders() }
  );
  const data = await resp.json();
  return data.SitePrices;
}

interface QLDBrand {
  BrandId: number;
  Name: string;
}

/**
 * QLD's live brand reference (id -> name). The static QLD_BRAND_MAP only covers
 * a handful of major chains, so independents/regionals previously rendered as
 * "Brand <id>". Joining the reference resolves them all. Resilient: any failure
 * falls back to the static map.
 */
async function fetchQLDBrands(): Promise<Map<number, string>> {
  try {
    const resp = await fetch(`${BASE_URL}/Subscriber/GetCountryBrands?countryId=21`, {
      headers: getHeaders(),
    });
    if (!resp.ok) return new Map();
    const data = await resp.json();
    const map = new Map<number, string>();
    for (const b of (data.Brands ?? []) as QLDBrand[]) {
      if (typeof b.BrandId === "number" && b.Name) map.set(b.BrandId, b.Name);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchQLDStations(): Promise<Station[]> {
  const [sites, prices, apiBrands] = await Promise.all([
    fetchQLDSites(),
    fetchQLDPrices(),
    fetchQLDBrands(),
  ]);

  // Group prices by SiteId
  const priceMap = new Map<number, StationPrice[]>();
  for (const p of prices) {
    const fuelCode = QLD_FUEL_MAP[p.FuelId];
    if (!fuelCode) continue;

    const cpl = p.Price / 10; // tenths of cent -> cents/L
    if (!isRealisticPrice(cpl, fuelCode)) continue; // skip 999.9 sentinels and 10× decimal slips

    if (!priceMap.has(p.SiteId)) priceMap.set(p.SiteId, []);
    priceMap.get(p.SiteId)!.push({
      fuel: fuelCode,
      price: cpl,
      updated: p.TransactionDateUtc,
    });
  }

  return sites.map((site) => ({
    id: `qld-${site.S}`,
    name: site.N,
    brand: normaliseBrand(apiBrands.get(site.B) ?? QLD_BRAND_MAP[site.B] ?? "Independent"),
    brandCode: String(site.B),
    address: site.A,
    suburb: "", // QLD API doesn't include suburb in site details
    state: "QLD" as const,
    postcode: site.P,
    lat: site.Lat,
    lng: site.Lng,
    prices: priceMap.get(site.S) || [],
  }));
}
