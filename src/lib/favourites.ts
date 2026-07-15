"use client";

import { useEffect, useState } from "react";

// Device-local starred stations. Deliberately tiny: just an array of station
// ids in localStorage, mirroring the tolerant load/save pattern used by
// `useDiscounts.ts` (corrupt/legacy JSON degrades to an empty list rather
// than throwing).

export const FAVOURITES_STORAGE_KEY = "fuelsmart-favourites";
/**
 * Custom event fired after `saveFavourites`/`toggleFavourite` so same-tab
 * consumers (popup star + sidebar star + sidebar filter) re-read immediately.
 * The native `storage` event only fires across tabs.
 */
export const FAVOURITES_CHANGED_EVENT = "fuelsmart:favourites-changed";

export function loadFavourites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVOURITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function saveFavourites(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(ids));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FAVOURITES_CHANGED_EVENT));
  }
}

export function isFavourite(id: string, ids: string[]): boolean {
  return ids.includes(id);
}

/** Add/remove `id` from the saved list and persist. Returns the new list. */
export function toggleFavourite(id: string): string[] {
  const current = loadFavourites();
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  saveFavourites(next);
  return next;
}

/**
 * React hook mirroring `useDiscounts`: hydrates from localStorage on mount
 * and re-reads on same-tab toggles or cross-tab storage events.
 */
export function useFavourites(): { favourites: string[]; toggle: (id: string) => void } {
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    setFavourites(loadFavourites());

    function onStorage(e: StorageEvent) {
      if (e.key === FAVOURITES_STORAGE_KEY) setFavourites(loadFavourites());
    }
    function onSameTabChange() {
      setFavourites(loadFavourites());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(FAVOURITES_CHANGED_EVENT, onSameTabChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FAVOURITES_CHANGED_EVENT, onSameTabChange);
    };
  }, []);

  return {
    favourites,
    toggle: (id: string) => setFavourites(toggleFavourite(id)),
  };
}
