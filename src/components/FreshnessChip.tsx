"use client";

import { useEffect, useState } from "react";

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Small "prices updated X ago" chip on the map. Reads the global last-refresh
 * time from /api/meta. Honest about staleness — once refresh cadence tightens
 * it'll read in minutes rather than hours.
 */
export default function FreshnessChip() {
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/meta");
        const data = await res.json();
        if (active) setUpdated(data.lastUpdate ?? null);
      } catch {
        /* ignore — chip just stays hidden */
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const label = ago(updated);
  if (!label) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-full shadow px-3 py-1 text-[11px] text-slate-600 inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Prices updated {label}
    </div>
  );
}
