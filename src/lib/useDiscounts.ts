"use client";

import { useEffect, useState } from "react";
import type { Discount } from "./discounts";

export const DISCOUNTS_STORAGE_KEY = "fuelsmart-discounts";

export const SEED_DISCOUNTS: Discount[] = [
  {
    id: "seed-coles-docket",
    name: "Coles shopper docket (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
  },
  {
    id: "seed-racq",
    name: "RACQ / NRMA member (4c/L)",
    type: "fixed_cpl",
    value: 4,
    appliesTo: "both",
    enabled: false,
  },
  {
    id: "seed-amex",
    name: "Amex/card cashback (2%)",
    type: "percent_cashback",
    value: 2,
    appliesTo: "both",
    enabled: false,
  },
  {
    id: "seed-7e",
    name: "7-Eleven Fuel Price Lock (app)",
    type: "fixed_cpl",
    value: 0,
    appliesTo: "both",
    enabled: false,
  },
];

export function loadDiscounts(): Discount[] {
  if (typeof window === "undefined") return SEED_DISCOUNTS;
  try {
    const raw = localStorage.getItem(DISCOUNTS_STORAGE_KEY);
    if (!raw) return SEED_DISCOUNTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_DISCOUNTS;
    return parsed;
  } catch {
    return SEED_DISCOUNTS;
  }
}

export function saveDiscounts(list: Discount[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISCOUNTS_STORAGE_KEY, JSON.stringify(list));
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
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { discounts, hydrated };
}

export function hasActiveDiscounts(list: Discount[]): boolean {
  return list.some((d) => d.enabled);
}
