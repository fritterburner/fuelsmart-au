"use client";

import type { PriceMode } from "@/lib/settings";

interface Props {
  mode: PriceMode;
  onChange: (next: PriceMode) => void;
  /**
   * `sidebar`     = compact segmented control for the desktop station-list
   *                 panel (MapView's aside, next to the Sort control).
   * `mobile-menu` = full-width row for the mobile kebab menu, mirroring
   *                 ExciseToggle's mobile-menu presentation so mobile users
   *                 have a reachable equivalent of the desktop control.
   */
  variant: "sidebar" | "mobile-menu";
}

/**
 * Persisted BOARD vs EFFECTIVE price display toggle.
 *
 * Callers are expected to only render this when `hasActiveDiscounts` is true
 * (see `src/lib/useDiscounts.ts`) — with no active discounts, board and
 * effective prices are identical, so the control has nothing meaningful to do.
 */
export default function PriceModeToggle({ mode, onChange, variant }: Props) {
  if (variant === "mobile-menu") {
    return (
      <div role="none" className="px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm text-gray-100 mb-1.5">
          <span aria-hidden="true">💳</span> Pump prices
        </span>
        <div
          role="group"
          aria-label="Price display"
          className="inline-flex w-full rounded-lg border border-slate-500 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => onChange("board")}
            aria-pressed={mode === "board"}
            aria-label="Show board prices, before discounts"
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fs-accent ${
              mode === "board" ? "bg-emerald-600 text-white" : "text-gray-200 hover:bg-slate-600"
            }`}
          >
            Board
          </button>
          <button
            type="button"
            onClick={() => onChange("effective")}
            aria-pressed={mode === "effective"}
            aria-label="Show prices with your discounts applied"
            className={`flex-1 px-3 py-2 text-sm font-medium border-l border-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fs-accent ${
              mode === "effective" ? "bg-emerald-600 text-white" : "text-gray-200 hover:bg-slate-600"
            }`}
          >
            With discounts
          </button>
        </div>
      </div>
    );
  }

  // sidebar
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs">
      <span className="text-fs-muted">Prices:</span>
      <div
        role="group"
        aria-label="Price display"
        className="inline-flex rounded border border-fs-line overflow-hidden"
      >
        <button
          type="button"
          onClick={() => onChange("board")}
          aria-pressed={mode === "board"}
          aria-label="Show board prices, before discounts"
          className={`px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fs-accent ${
            mode === "board" ? "bg-fs-accent text-fs-accent-ink" : "bg-fs-surface text-fs-ink hover:bg-fs-bg"
          }`}
        >
          Board
        </button>
        <button
          type="button"
          onClick={() => onChange("effective")}
          aria-pressed={mode === "effective"}
          aria-label="Show prices with your discounts applied"
          className={`px-2 py-1 border-l border-fs-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fs-accent ${
            mode === "effective" ? "bg-fs-accent text-fs-accent-ink" : "bg-fs-surface text-fs-ink hover:bg-fs-bg"
          }`}
        >
          With discounts
        </button>
      </div>
    </div>
  );
}
