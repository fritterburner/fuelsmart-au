import { Station, StationPrice } from "../types";
import { SA_FUEL_MAP, SA_BRAND_MAP } from "../fuel-codes";
import { isRealisticPrice } from "../price-sanity";

/**
 * South Australia — Fuel Pricing Information Scheme via the Informed Sources
 * aggregation system. Access is granted as an authorised data publisher.
 *
 * SCAFFOLD: Informed Sources also runs Queensland's scheme and exposes the same
 * FPDAPI shape, so this deliberately mirrors `qld.ts` (our best-grounded guess).
 * Confirm on publisher approval: host, geoRegion params, the FuelId map, and the
 * brand-ID map. Gated by `SA_FPIS_API_TOKEN` so it only runs once configured.
 */

const BASE_URL =
  process.env.SA_FPIS_URL ??
  "https://fppdirectapi-prod.safuelpricinginformation.com.au";

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
    `${BASE_URL}/Subscriber/GetFullSiteDetails?countryId=21&geoRegionLevel=3&geoRegionId=4`,
    { headers: getHeaders() }
  );
  if (!resp.ok) throw new Error(`SA sites request failed: ${resp.status}`);
  const data = await resp.json();
  return data.S;
}

async function fetchSAPrices(): Promise<SAPrice[]> {
  const resp = await fetch(
    `${BASE_URL}/Price/GetSitesPrices?countryId=21&geoRegionLevel=3&geoRegionId=4`,
    { headers: getHeaders() }
  );
  if (!resp.ok) throw new Error(`SA prices request failed: ${resp.status}`);
  const data = await resp.json();
  return data.SitePrices;
}

export async function fetchSAStations(): Promise<Station[]> {
  const [sites, prices] = await Promise.all([fetchSASites(), fetchSAPrices()]);

  const priceMap = new Map<number, StationPrice[]>();
  for (const p of prices) {
    const fuel = SA_FUEL_MAP[p.FuelId];
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

  return sites.map((site) => ({
    id: `sa-${site.S}`,
    name: site.N,
    brand: SA_BRAND_MAP[site.B] || `Brand ${site.B}`,
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
