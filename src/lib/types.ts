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
  state: "NT" | "QLD" | "WA" | "NSW" | "ACT" | "SA" | "VIC" | "TAS";
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
  fallbackFuel?: FuelCode; // set when using LAF/OPAL instead of requested fuel
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

export type TripStrategy = "optimised" | "cheapest_fill" | "no_planning";

export interface StrategyResult {
  strategy: TripStrategy;
  label: string;
  description: string;
  totalFuelCost: number; // dollars
  totalLitres: number;
  avgPricePerLitre: number; // cents
  stops: TripStop[];
  warnings: string[];
  fuelAtDestination: number; // litres remaining on arrival
  destinationFillLitres: number; // litres needed to fill to full
  destinationFillCost: number; // dollars at destination's cheapest price
  trueTripCost: number; // totalFuelCost + destinationFillCost
}

export interface DestinationFuelInfo {
  stationName: string;
  brand: string;
  price: number; // cents per litre
  fuel: FuelCode;
  distance: number; // km from destination
}

export interface TripComparison {
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  totalDistance: number; // km
  routeGeometry: [number, number][];
  strategies: StrategyResult[];
  destinationFuel?: DestinationFuelInfo;
}

export interface VehicleProfile {
  id: string;
  name: string;
  fuel: FuelCode;
  tankSize: number;
  consumption: number;
  jerryCapacity: number;
}
