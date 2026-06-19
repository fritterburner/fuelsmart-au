/**
 * Device-local visual theme (no account, no server). A theme is two axes:
 *  - style:   "friendly" | "util"  → fonts, corner radius, borders, density
 *  - palette: a colour set within that style
 * We remember a palette PER style, so toggling style restores your last pick
 * (or the style's default). Applied by setting data-style / data-palette on
 * <html>; the CSS in globals.css swaps the --fs-* custom properties.
 */

export type ThemeStyle = "friendly" | "util";

export interface ThemeChoice {
  style: ThemeStyle;
  palettes: { friendly: string; util: string };
}

export interface PaletteInfo {
  id: string;
  label: string;
  swatch: string; // accent colour shown on the picker dot
  dark?: boolean; // dark-canvas palette (hint in the UI)
}

export const PALETTES: Record<ThemeStyle, PaletteInfo[]> = {
  friendly: [
    { id: "teal", label: "Teal", swatch: "#0FB39A" },
    { id: "citrus", label: "Citrus", swatch: "#F2920C" },
    { id: "coral", label: "Coral", swatch: "#FB6F61" },
    { id: "sky", label: "Sky", swatch: "#2F86E0" },
    { id: "berry", label: "Berry", swatch: "#7C5CD6" },
  ],
  util: [
    { id: "blueprint", label: "Blueprint", swatch: "#1F6FEB" },
    { id: "lime", label: "Lime", swatch: "#C6F24E" },
    { id: "hivis", label: "Hi-vis", swatch: "#FFB000", dark: true },
    { id: "terminal", label: "Terminal", swatch: "#43F08A", dark: true },
    { id: "swiss", label: "Swiss", swatch: "#E5392E" },
  ],
};

export const STYLE_DEFAULT_PALETTE: Record<ThemeStyle, string> = {
  friendly: "teal",
  util: "blueprint",
};

export const DARK_PALETTES = new Set<string>(["hivis", "terminal"]);

export function isDarkPalette(id: string | null | undefined): boolean {
  return !!id && DARK_PALETTES.has(id);
}

export const DEFAULT_THEME: ThemeChoice = {
  style: "friendly",
  palettes: { friendly: "teal", util: "blueprint" },
};

const KEY = "fuelsmart-theme";

function validPalette(style: ThemeStyle, id: unknown): string {
  const list = PALETTES[style];
  return typeof id === "string" && list.some((p) => p.id === id)
    ? id
    : STYLE_DEFAULT_PALETTE[style];
}

export function loadTheme(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THEME;
    const p = JSON.parse(raw) as Partial<ThemeChoice>;
    const style: ThemeStyle = p.style === "util" ? "util" : "friendly";
    return {
      style,
      palettes: {
        friendly: validPalette("friendly", p.palettes?.friendly),
        util: validPalette("util", p.palettes?.util),
      },
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(t: ThemeChoice): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    /* storage disabled — theme just won't persist */
  }
}

export function applyTheme(t: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.setAttribute("data-style", t.style);
  r.setAttribute("data-palette", t.palettes[t.style]);
}

export function activePalette(t: ThemeChoice): string {
  return t.palettes[t.style];
}
