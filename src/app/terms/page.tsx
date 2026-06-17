import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — FuelSmart AU",
  description: "Terms of use for FuelSmart AU, and where the fuel-price data comes from.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <h1 className="font-bold text-lg">Terms of use</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">The short version</h2>
          <p>
            FuelSmart AU is a free tool for comparing fuel prices across Australia.
            It&apos;s provided as-is, with no warranty. Prices are a guide — always
            check the price at the pump, which is the only one that counts.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Where the data comes from</h2>
          <p>
            Prices come straight from each state&apos;s official fuel-price feed —
            FuelCheck NSW (which also covers the ACT), FuelWatch WA, MyFuel NT, the
            Queensland Fuel Price Reporting scheme, FuelCheck TAS, and (as they come
            online) Victoria&apos;s Servo Saver and South Australia&apos;s Fuel
            Pricing Information Scheme. That data remains the property of the
            respective agencies. How fresh each feed is varies by state — see{" "}
            <Link href="/data-freshness" className="underline text-blue-700">
              how each state&apos;s data works
            </Link>
            . Region definitions are derived from Australian Bureau of Statistics
            data (© ABS, CC BY 4.0).
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Accuracy &amp; your decisions</h2>
          <p>
            We don&apos;t guarantee prices are current, complete, or error-free —
            retailers report on their own schedules and feeds can lag or glitch.
            After-discount prices and savings are <strong>estimates</strong> based on
            the discounts you enter, and the 7-day outlook is a{" "}
            <strong>forecast, not a promise</strong> — fuel prices are volatile.
            Nothing here is financial advice. Decisions you make using FuelSmart are
            your own.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Privacy</h2>
          <p>
            FuelSmart has no accounts and keeps your settings on your own device.
            See the{" "}
            <Link href="/privacy" className="underline text-blue-700">
              privacy page
            </Link>{" "}
            for the detail, including the one anonymous usage count we keep.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">No affiliation</h2>
          <p>
            FuelSmart AU is independent and not affiliated with, or endorsed by, any
            government agency or fuel retailer.
          </p>
        </section>
      </div>
    </div>
  );
}
