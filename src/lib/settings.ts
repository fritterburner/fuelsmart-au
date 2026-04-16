import { FuelCode } from "./types";

export interface UserSettings {
  defaultFuel: FuelCode;
  tankSize: number;
  consumption: number;
  jerryCapacity: number;
  homeLat: number | null;
  homeLng: number | null;
  homeLabel: string;
  /**
   * When true, map pins are coloured by federal-excise pass-through verdict
   * (green = full pass-through, amber = partial, red = none, blue = price rose).
   * When false, pins use the default cheap/mid/expensive palette.
   */
  exciseMode: boolean;
}

const STORAGE_KEY = "fuelsmart-settings";

const DEFAULTS: UserSettings = {
  defaultFuel: "U91",
  tankSize: 45,
  consumption: 10.5,
  jerryCapacity: 0,
  homeLat: null,
  homeLng: null,
  homeLabel: "",
  exciseMode: false,
};

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULTS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULTS;
  return { ...DEFAULTS, ...JSON.parse(stored) };
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
