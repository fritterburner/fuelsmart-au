import { randomUUID } from "crypto";
import { Station, StationPrice } from "../types";
import { VIC_FUEL_MAP } from "../fuel-codes";
import { normaliseBrand } from "../brands";
import { isRealisticPrice } from "../price-sanity";

/**
 * Victoria — Fair Fuel Open Data API ("Servo Saver"), Service Victoria.
 * Spec: public PDF, v1.0, Oct 2025. The public tier is a 24-hour-delayed feed;
 * per-price `updatedAt` timestamps convey that honestly on their own (see
 * `/data-freshness`) — nothing in this fetcher should claim VIC is live-fresh.
 *
 * Gated by `VIC_SERVO_SAVER_API_KEY` so it only runs once approved. Rate limit
 * is 10 requests/60s; this fetcher makes at most 2 calls per refresh
 * (prices + brands reference), well under that.
 */

const BASE_URL =
  process.env.VIC_SERVO_SAVER_URL ?? "https://api.fuel.service.vic.gov.au/open-data/v1";

const USER_AGENT = "FuelSmart-AU/1.0";

interface VicFuelPrice {
  fuelType: string;
  price: number; // cents/L, 1dp
  isAvailable?: boolean;
  updatedAt: string;
}

interface VicFuelStation {
  id: string | number;
  name: string;
  brandId?: string | number;
  address: string;
  contactPhone?: string;
  location: { latitude: number; longitude: number };
}

interface VicFuelPriceDetail {
  fuelStation: VicFuelStation;
  fuelPrices: VicFuelPrice[];
  updatedAt?: string;
}

interface VicPricesResponse {
  fuelPriceDetails: VicFuelPriceDetail[];
}

function vicHeaders(): HeadersInit {
  const key = process.env.VIC_SERVO_SAVER_API_KEY;
  if (!key) throw new Error("VIC_SERVO_SAVER_API_KEY not set");
  return {
    // Header names are lowercase per spec; a new x-transactionid is required
    // on every request (client-generated UUIDv4), so this must be called
    // fresh for each fetch rather than cached across calls.
    "x-consumer-id": key,
    "x-transactionid": randomUUID(),
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
  };
}

async function vicRequest<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, { headers: vicHeaders() });
  if (!resp.ok) {
    if (resp.status === 403) {
      throw new Error("VIC Fair Fuel Open Data API: invalid or unauthorised API key (403)");
    }
    if (resp.status === 429) {
      throw new Error("VIC Fair Fuel Open Data API: rate limited (429) — 10 req/60s");
    }
    throw new Error(`VIC Fair Fuel Open Data API request failed: ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

/**
 * Brand reference join (id -> name). Schema isn't verbatim-confirmed, so this
 * parses defensively: accepts either `{ brands: [{ id, name }] }` or a bare
 * array of `{ id | brandId, name }`. Any failure here must not fail the whole
 * fetch — stations just render with brand "Independent" until it's confirmed.
 */
async function fetchVICBrands(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const data = await vicRequest<unknown>("/fuel/reference-data/brands");
    const list: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { brands?: unknown[] })?.brands)
        ? (data as { brands: unknown[] }).brands
        : [];
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const id = entry.id ?? entry.brandId;
      const name = entry.name;
      if ((typeof id === "string" || typeof id === "number") && typeof name === "string") {
        map.set(String(id), name);
      }
    }
  } catch {
    // Reference-data join is best-effort; fall back to "Independent" per station.
  }
  return map;
}

export async function fetchVICStations(): Promise<Station[]> {
  const [priceData, brands] = await Promise.all([
    vicRequest<VicPricesResponse>("/fuel/prices"),
    fetchVICBrands(),
  ]);

  return (priceData.fuelPriceDetails ?? []).map((detail) =>
    normaliseVicStation(detail, brands)
  );
}

function normaliseVicStation(
  detail: VicFuelPriceDetail,
  brands: Map<string, string>
): Station {
  const station = detail.fuelStation;

  const prices: StationPrice[] = (detail.fuelPrices ?? [])
    .map((p): StationPrice | null => {
      if (p.isAvailable === false) return null;
      const fuel = VIC_FUEL_MAP[p.fuelType];
      if (!fuel) return null;
      if (!isRealisticPrice(p.price, fuel)) return null;
      const updatedSource = p.updatedAt ?? detail.updatedAt;
      const updated = updatedSource ? new Date(updatedSource).toISOString() : new Date().toISOString();
      return { fuel, price: p.price, updated };
    })
    .filter((p): p is StationPrice => p !== null);

  const brandName = station.brandId != null ? brands.get(String(station.brandId)) : undefined;

  return {
    id: `vic-${station.id}`,
    name: station.name,
    brand: normaliseBrand(brandName ?? "Independent"),
    brandCode: station.brandId != null ? String(station.brandId) : "",
    address: station.address,
    // Fair Fuel Open Data API returns one free-text address string — no
    // separate suburb/postcode fields exist in the spec.
    suburb: "",
    state: "VIC",
    postcode: "",
    lat: station.location.latitude,
    lng: station.location.longitude,
    prices,
  };
}
