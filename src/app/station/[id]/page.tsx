import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedStations } from "@/lib/cache";
import { getStationHistory } from "@/lib/history";
import { findNearbyCheaper } from "@/lib/station-detail";
import { formatAge } from "@/lib/time-format";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { FuelCode, Station } from "@/lib/types";
import { STATE_NAMES } from "@/lib/state-meta";
import SeoHeader from "@/components/SeoHeader";
import SeoFooterLinks from "@/components/SeoFooterLinks";
import StationPageNearbyList from "@/components/StationPageNearbyList";
import StationNavLinks from "@/components/StationNavLinks";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import SaObligations from "@/components/SaObligations";

export const revalidate = 900;

async function loadStation(id: string): Promise<{ station: Station; allStations: Station[] } | null> {
  const stations = await getCachedStations();
  if (!stations) return null;
  const station = stations.find((s) => s.id === id);
  return station ? { station, allStations: stations } : null;
}

function fuelName(code: string): string {
  return FUEL_TYPES.find((f) => f.code === code)?.name ?? code;
}

function primaryFuelOf(station: Station): FuelCode | undefined {
  const sorted = station.prices.slice().sort((a, b) => a.price - b.price);
  return sorted.find((p) => FUEL_TYPES.find((f) => f.code === p.fuel)?.primary)?.fuel ?? sorted[0]?.fuel;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadStation(id);
  if (!data) return { title: "Station not found — FuelSmart AU" };
  const { station } = data;

  const cheapest = station.prices.slice().sort((a, b) => a.price - b.price)[0];
  const priceBit = cheapest ? `${fuelName(cheapest.fuel)} from ${cheapest.price.toFixed(1)}¢/L. ` : "";
  const description = `${priceBit}Current prices, freshness and nearby cheaper alternatives for ${station.name} (${station.brand}), ${station.suburb}, ${STATE_NAMES[station.state]}.`;

  return {
    title: `${station.name} — fuel prices, ${station.suburb} ${station.state} | FuelSmart AU`,
    description,
    alternates: { canonical: `/station/${station.id}` },
    openGraph: {
      title: `${station.name} — ${station.brand} — FuelSmart AU`,
      description,
      type: "website",
      url: `/station/${station.id}`,
    },
  };
}

export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadStation(id);
  if (!data) notFound();
  const { station, allStations } = data;

  const sortedPrices = station.prices.slice().sort((a, b) => a.price - b.price);
  const primaryFuel = primaryFuelOf(station);

  const [sparkline, nearby] = await Promise.all([
    primaryFuel ? getStationHistory(station.id, primaryFuel, 30) : Promise.resolve([]),
    Promise.resolve(primaryFuel ? findNearbyCheaper(station, allStations, primaryFuel) : []),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <SeoHeader title={station.name} />

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">{station.name}</h2>
          <p className="text-sm text-gray-600">{station.brand}</p>
          <p className="text-sm text-gray-500 mt-1">
            {station.address}, {station.suburb} {station.state} {station.postcode}
          </p>
          <StationNavLinks lat={station.lat} lng={station.lng} name={station.name} />
          <SaObligations station={station} />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold text-gray-900">
            Current prices
          </div>
          {sortedPrices.length === 0 ? (
            <p className="text-sm text-gray-500 italic px-4 py-3">No prices reported for this station yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedPrices.map((p) => (
                <li key={p.fuel} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{fuelName(p.fuel)}</div>
                    <div className="text-xs text-gray-500">Updated {formatAge(p.updated)}</div>
                  </div>
                  <div className="font-mono text-base font-semibold text-emerald-700">{p.price.toFixed(1)}¢</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {primaryFuel && (
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 mb-2">30-day {fuelName(primaryFuel)} trend</div>
            <PriceHistoryChart
              series={[
                {
                  label: primaryFuel,
                  color: "#0f766e",
                  points: sparkline.map((s) => ({ date: s.date, value: s.price })),
                },
              ]}
            />
          </section>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900 mb-2">
            Cheaper nearby (within 5 km{primaryFuel ? `, ${fuelName(primaryFuel)}` : ""})
          </div>
          <StationPageNearbyList alternatives={nearby} fuelLabel={primaryFuel ? fuelName(primaryFuel) : "fuel"} />
        </section>

        <section className="pt-2 border-t border-gray-200">
          <SeoFooterLinks />
        </section>
      </div>
    </div>
  );
}
