"use client";

import { useEffect, useState } from "react";
import { useDiscounts, hasActiveDiscounts } from "@/lib/useDiscounts";

const DISMISS_KEY = "fuelsmart-discount-nudge-dismissed";

/**
 * One-time dismissible card that prompts first-time visitors to configure
 * discounts so the map can show true effective prices. Hidden once the user
 * either sets at least one discount or taps "Not now".
 */
export default function DiscountNudge() {
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

  return (
    <div
      role="region"
      aria-label="Discount setup suggestion"
      className="bg-emerald-50 border-b border-emerald-200 px-3 py-2 md:px-4 text-sm text-emerald-900 flex items-center gap-3 flex-wrap"
    >
      <span aria-hidden="true" className="text-lg">
        💳
      </span>
      <div className="flex-1 min-w-0">
        <strong>See your true price at the pump.</strong>{" "}
        <span className="text-emerald-800">
          Set your Coles docket, card cashback, or membership savings and
          we&apos;ll show the after-discount price on each station.
        </span>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <a
          href="/discounts"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700 transition-colors"
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
