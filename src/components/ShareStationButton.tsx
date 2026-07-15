"use client";

import { useState } from "react";

interface Props {
  stationId: string;
  stationName?: string;
  className?: string;
}

/**
 * Share a deep link to this station's price. Uses the Web Share API when
 * available (mobile browsers, mostly); otherwise copies the link to the
 * clipboard and shows a brief "Copied!" confirmation.
 */
export default function ShareStationButton({ stationId, stationName, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/?station=${encodeURIComponent(stationId)}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: stationName ? `${stationName} — FuelSmart AU` : "FuelSmart AU",
          url,
        });
      } catch {
        /* user cancelled the share sheet — nothing to do */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — silently give up rather than throw in a popup */
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share this station's price"
      title="Share this station's price"
      className={`inline-flex items-center gap-1 text-[11px] text-emerald-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fs-accent rounded ${className}`}
    >
      <span aria-hidden="true">🔗</span> {copied ? "Copied!" : "Share"}
    </button>
  );
}
