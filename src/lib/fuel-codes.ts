import { FuelCode, FuelType } from "./types";

// When a fuel type has no results in an area, these fallbacks can be shown instead.
// Key = requested fuel, Value = array of fallback fuels in priority order.
export const FUEL_FALLBACKS: Partial<Record<FuelCode, FuelCode[]>> = {
  U91: ["LAF"],   // Low Aromatic / OPAL can substitute for U91 in remote areas
  E10: ["U91", "LAF"], // E10 can fall back to U91, then LAF
};

export const FUEL_TYPES: FuelType[] = [
  { code: "U91", name: "Unleaded 91", short: "91", primary: true },
  { code: "DL",  name: "Diesel",      short: "Diesel", primary: true },
  { code: "P95", name: "Premium 95",  short: "95", primary: true },
  { code: "P98", name: "Premium 98",  short: "98", primary: true },
  { code: "E10", name: "Ethanol 94 (E10)", short: "E10", primary: false },
  { code: "PD",  name: "Premium Diesel",    short: "Premium Diesel", primary: false },
  { code: "LPG", name: "LPG",               short: "LPG", primary: false },
  { code: "E85", name: "E85",               short: "E85", primary: false },
  { code: "LAF", name: "Low Aromatic / OPAL", short: "OPAL", primary: false },
];

// QLD FPD API uses numeric FuelId
export const QLD_FUEL_MAP: Record<number, FuelCode> = {
  2: "U91",
  3: "DL",
  12: "E10",
  5: "P95",
  8: "P98",
  14: "PD",
  4: "LPG",
  19: "E85",
  21: "LAF",
};

// NT uses string codes that match ours directly
export const NT_FUEL_MAP: Record<string, FuelCode> = {
  U91: "U91",
  DL: "DL",
  E10: "E10",
  P95: "P95",
  P98: "P98",
  PD: "PD",
  LPG: "LPG",
  E85: "E85",
  LAF: "LAF",
};

// WA FuelWatch uses Product codes
export const WA_FUEL_MAP: Record<number, FuelCode> = {
  1: "U91",
  2: "P95",
  4: "DL",
  5: "LPG",
  6: "P98",
  10: "E85",
  11: "PD",
};

// QLD brand ID to name
export const QLD_BRAND_MAP: Record<number, string> = {
  2: "Caltex", 5: "BP", 7: "Budget", 12: "Independent",
  16: "Mobil", 20: "Shell", 23: "United", 27: "Unbranded",
  51: "Apco", 57: "Metro Fuel", 65: "Petrogas", 72: "Gull",
  86: "Liberty", 87: "AM/PM", 105: "Better Choice",
  110: "Freedom Fuels", 111: "Coles Express", 113: "7-Eleven",
  114: "Astron", 115: "Puma Energy",
};

// NT brand code to name
export const NT_BRAND_MAP: Record<string, string> = {
  AF: "Ausfuel", AM: "AMPOL", AS: "Astron", BP: "BP",
  C2: "Shell Coles Express", C3: "Shell Reddy Express",
  CA: "Caltex", CO: "Coles Express", CW: "Caltex Woolworths",
  EA: "EG Ampol", FX: "FuelXpress", IN: "Independent",
  IV: "Indervon", Li: "Liberty", MB: "Mobil", MO: "Mogas",
  OR: "On The Run", PM: "Puma Energy", SH: "Shell",
  SO: "Solo", UN: "United",
};
