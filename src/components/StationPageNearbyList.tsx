import Link from "next/link";
import type { NearbyAlternative } from "@/lib/station-detail";

export default function StationPageNearbyList({
  alternatives,
  fuelLabel,
}: {
  alternatives: NearbyAlternative[];
  fuelLabel: string;
}) {
  if (alternatives.length === 0) {
    return <p className="text-sm text-gray-500 italic">No cheaper {fuelLabel} stations within 5 km right now.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {alternatives.map((a) => (
        <li key={a.station.id} className="py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/station/${a.station.id}`}
              className="font-medium text-sm text-gray-900 hover:text-emerald-700 truncate block"
            >
              {a.station.name}
            </Link>
            <div className="text-xs text-gray-500">
              {a.station.brand} · {a.distanceKm.toFixed(1)} km away
            </div>
          </div>
          <div className="font-mono text-sm font-semibold text-emerald-700 whitespace-nowrap">
            {a.price.toFixed(1)}¢
          </div>
        </li>
      ))}
    </ul>
  );
}
