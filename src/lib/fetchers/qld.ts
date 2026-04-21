import { Station, StationPrice } from "../types";
import { QLD_FUEL_MAP, QLD_BRAND_MAP } from "../fuel-codes";
import { isRealisticPrice } from "../price-sanity";

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

export async function fetchQLDStations(): Promise<Station[]> {
  const [sites, prices] = await Promise.all([fetchQLDSites(), fetchQLDPrices()]);

  // Group prices by SiteId
  const priceMap = new Map<number, StationPrice[]>();
  for (const p of prices) {
    const fuelCode = QLD_FUEL_MAP[p.FuelId];
    if (!fuelCode) continue;

    const cpl = p.Price / 10; // tenths of cent -> cents/L
    if (!isRealisticPrice(cpl)) continue; // skip 999.9 sentinels and similar

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
    brand: QLD_BRAND_MAP[site.B] || `Brand ${site.B}`,
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
