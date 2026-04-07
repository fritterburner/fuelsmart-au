export interface StationPrice {
  fuel: FuelCode;
  price: number; // cents per litre
  updated: string; // ISO 8601
}

export interface Station {
  id: string; // e.g. "nt-42", "qld-61401106", "wa-bp-newstead"
  name: string;
  brand: string;
  brandCode: string;
  address: string;
  suburb: string;
  state: "NT" | "QLD" | "WA" | "NSW";
  postcode: string;
  lat: number;
  lng: number;
  prices: StationPrice[];
}

export type FuelCode =
  | "U91"
  | "DL"
  | "E10"
  | "P95"
  | "P98"
  | "PD"
  | "LPG"
  | "E85"
  | "LAF";

export interface FuelType {
  code: FuelCode;
  name: string;
}

export interface TripStop {
  station: Station;
  distanceFromStart: number; // km
  fuelOnArrival: number; // litres
  litresAdded: number;
  fuelOnDeparture: number;
  cost: number; // dollars
  pricePerLitre: number; // cents
}

export interface TripPlan {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  totalDistance: number; // km
  totalFuelCost: number; // dollars
  naiveFuelCost: number; // dollars (for comparison)
  savings: number; // dollars
  stops: TripStop[];
  routeGeometry: [number, number][]; // lat/lng pairs
  warnings: string[];
}
