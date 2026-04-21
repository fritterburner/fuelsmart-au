import { Station, StationPrice, FuelCode } from "../types";
import { parseLocalDateToISO } from "./tz";
import { normaliseBrand } from "../brands";

const BASE_URL = "https://api.onegov.nsw.gov.au/FuelCheckApp/v1/fuel";

// NSW FuelCheck uses these fuel type codes directly
const NSW_FUEL_MAP: Record<string, FuelCode> = {
  U91: "U91",
  E10: "E10",
  P95: "P95",
  P98: "P98",
  DL: "DL",
  PD: "PD",
  LPG: "LPG",
  E85: "E85",
};

interface NSWStation {
  brandid: string;
  stationid: string;
  brand: string;
  code: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
}

interface NSWPrice {
  stationcode: string;
  fueltype: string;
  price: number;
  lastupdated: string; // "DD/MM/YYYY HH:MM:SS"
}

interface NSWResponse {
  stations: NSWStation[];
  prices: NSWPrice[];
}

function parseNSWDate(dateStr: string): string {
  // NSW FuelCheck returns wall time in Australia/Sydney (observes DST).
  return parseLocalDateToISO(dateStr, "Australia/Sydney");
}

export async function fetchNSWStations(): Promise<Station[]> {
  const timestamp = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(",", "");

  const resp = await fetch(`${BASE_URL}/prices`, {
    headers: {
      requesttimestamp: timestamp,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`NSW fuel prices request failed: ${resp.status}`);
  }

  const data: NSWResponse = await resp.json();

  // Group prices by station code
  const priceMap = new Map<string, StationPrice[]>();
  for (const p of data.prices) {
    const fuelCode = NSW_FUEL_MAP[p.fueltype];
    if (!fuelCode) continue;

    if (!priceMap.has(p.stationcode)) priceMap.set(p.stationcode, []);
    priceMap.get(p.stationcode)!.push({
      fuel: fuelCode,
      price: p.price,
      updated: parseNSWDate(p.lastupdated),
    });
  }

  // Parse suburb/postcode/state from address (format: "123 Street, SUBURB NSW 2000")
  function parseAddress(address: string): { street: string; suburb: string; state: string; postcode: string } {
    const m = address.match(/^(.+?),\s*(.+?)\s+(NSW|ACT)\s+(\d{4})$/);
    if (m) return { street: m[1], suburb: m[2], state: m[3], postcode: m[4] };
    return { street: address, suburb: "", state: "NSW", postcode: "" };
  }

  return data.stations
    .filter((s) => priceMap.has(s.code)) // Only include stations with prices
    .map((station) => {
      const parsed = parseAddress(station.address);
      return {
        id: `nsw-${station.stationid}`,
        name: station.name,
        brand: normaliseBrand(station.brand),
        brandCode: station.brandid,
        address: parsed.street,
        suburb: parsed.suburb,
        state: parsed.state as "NSW" | "ACT",
        postcode: parsed.postcode,
        lat: station.location.latitude,
        lng: station.location.longitude,
        prices: priceMap.get(station.code) || [],
      };
    });
}
