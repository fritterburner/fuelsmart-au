import { Station, StationPrice } from "../types";
import { NT_FUEL_MAP, NT_BRAND_MAP } from "../fuel-codes";
import { isRealisticPrice } from "../price-sanity";

interface NTOutlet {
  FuelOutletId: number;
  OutletName: string;
  OutletBrandIdentifier: string;
  Address: string;
  Suburb: string;
  Postcode: string;
  Longitude: number;
  Latitude: number;
  IsActive: boolean;
  AvailableFuels: {
    FuelCode: string;
    Price: number;
    isAvailable: boolean;
    PriceScheduled?: number;
    isAvailableScheduled?: boolean;
  }[];
}

interface NTServerJson {
  FuelOutlet: NTOutlet[];
  /** True after the daily 2:30 pm cut-over, when tomorrow's prices are published */
  ShowScheduledPrice?: boolean;
}

export async function fetchNTStations(): Promise<Station[]> {
  const url =
    "https://myfuelnt.nt.gov.au/Home/Results?searchOptions=region&SuburbId=0&RegionId=3&FuelCode=&BrandIdentifier=";

  const resp = await fetch(url);
  const html = await resp.text();

  // Extract serverJson from hidden input
  const startMarker = 'id="serverJson" value="';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) throw new Error("NT: serverJson not found in HTML");

  const valueStart = startIdx + startMarker.length;
  const valueEnd = html.indexOf('"', valueStart);
  const encoded = html.substring(valueStart, valueEnd);

  // HTML-decode
  const decoded = encoded
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");

  const data: NTServerJson = JSON.parse(decoded);
  const now = new Date().toISOString();

  return data.FuelOutlet.filter((o) => o.IsActive).map((outlet) => {
    const brandCode = outlet.OutletBrandIdentifier;
    const prices: StationPrice[] = outlet.AvailableFuels
      .filter((f) =>
        f.isAvailable &&
        NT_FUEL_MAP[f.FuelCode] &&
        isRealisticPrice(f.Price, NT_FUEL_MAP[f.FuelCode]),
      )
      .map((f) => ({
        fuel: NT_FUEL_MAP[f.FuelCode],
        price: f.Price, // already in cents/L
        updated: now,
        // NT retailers may change price once a day; from 2:30 pm the feed
        // publishes tomorrow's price alongside today's.
        ...(data.ShowScheduledPrice &&
        typeof f.PriceScheduled === "number" &&
        f.isAvailableScheduled !== false &&
        f.PriceScheduled !== f.Price &&
        isRealisticPrice(f.PriceScheduled, NT_FUEL_MAP[f.FuelCode])
          ? { scheduled: f.PriceScheduled }
          : {}),
      }));

    return {
      id: `nt-${outlet.FuelOutletId}`,
      name: outlet.OutletName,
      brand: NT_BRAND_MAP[brandCode] || brandCode,
      brandCode,
      address: outlet.Address,
      suburb: outlet.Suburb,
      state: "NT" as const,
      postcode: outlet.Postcode,
      lat: outlet.Latitude,
      lng: outlet.Longitude,
      prices,
    };
  });
}
