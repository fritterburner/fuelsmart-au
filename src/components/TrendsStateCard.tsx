import Link from "next/link";
import type { FuelCode } from "@/lib/types";
import type { StateTrend } from "@/lib/state-pricing";
import { STATE_NAMES, stateSlug } from "@/lib/state-meta";

const DIRECTION_STYLE: Record<string, { label: string; cls: string; icon: string }> = {
  rising: { label: "Rising", cls: "bg-amber-100 text-amber-900 border-amber-300", icon: "▲" },
  falling: { label: "Falling", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: "▼" },
  steady: { label: "Steady", cls: "bg-gray-100 text-gray-700 border-gray-300", icon: "▬" },
};

/** One state's card on the /trends national overview. */
export default function TrendsStateCard({ trend, fuel }: { trend: StateTrend; fuel: FuelCode }) {
  const name = STATE_NAMES[trend.state];
  const slug = stateSlug(trend.state);
  const dir = trend.direction ? DIRECTION_STYLE[trend.direction.direction] : null;
  const href = fuel === "U91" ? `/prices/${slug}` : `/prices/${slug}?fuel=${fuel}`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-gray-900">{name}</h3>
        <span className="text-xs text-gray-400">{trend.state}</span>
      </div>

      {trend.stationCount === 0 ? (
        <p className="text-sm text-gray-500 italic py-2">
          No data yet for {trend.state} — this feed isn&apos;t connected yet.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Cheapest {trend.activeFuel}</div>
              <div className="font-mono text-2xl font-bold text-emerald-700">
                {trend.min?.toFixed(1)}
                <span className="text-sm">¢/L</span>
              </div>
            </div>
            {trend.average != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">State average</div>
                <div className="font-mono text-lg font-semibold text-gray-800">{trend.average.toFixed(1)}¢</div>
              </div>
            )}
          </div>

          {dir && (
            <span
              className={`self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${dir.cls}`}
            >
              <span aria-hidden="true">{dir.icon}</span> {dir.label}
            </span>
          )}
          {trend.direction?.phaseHint && <p className="text-xs text-gray-500">{trend.direction.phaseHint}</p>}
          {trend.fallbackNotice && <p className="text-[11px] text-amber-700">{trend.fallbackNotice}</p>}
        </>
      )}

      <Link href={href} className="mt-auto pt-1 text-sm text-emerald-700 hover:text-emerald-800 underline underline-offset-2 font-medium">
        See {trend.state} stations →
      </Link>
    </div>
  );
}
