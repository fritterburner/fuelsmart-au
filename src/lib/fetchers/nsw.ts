import { Station, StationPrice, FuelCode } from "../types";

const TOKEN_URL =
  "https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken?grant_type=client_credentials";
const BASE_URL = "https://api.onegov.nsw.gov.au/FuelPriceCheck/v1";

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
  state: string;
}

interface NSWPrice {
  stationcode: string;
  fueltype: string;
  price: number;
  lastupdated: string;
}

interface NSWResponse {
  stations: NSWStation[];
  prices: NSWPrice[];
}

async function getAccessToken(
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!resp.ok) {
    throw new Error(`NSW OAuth token request failed: ${resp.status}`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function fetchNSWData(
  token: string,
  apiKey: string
): Promise<NSWResponse> {
  const resp = await fetch(`${BASE_URL}/fuel/prices`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`NSW fuel prices request failed: ${resp.status}`);
  }

  return resp.json();
}

export async function fetchNSWStations(): Promise<Station[]> {
  const apiKey = process.env.NSW_FUEL_API_KEY;
  const apiSecret = process.env.NSW_FUEL_API_SECRET;

  if (!apiKey || !apiSecret) {
    return [];
  }

  const token = await getAccessToken(apiKey, apiSecret);
  const data = await fetchNSWData(token, apiKey);

  // Group prices by station code
  const priceMap = new Map<string, StationPrice[]>();
  for (const p of data.prices) {
    const fuelCode = NSW_FUEL_MAP[p.fueltype];
    if (!fuelCode) continue;

    if (!priceMap.has(p.stationcode)) priceMap.set(p.stationcode, []);
    priceMap.get(p.stationcode)!.push({
      fuel: fuelCode,
      price: p.price, // already in cents/L
      updated: new Date(p.lastupdated).toISOString(),
    });
  }

  return data.stations.map((station) => ({
    id: `nsw-${station.stationid}`,
    name: station.name,
    brand: station.brand,
    brandCode: station.brandid,
    address: station.address,
    suburb: "", // Not provided separately in NSW API
    state: "NSW" as const,
    postcode: "", // Not provided separately in NSW API
    lat: station.location.latitude,
    lng: station.location.longitude,
    prices: priceMap.get(station.code) || [],
  }));
}
