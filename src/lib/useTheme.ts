"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ThemeChoice,
  ThemeStyle,
  DEFAULT_THEME,
  loadTheme,
  saveTheme,
  applyTheme,
} from "@/lib/theme";

/**
 * Read/write the device-local theme and apply it live (no reload). On mount we
 * load the saved choice and re-apply it (the inline loader in layout already
 * set it pre-paint; this keeps React state in sync). Switching style keeps the
 * remembered palette for that style.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>(DEFAULT_THEME);

  useEffect(() => {
    function init() {
      const t = loadTheme();
      setThemeState(t);
      applyTheme(t);
    }
    init();
  }, []);

  const commit = useCallback((t: ThemeChoice) => {
    setThemeState(t);
    saveTheme(t);
    applyTheme(t);
  }, []);

  const setStyle = useCallback((style: ThemeStyle) => {
    setThemeState((prev) => {
      const t: ThemeChoice = { ...prev, style };
      saveTheme(t);
      applyTheme(t);
      return t;
    });
  }, []);

  const setPalette = useCallback((palette: string) => {
    setThemeState((prev) => {
      const t: ThemeChoice = {
        ...prev,
        palettes: { ...prev.palettes, [prev.style]: palette },
      };
      saveTheme(t);
      applyTheme(t);
      return t;
    });
  }, []);

  return { theme, setStyle, setPalette, setTheme: commit };
}
