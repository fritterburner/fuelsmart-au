import Link from "next/link";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { FuelCode } from "@/lib/types";

/**
 * Link-based fuel selector for the server-rendered SEO pages (/trends,
 * /prices/[state]). Deliberately plain <Link>s rather than client-side
 * state — switching fuel is a real navigation to `${basePath}?fuel=XX`, which
 * keeps the pages crawlable/shareable per fuel and server-rendered.
 */
export default function TrendsFuelTabs({ basePath, activeFuel }: { basePath: string; activeFuel: FuelCode }) {
  const primaryFuels = FUEL_TYPES.filter((f) => f.primary);

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Fuel type">
      {primaryFuels.map((f) => {
        const isActive = f.code === activeFuel;
        const href = f.code === "U91" ? basePath : `${basePath}?fuel=${f.code}`;
        return (
          <Link
            key={f.code}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`min-h-[40px] inline-flex items-center px-3 rounded-lg border text-sm font-medium transition-colors ${
              isActive
                ? "bg-emerald-600 text-white border-emerald-500"
                : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"
            }`}
          >
            {f.short}
          </Link>
        );
      })}
    </div>
  );
}
