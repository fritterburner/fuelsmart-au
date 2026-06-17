import { Station } from "@/lib/types";
import { SA_ATTRIBUTION, SA_COMPLAINT_CONTACT } from "@/lib/attribution";

/**
 * SA Fuel Pricing Information Scheme consumer obligations (Data Publisher T&Cs
 * cl. 3.1 attribution + cl. 3.3 stale-data complaint path). Renders only for SA
 * stations, so it's inert until the SA feed goes live — pre-built so SA go-live
 * is turnkey.
 */
export default function SaObligations({ station }: { station: Station }) {
  if (station.state !== "SA") return null;
  const subject = encodeURIComponent(`Stale fuel price — ${station.name}`);
  return (
    <div className="mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-500">
      <a
        href={`mailto:${SA_COMPLAINT_CONTACT}?subject=${subject}`}
        className="underline text-blue-700"
      >
        Report a stale price to CBS
      </a>
      <div className="mt-1">{SA_ATTRIBUTION}</div>
    </div>
  );
}
