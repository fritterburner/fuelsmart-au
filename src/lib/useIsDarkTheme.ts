"use client";

import { useEffect, useState } from "react";
import { isDarkPalette } from "@/lib/theme";

/**
 * True when the active palette is a dark-canvas one (hi-vis / terminal). Reads
 * the data-palette attribute on <html> and observes it, so the map basemap
 * swaps live if the theme changes.
 */
export function useIsDarkTheme(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () =>
      setDark(isDarkPalette(document.documentElement.getAttribute("data-palette")));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-palette"],
    });
    return () => obs.disconnect();
  }, []);

  return dark;
}
