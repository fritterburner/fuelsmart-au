import type { FuelCode } from "@/lib/types";
import type { FuelBucket } from "./types";

/**
 * Map a FuelCode to the excise bucket used by calcVerdict.
 *
 * - Petrols (U91, E10, P95, P98) → ULP (baseline + 0.45 crude ratio)
 * - Diesel variants (DL, PD) → DIESEL (baseline + 0.50 crude ratio)
 * - LPG, E85, LAF (low-aromatic fuel for remote areas) → NA (different excise treatment)
 */
export function toFuelBucket(code: FuelCode): FuelBucket {
  switch (code) {
    case "U91":
    case "E10":
    case "P95":
    case "P98":
      return "ULP";
    case "DL":
    case "PD":
      return "DIESEL";
    case "LPG":
    case "E85":
    case "LAF":
      return "NA";
  }
}
