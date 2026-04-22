"use client";

import { useEffect, useState } from "react";
import type { Discount } from "./discounts";

export const DISCOUNTS_STORAGE_KEY = "fuelsmart-discounts";
/**
 * Custom event fired after `saveDiscounts` so same-tab consumers of `useDiscounts`
 * re-read the list. The native `storage` event only fires across tabs.
 */
export const DISCOUNTS_CHANGED_EVENT = "fuelsmart:discounts-changed";

export const SEED_DISCOUNTS: Discount[] = [
  {
    id: "seed-coles-docket",
    name: "Coles shopper docket (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
    brands: ["Coles Express"],
    states: [],
  },
  {
    id: "seed-woolies",
    name: "Woolworths Rewards (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
    // Current Woolies fuel partner is EG Ampol. SME-confirmable — the
    // historic Caltex Woolworths arrangement is kept as an alias so older
    // co-branded sites still match.
    brands: ["EG Ampol", "Caltex Woolworths"],
    states: [],
  },
  {
    id: "seed-racq",
    name: "RACQ member (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
    brands: ["Puma Energy", "Better Choice"],
    states: ["QLD"],
  },
  {
    id: "seed-nrma",
    name: "NRMA member (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
    brands: ["Ampol"],
    states: ["NSW", "ACT"],
  },
  {
    id: "seed-racv",
    name: "RACV member (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
    brands: ["Ampol"],
    states: ["VIC"],
  },
  {
    id: "seed-raa",
    name: "RAA member (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
    brands: ["Ampol"],
    states: ["SA"],
  },
  {
    id: "seed-aant",
    name: "AANT member (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
    brands: ["United"],
    states: ["NT"],
  },
  {
    id: "seed-amex",
    name: "Amex / card cashback (2%)",
    type: "percent_cashback",
    value: 2,
    appliesTo: "both",
    enabled: false,
    brands: [],
    states: [],
  },
  {
    id: "seed-7e",
    name: "7-Eleven Fuel Price Lock (app)",
    type: "fixed_cpl",
    value: 0,
    appliesTo: "both",
    enabled: false,
    brands: ["7-Eleven"],
    states: [],
  },
];

/**
 * Fill in missing brands/states arrays on legacy saved discounts. localStorage
 * data predating Commit B had no brand/state filters — treat it as
 * "applies everywhere" (empty arrays) rather than discarding it.
 */
function migrate(parsed: unknown): Discount[] {
  if (!Array.isArray(parsed)) return SEED_DISCOUNTS;
  return parsed.map((raw) => {
    const d = raw as Partial<Discount>;
    return {
      id: d.id ?? "",
      name: d.name ?? "",
      type: (d.type ?? "fixed_cpl") as Discount["type"],
      value: typeof d.value === "number" ? d.value : 0,
      appliesTo: d.appliesTo ?? "both",
      enabled: d.enabled ?? false,
      brands: Array.isArray(d.brands) ? d.brands : [],
      states: Array.isArray(d.states) ? d.states : [],
      stationIds: Array.isArray(d.stationIds) ? d.stationIds : undefined,
    };
  });
}

export function loadDiscounts(): Discount[] {
  if (typeof window === "undefined") return SEED_DISCOUNTS;
  try {
    const raw = localStorage.getItem(DISCOUNTS_STORAGE_KEY);
    if (!raw) return SEED_DISCOUNTS;
    return migrate(JSON.parse(raw));
  } catch {
    return SEED_DISCOUNTS;
  }
}

export function saveDiscounts(list: Discount[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISCOUNTS_STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(DISCOUNTS_CHANGED_EVENT));
}

/**
 * React hook that returns the user's saved discount list plus a hydrated flag.
 * Returns [] until hydration completes (first client render) so SSR and the
 * first client render agree. Re-reads from localStorage on a `storage` event
 * so the map popup updates immediately after the user toggles a discount
 * on the /discounts page in another tab.
 */
export function useDiscounts(): { discounts: Discount[]; hydrated: boolean } {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDiscounts(loadDiscounts());
    setHydrated(true);

    function onStorage(e: StorageEvent) {
      if (e.key === DISCOUNTS_STORAGE_KEY) setDiscounts(loadDiscounts());
    }
    function onSameTabChange() {
      setDiscounts(loadDiscounts());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(DISCOUNTS_CHANGED_EVENT, onSameTabChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DISCOUNTS_CHANGED_EVENT, onSameTabChange);
    };
  }, []);

  return { discounts, hydrated };
}

export function hasActiveDiscounts(list: Discount[]): boolean {
  return list.some((d) => d.enabled);
}
