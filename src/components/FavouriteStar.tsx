"use client";

import { useEffect, useState } from "react";
import {
  loadFavourites,
  toggleFavourite,
  FAVOURITES_CHANGED_EVENT,
  FAVOURITES_STORAGE_KEY,
} from "@/lib/favourites";

interface Props {
  stationId: string;
  className?: string;
}

/**
 * Star toggle for a single station. Self-contained: reads/writes
 * localStorage directly and listens for the favourites-changed event so
 * every instance for the same station (popup + sidebar row) stays in sync
 * without lifting state up through MapView.
 */
export default function FavouriteStar({ stationId, className = "" }: Props) {
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    setStarred(loadFavourites().includes(stationId));

    function sync() {
      setStarred(loadFavourites().includes(stationId));
    }
    function onStorage(e: StorageEvent) {
      if (e.key === FAVOURITES_STORAGE_KEY) sync();
    }
    window.addEventListener(FAVOURITES_CHANGED_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(FAVOURITES_CHANGED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, [stationId]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleFavourite(stationId);
      }}
      aria-pressed={starred}
      aria-label={starred ? "Remove from favourites" : "Add to favourites"}
      title={starred ? "Remove from favourites" : "Add to favourites"}
      className={`inline-flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fs-accent ${className}`}
    >
      <span
        aria-hidden="true"
        className={starred ? "text-amber-400" : "text-fs-muted"}
      >
        {starred ? "★" : "☆"}
      </span>
    </button>
  );
}
