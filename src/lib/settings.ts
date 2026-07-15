import { FuelCode } from "./types";

/**
 * BOARD = the raw price the sign/pump shows. EFFECTIVE = board price after
 * the user's configured loyalty/membership discounts (see `src/lib/discounts.ts`).
 * Drives the map's price-mode toggle — see `src/components/PriceModeToggle.tsx`.
 */
export type PriceMode = "board" | "effective";

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
   * When false, pins use the default rank-based palette (see
   * `cheapestHighlightCount` and `src/lib/rank-palette.ts`).
   */
  exciseMode: boolean;
  /**
   * Default-mode pin palette: how many of the cheapest visible stations to
   * highlight in green. Range 1–10. The rest of the palette (red/orange tail,
   * neutral gray middle) is derived from this count — see `rank-palette.ts`.
   */
  cheapestHighlightCount: number;
  /**
   * Map price display: "effective" (default, preserves prior behaviour) shows
   * prices after the user's active discounts; "board" shows raw pump/sign
   * prices with no discount adjustment. Only meaningfully different from
   * "effective" when the user has at least one enabled discount — see
   * `hasActiveDiscounts` in `src/lib/useDiscounts.ts`.
   */
  priceMode: PriceMode;
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
  cheapestHighlightCount: 3,
  priceMode: "effective",
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
