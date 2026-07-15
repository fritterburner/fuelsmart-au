import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { ALL_STATES, STATE_NAMES, slugToState } from "@/lib/state-meta";
import { getStateTrend } from "@/lib/state-pricing";
import { formatAge } from "@/lib/time-format";
import SeoHeader from "@/components/SeoHeader";
import SeoFooterLinks from "@/components/SeoFooterLinks";
import TrendsFuelTabs from "@/components/TrendsFuelTabs";
import SaObligations from "@/components/SaObligations";

export const revalidate = 900;

type Params = { state: string };
type SearchParams = { fuel?: string };

function parseFuel(v?: string): FuelCode {
  const found = FUEL_TYPES.find((f) => f.code === v && f.primary);
  return found ? found.code : "U91";
}

function fuelName(code: FuelCode): string {
  return FUEL_TYPES.find((f) => f.code === code)?.name ?? code;
}

export async function generateStaticParams() {
  return ALL_STATES.map((s) => ({ state: s.toLowerCase() }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { state: slug } = await params;
  const state = slugToState(slug);
  if (!state) return { title: "State not found — FuelSmart AU" };

  const { fuel: fuelParam } = await searchParams;
  const fuel = parseFuel(fuelParam);
  const trend = await getStateTrend(state, fuel);
  const name = STATE_NAMES[state];
  const canonical = fuel === "U91" ? `/prices/${slug}` : `/prices/${slug}?fuel=${fuel}`;

  const description =
    trend.min != null && trend.average != null
      ? `Cheapest ${fuelName(fuel)} in ${name} is ${trend.min.toFixed(1)}¢/L right now, state average ${trend.average.toFixed(1)}¢/L across ${trend.stationCount} stations. Updated live.`
      : `Live ${fuelName(fuel)} prices for ${name} — cheapest stations, state average, and 7-day trend, as soon as the feed is live.`;

  return {
    title: `Cheapest ${fuelName(fuel)} in ${name} today — FuelSmart AU`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Cheapest ${fuelName(fuel)} in ${name} today — FuelSmart AU`,
      description,
      type: "website",
      url: canonical,
    },
  };
}

export default async function StatePricesPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { state: slug } = await params;
  const state = slugToState(slug);
  if (!state) notFound();

  const { fuel: fuelParam } = await searchParams;
  const fuel = parseFuel(fuelParam);
  const trend = await getStateTrend(state, fuel);
  const name = STATE_NAMES[state];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <SeoHeader title={`Fuel prices in ${name}`} />

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <section>
          <p className="text-sm text-gray-700 leading-relaxed">
            Live {fuelName(fuel)} prices across {name}, refreshed roughly every 15 minutes from the
            official state feed. See these stations on the{" "}
            <Link href="/" className="underline text-emerald-700 hover:text-emerald-800">
              live map
            </Link>{" "}
            or check the{" "}
            <Link href="/history" className="underline text-emerald-700 hover:text-emerald-800">
              30-day history &amp; forecast
            </Link>
            .
          </p>
        </section>

        <TrendsFuelTabs basePath={`/prices/${slug}`} activeFuel={fuel} />

        {trend.stationCount === 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-bold text-amber-900 mb-1">No data yet for {trend.state}</h2>
            <p className="text-xs text-amber-900 leading-relaxed">
              This state&apos;s feed isn&apos;t connected yet — see{" "}
              <Link href="/data-freshness" className="underline">
                data freshness
              </Link>{" "}
              for status. Check back soon, or browse a live state from{" "}
              <Link href="/trends" className="underline">
                national trends
              </Link>
              .
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Cheapest {trend.activeFuel}</div>
                <div className="font-mono text-2xl font-bold text-emerald-700">
                  {trend.min?.toFixed(1)}
                  <span className="text-sm">¢/L</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">State average</div>
                <div className="font-mono text-2xl font-bold text-gray-800">{trend.average?.toFixed(1)}¢</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Stations reporting</div>
                <div className="font-mono text-2xl font-bold text-gray-800">{trend.stationCount}</div>
              </div>
            </section>

            {trend.fallbackNotice && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                {trend.fallbackNotice}
              </p>
            )}

            {trend.direction && (
              <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-1">
                <div className="text-sm font-semibold text-gray-900">7-day direction: {trend.direction.label}</div>
                {trend.direction.phaseHint && <p className="text-xs text-gray-600">{trend.direction.phaseHint}</p>}
              </section>
            )}

            <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-900">
                Cheapest {trend.cheapest.length < trend.stationCount ? `${trend.cheapest.length} of ${trend.stationCount}` : trend.cheapest.length} stations
              </div>
              <ul className="divide-y divide-gray-100">
                {trend.cheapest.map((p, i) => (
                  <li key={p.station.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600 flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/station/${p.station.id}`}
                          className="font-medium text-sm text-gray-900 hover:text-emerald-700 truncate block"
                        >
                          {p.station.name}
                        </Link>
                        <div className="text-xs text-gray-500 truncate">
                          {p.station.brand} · {p.station.suburb}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-emerald-700 whitespace-nowrap">
                      {p.price.toFixed(1)}¢
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {trend.lastUpdate && (
              <p className="text-xs text-gray-500">
                {name} prices last updated {formatAge(trend.lastUpdate)}.
              </p>
            )}

            {state === "SA" && trend.cheapest.length > 0 && <SaObligations station={trend.cheapest[0].station} />}
          </>
        )}

        <section className="pt-2 border-t border-gray-200">
          <SeoFooterLinks current={`/prices/${slug}`} />
        </section>
      </div>
    </div>
  );
}
