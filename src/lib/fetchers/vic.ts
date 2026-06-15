import { Station, StationPrice } from "../types";
import { VIC_FUEL_MAP } from "../fuel-codes";
import { normaliseBrand } from "../brands";
import { isRealisticPrice } from "../price-sanity";

/**
 * Victoria — Servo Saver Open API (Service Victoria). The public tier is a
 * 24-hour-delayed JSON feed; access needs an approved API Consumer ID.
 *
 * SCAFFOLD: the exact endpoint and JSON field names are confirmed once the key
 * is issued. The transport + plumbing here are final; only `normaliseVicStation`
 * (the parse layer) should need adjusting against a real response. Gated by
 * `VIC_SERVO_SAVER_API_KEY` so it only runs once configured.
 */

const BASE_URL =
  process.env.VIC_SERVO_SAVER_URL ??
  "https://api.servosaver.vic.gov.au/public/v1/prices";

interface VicRawPrice {
  fuelType: string;
  price: number; // cents/L
  lastUpdated: string;
}

interface VicRawStation {
  stationId: string | number;
  name: string;
  brand: string;
  address: string;
  suburb?: string;
  postcode?: string;
  latitude: number;
  longitude: number;
  prices: VicRawPrice[];
}

interface VicResponse {
  stations: VicRawStation[];
}

export async function fetchVICStations(): Promise<Station[]> {
  const key = process.env.VIC_SERVO_SAVER_API_KEY;
  if (!key) throw new Error("VIC_SERVO_SAVER_API_KEY not set");

  const resp = await fetch(BASE_URL, {
    headers: {
      // Confirm the exact header name on approval (Consumer ID).
      "X-Consumer-ID": key,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) throw new Error(`VIC Servo Saver request failed: ${resp.status}`);

  const data: VicResponse = await resp.json();
  return (data.stations ?? []).map(normaliseVicStation);
}

function normaliseVicStation(s: VicRawStation): Station {
  const prices: StationPrice[] = (s.prices ?? [])
    .map((p): StationPrice | null => {
      const fuel = VIC_FUEL_MAP[p.fuelType];
      if (!fuel) return null;
      if (!isRealisticPrice(p.price, fuel)) return null;
      return { fuel, price: p.price, updated: new Date(p.lastUpdated).toISOString() };
    })
    .filter((p): p is StationPrice => p !== null);

  return {
    id: `vic-${s.stationId}`,
    name: s.name,
    brand: normaliseBrand(s.brand),
    brandCode: s.brand,
    address: s.address,
    suburb: s.suburb ?? "",
    state: "VIC",
    postcode: s.postcode ?? "",
    lat: s.latitude,
    lng: s.longitude,
    prices,
  };
}
