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
  }[];
}

interface NTServerJson {
  FuelOutlet: NTOutlet[];
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
        isRealisticPrice(f.Price) &&
        NT_FUEL_MAP[f.FuelCode],
      )
      .map((f) => ({
        fuel: NT_FUEL_MAP[f.FuelCode],
        price: f.Price, // already in cents/L
        updated: now,
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
