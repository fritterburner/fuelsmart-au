import { Station, StationPrice, FuelCode } from "../types";

const BASE_URL = "https://api.onegov.nsw.gov.au/FuelCheckTasApp/v1/fuel";

// TAS FuelCheck uses these fuel type codes (PDL = Premium Diesel)
const TAS_FUEL_MAP: Record<string, FuelCode> = {
  U91: "U91",
  E10: "E10",
  P95: "P95",
  P98: "P98",
  DL: "DL",
  PDL: "PD",
  LPG: "LPG",
  E85: "E85",
};

interface TASStation {
  brandid: string;
  stationid: string;
  brand: string;
  code: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
}

interface TASPrice {
  stationcode: string;
  fueltype: string;
  price: number;
  lastupdated: string; // "DD/MM/YYYY HH:MM:SS"
}

function parseTASDate(dateStr: string): string {
  const [datePart, timePart] = dateStr.split(" ");
  if (!datePart || !timePart) return new Date().toISOString();
  const [day, month, year] = datePart.split("/");
  return new Date(`${year}-${month}-${day}T${timePart}+11:00`).toISOString();
}

export async function fetchTASStations(): Promise<Station[]> {
  const timestamp = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Hobart",
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
    throw new Error(`TAS fuel prices request failed: ${resp.status}`);
  }

  const data: { stations: TASStation[]; prices: TASPrice[] } = await resp.json();

  // Group prices by station code
  const priceMap = new Map<string, StationPrice[]>();
  for (const p of data.prices) {
    const fuelCode = TAS_FUEL_MAP[p.fueltype];
    if (!fuelCode) continue;

    if (!priceMap.has(p.stationcode)) priceMap.set(p.stationcode, []);
    priceMap.get(p.stationcode)!.push({
      fuel: fuelCode,
      price: p.price,
      updated: parseTASDate(p.lastupdated),
    });
  }

  // Parse suburb/postcode from address (format: "123 Street, SUBURB TAS 7000")
  function parseAddress(address: string): { street: string; suburb: string; postcode: string } {
    const m = address.match(/^(.+?),\s*(.+?)\s+TAS\s+(\d{4})$/);
    if (m) return { street: m[1], suburb: m[2], postcode: m[3] };
    return { street: address, suburb: "", postcode: "" };
  }

  return data.stations
    .filter((s) => priceMap.has(s.code))
    .map((station) => {
      const parsed = parseAddress(station.address);
      return {
        id: `tas-${station.stationid}`,
        name: station.name,
        brand: station.brand,
        brandCode: station.brandid,
        address: parsed.street,
        suburb: parsed.suburb,
        state: "TAS" as const,
        postcode: parsed.postcode,
        lat: station.location.latitude,
        lng: station.location.longitude,
        prices: priceMap.get(station.code) || [],
      };
    });
}
