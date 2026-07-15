import type { Metadata } from "next";
import Link from "next/link";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { STATE_NAMES } from "@/lib/state-meta";
import { getNationalTrends } from "@/lib/state-pricing";
import SeoHeader from "@/components/SeoHeader";
import SeoFooterLinks from "@/components/SeoFooterLinks";
import TrendsFuelTabs from "@/components/TrendsFuelTabs";
import TrendsStateCard from "@/components/TrendsStateCard";

// Matches the ~15-minute refresh cadence of the underlying feeds. The data
// fetch itself is additionally wrapped in unstable_cache (see
// lib/state-pricing.ts) so the ?fuel= query param — which forces this page to
// render dynamically per request — doesn't turn every visit into a fresh
// round-trip to Redis.
export const revalidate = 900;

type SearchParams = { fuel?: string };

function parseFuel(v?: string): FuelCode {
  const found = FUEL_TYPES.find((f) => f.code === v && f.primary);
  return found ? found.code : "U91";
}

function fuelName(code: FuelCode): string {
  return FUEL_TYPES.find((f) => f.code === code)?.name ?? code;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { fuel: fuelParam } = await searchParams;
  const fuel = parseFuel(fuelParam);
  const canonical = fuel === "U91" ? "/trends" : `/trends?fuel=${fuel}`;
  const description = `Compare live ${fuelName(fuel)} prices across every Australian state and territory — cheapest stations, state averages, and which way prices are heading this week.`;

  return {
    title: `${fuelName(fuel)} prices by state — national trends | FuelSmart AU`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${fuelName(fuel)} prices by state — FuelSmart AU`,
      description,
      type: "website",
      url: canonical,
    },
  };
}

export default async function TrendsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { fuel: fuelParam } = await searchParams;
  const fuel = parseFuel(fuelParam);
  const trends = await getNationalTrends(fuel);

  const live = trends.filter((t) => t.stationCount > 0 && t.min != null);
  const nationalCheapest = live.length
    ? live.reduce((a, b) => ((b.min as number) < (a.min as number) ? b : a))
    : null;
  const nationalAverage = live.length
    ? Math.round((live.reduce((sum, t) => sum + (t.average ?? 0), 0) / live.length) * 10) / 10
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <SeoHeader title="National fuel price trends" />

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <section>
          <p className="text-sm text-gray-700 leading-relaxed">
            FuelSmart AU tracks live {fuelName(fuel)} prices at thousands of stations across every
            state and territory — no accounts, no tracking, just the numbers. Pick a fuel below,
            then jump into a state for the cheapest stations right now, or head to the{" "}
            <Link href="/" className="underline text-emerald-700 hover:text-emerald-800">
              live map
            </Link>
            ,{" "}
            <Link href="/trip" className="underline text-emerald-700 hover:text-emerald-800">
              trip planner
            </Link>{" "}
            or{" "}
            <Link href="/history" className="underline text-emerald-700 hover:text-emerald-800">
              30-day history &amp; forecast
            </Link>
            .
          </p>
        </section>

        <TrendsFuelTabs basePath="/trends" activeFuel={fuel} />

        {nationalCheapest && (
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Cheapest nationally</div>
              <div className="font-mono text-2xl font-bold text-emerald-700">
                {nationalCheapest.min?.toFixed(1)}
                <span className="text-sm">¢/L</span>
              </div>
              <div className="text-xs text-gray-500">{STATE_NAMES[nationalCheapest.state]}</div>
            </div>
            {nationalAverage != null && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">National average</div>
                <div className="font-mono text-2xl font-bold text-gray-800">{nationalAverage.toFixed(1)}¢</div>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">States live</div>
              <div className="font-mono text-2xl font-bold text-gray-800">
                {live.length} / {trends.length}
              </div>
            </div>
          </section>
        )}

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Prices by state">
          {trends.map((t) => (
            <TrendsStateCard key={t.state} trend={t} fuel={fuel} />
          ))}
        </section>

        <section className="pt-2 border-t border-gray-200">
          <SeoFooterLinks current="/trends" />
        </section>

        <p className="text-xs text-gray-500 leading-relaxed">
          Prices refresh roughly every 15 minutes from each state&apos;s official feed. See{" "}
          <Link href="/data-freshness" className="underline">
            data freshness
          </Link>{" "}
          for per-state cadence and sourcing.
        </p>
      </div>
    </div>
  );
}
