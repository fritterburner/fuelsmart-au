import { XMLParser } from "fast-xml-parser";
import { Station, StationPrice, FuelCode } from "../types";
import { WA_FUEL_MAP } from "../fuel-codes";
import { normaliseBrand } from "../brands";

const BASE_URL = "https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS";

interface FuelWatchItem {
  "trading-name": string;
  brand: string;
  address: string;
  location: string; // suburb
  latitude: number;
  longitude: number;
  price: number;
  date: string;
  phone?: string;
  "site-features"?: string;
}

async function fetchWAFuelType(productCode: number): Promise<FuelWatchItem[]> {
  const resp = await fetch(`${BASE_URL}?Product=${productCode}&Day=today`);
  const xml = await resp.text();
  const parser = new XMLParser();
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;
  if (!channel?.item) return [];

  // Single item comes as object, multiple as array
  const items = Array.isArray(channel.item) ? channel.item : [channel.item];
  return items;
}

export async function fetchWAStations(): Promise<Station[]> {
  const productCodes = Object.keys(WA_FUEL_MAP).map(Number);

  // Fetch all fuel types in parallel
  const results = await Promise.all(
    productCodes.map(async (code) => ({
      code,
      items: await fetchWAFuelType(code),
    }))
  );

  // Build station map keyed by name+address (WA has no station ID)
  const stationMap = new Map<string, Station>();

  for (const { code, items } of results) {
    const fuelCode = WA_FUEL_MAP[code];
    if (!fuelCode) continue;

    for (const item of items) {
      const key = `${item["trading-name"]}|${item.address}`;

      if (!stationMap.has(key)) {
        stationMap.set(key, {
          id: `wa-${key.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().substring(0, 60)}`,
          name: item["trading-name"],
          brand: normaliseBrand(item.brand),
          brandCode: item.brand.substring(0, 3).toUpperCase(),
          address: item.address,
          suburb: item.location,
          state: "WA" as const,
          postcode: "", // Not in FuelWatch RSS
          lat: item.latitude,
          lng: item.longitude,
          prices: [],
        });
      }

      stationMap.get(key)!.prices.push({
        fuel: fuelCode,
        price: item.price, // already cents/L
        updated: new Date(item.date).toISOString(),
      });
    }
  }

  return Array.from(stationMap.values());
}
