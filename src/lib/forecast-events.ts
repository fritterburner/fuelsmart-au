import { FuelCode } from "./types";

export interface PolicyEvent {
  /** Day the step takes effect (YYYY-MM-DD). */
  date: string;
  label: string;
  /** Signed c/L step applied from `date` onward. */
  impactCpl: number;
  /** Fuels affected; omit for "all fuels". */
  fuels?: FuelCode[];
}

// Excise applies to petrol/diesel/ethanol blends — not LPG, not Low-Aromatic.
const PETROL_DIESEL: FuelCode[] = ["U91", "E10", "P95", "P98", "DL", "PD", "E85"];

/**
 * Known fuel-price policy events. The forecast applies each as a step change on
 * its date — the thing a pure oil-cycle model can't anticipate. Impacts are best
 * estimates; revise as policy is confirmed.
 */
export const POLICY_EVENTS: PolicyEvent[] = [
  {
    date: "2026-06-30",
    label: "Temporary excise cut ends — excise returns to the full rate",
    impactCpl: 26.3, // the ~26.3 c/L halving is removed, so pump prices step up
    fuels: PETROL_DIESEL,
  },
  { date: "2026-08-01", label: "Biannual fuel excise CPI indexation", impactCpl: 0.6, fuels: PETROL_DIESEL },
  { date: "2027-02-01", label: "Biannual fuel excise CPI indexation", impactCpl: 0.6, fuels: PETROL_DIESEL },
];

/** Events whose date falls within [start, end] (inclusive) and affect `fuel`. */
export function eventsInWindow(start: string, end: string, fuel: FuelCode): PolicyEvent[] {
  return POLICY_EVENTS.filter(
    (e) => e.date >= start && e.date <= end && (!e.fuels || e.fuels.includes(fuel)),
  );
}
