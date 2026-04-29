"use client";

import { useEffect, useState } from "react";
import { useDiscounts, hasActiveDiscounts } from "@/lib/useDiscounts";

const DISMISS_KEY = "fuelsmart-discount-nudge-dismissed";

interface Props {
  /**
   * `floating` = bottom snackbar floating above the map (mobile-first default).
   * `inline`   = render inline as a card (used inside the desktop side panel).
   */
  variant?: "floating" | "inline";
}

/**
 * One-time dismissible prompt asking first-time visitors to configure
 * discounts so the map can show true effective prices.
 *
 * Hidden once the user either sets at least one discount or taps "Not now".
 */
export default function DiscountNudge({ variant = "floating" }: Props) {
  const { discounts, hydrated } = useDiscounts();
  const [dismissed, setDismissed] = useState(true); // assume dismissed during SSR/hydrate

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  if (!hydrated || dismissed || hasActiveDiscounts(discounts)) return null;

  if (variant === "inline") {
    return (
      <div
        role="region"
        aria-label="Discount setup suggestion"
        className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3 text-sm text-emerald-900"
      >
        <div className="flex items-start gap-2 mb-2">
          <span aria-hidden="true" className="text-lg leading-none">💳</span>
          <div className="flex-1 min-w-0">
            <strong className="block">See your true price at the pump.</strong>
            <span className="text-emerald-800 text-xs">
              Set your Coles docket, card cashback, or membership savings.
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href="/discounts"
            className="flex-1 inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Set up
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex items-center justify-center rounded-md bg-emerald-100 text-emerald-900 px-3 py-1.5 text-sm font-medium hover:bg-emerald-200 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  // Floating snackbar — fixed bottom, above the footer/safe area, below the map controls
  return (
    <div
      role="region"
      aria-label="Discount setup suggestion"
      className="fixed left-2 right-2 bottom-2 md:hidden z-[1500] safe-area-bottom safe-area-inset"
    >
      <div className="bg-emerald-50/95 backdrop-blur-sm border border-emerald-200 rounded-xl shadow-lg px-3 py-2.5 text-sm text-emerald-900 flex items-center gap-2">
        <span aria-hidden="true" className="text-lg leading-none">💳</span>
        <div className="flex-1 min-w-0">
          <strong className="block leading-tight">True price at the pump</strong>
          <span className="text-emerald-800 text-xs leading-tight">
            Set your discounts to see effective prices.
          </span>
        </div>
        <a
          href="/discounts"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium active:bg-emerald-700"
        >
          Set up
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] rounded-md text-emerald-900/70 active:bg-emerald-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
