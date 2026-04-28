import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data freshness — FuelSmart AU",
  description:
    "How often each state's fuel prices update, and what the timestamp on a pin actually means.",
};

interface StateEntry {
  code: string;
  label: string;
  source: string;
  cadence: string;
  detail: string;
}

const STATES: StateEntry[] = [
  {
    code: "NSW",
    label: "New South Wales",
    source: "FuelCheck NSW",
    cadence: "Near real-time",
    detail:
      "Retailers are legally required to report price changes within 30 minutes under the Fuel Check Act 2016. Most pins update within an hour of a pump change.",
  },
  {
    code: "QLD",
    label: "Queensland",
    source: "Fuel Price Reporting",
    cadence: "30-minute rule",
    detail:
      "Mandatory reporting within 30 minutes of any price change under the Petroleum Products Pricing Act 2020.",
  },
  {
    code: "WA",
    label: "Western Australia",
    source: "FuelWatch WA",
    cadence: "24-hour delay",
    detail:
      "Retailers set prices by 2 pm the day before they apply. Today's pump price is yesterday's published number — but it's locked in for 24 hours by law.",
  },
  {
    code: "NT",
    label: "Northern Territory",
    source: "MyFuel NT",
    cadence: "Varies",
    detail:
      "Retailers self-report through the MyFuel NT portal. Cadence depends on the retailer; most update within a few hours of a change.",
  },
  {
    code: "TAS",
    label: "Tasmania",
    source: "FuelCheck TAS",
    cadence: "Varies",
    detail:
      "Similar self-report model to NT. Updates are generally prompt but not legally enforced on a fixed cadence.",
  },
  {
    code: "SA / VIC / ACT",
    label: "South Australia, Victoria, ACT",
    source: "No unified public feed",
    cadence: "Not covered",
    detail:
      "These states either don't run a public price-reporting scheme or expose one we can aggregate yet. The map will be empty through these regions — we'd rather show nothing than show stale guesses.",
  },
];

export default function DataFreshnessPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Sticky header with back navigation */}
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <a
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </a>
        <h1 className="font-bold text-lg">How fresh is this price?</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Intro */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            The timestamp on each pin is the only number that matters.
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Click any station to see exactly when its price was last reported
            (e.g. &quot;Updated 3h ago&quot;). Freshness varies by state because
            each state runs a different reporting scheme. Below is what each
            feed promises and what that means in practice.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mt-2">
            The footer shortcut &quot;updated daily&quot; was an
            oversimplification and has been replaced with this page.
          </p>
        </section>

        {/* Per-state table */}
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">State</th>
                <th className="text-left px-3 py-2">Feed</th>
                <th className="text-left px-3 py-2">Cadence</th>
              </tr>
            </thead>
            <tbody>
              {STATES.map((s) => (
                <tr key={s.code} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">
                    {s.code}
                    <div className="text-xs font-normal text-gray-500">
                      {s.label}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{s.source}</td>
                  <td className="px-3 py-2 text-gray-700">
                    <div className="font-medium">{s.cadence}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {s.detail}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Coverage caveat */}
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900 mb-1">
            Why some regions show as empty
          </h2>
          <p className="text-xs text-amber-900 leading-relaxed">
            SA, VIC and ACT don&apos;t publish a feed we can plug into yet.
            Rather than fake it with guesses or out-of-date data, the map shows
            no pins through these regions. If you plan a trip that passes
            through them, the Trip Planner will warn you before routing.
          </p>
        </section>

        <section className="text-xs text-gray-600 leading-relaxed">
          <p>
            Sources:{" "}
            <a
              href="https://www.fuelcheck.nsw.gov.au"
              className="underline text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              FuelCheck NSW
            </a>
            ,{" "}
            <a
              href="https://www.qld.gov.au/transport/projects/fuel-price-reporting"
              className="underline text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              QLD Fuel Price Reporting
            </a>
            ,{" "}
            <a
              href="https://www.fuelwatch.wa.gov.au"
              className="underline text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              FuelWatch WA
            </a>
            ,{" "}
            <a
              href="https://myfuelnt.nt.gov.au"
              className="underline text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              MyFuel NT
            </a>
            , FuelCheck TAS.
          </p>
        </section>
      </div>
    </div>
  );
}
