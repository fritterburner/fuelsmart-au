import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — FuelSmart AU",
  description:
    "What FuelSmart AU stores, what it doesn't, and the one pseudonymous usage count we keep.",
};

export default function PrivacyPage() {
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
        <h1 className="font-bold text-lg">Privacy</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 text-sm text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            FuelSmart is built to know as little about you as possible.
          </h2>
          <p>
            There are no accounts and no logins. Your settings — fuel type, tank
            size, saved discounts, home location — live in your own browser
            storage on your device. We don&apos;t upload them, and we don&apos;t
            sell anything: there are no ads and no trackers.
          </p>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
          <h2 className="text-base font-bold text-gray-900 mb-2">
            The one thing we count
          </h2>
          <p>
            We keep a simple, anonymous tally of how many people use the app —
            new visitors, returning visitors, and how many are active each month,
            broken down only by country. Several state fuel-data licences require
            us to be able to report these aggregate numbers.
          </p>
          <p className="mt-2">To do that, the app stores:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              a <strong>random ID</strong> in your browser (e.g.{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">a1b2c3…</code>) —
              it isn&apos;t tied to your name, email, or any account, and exists
              only so we can tell a returning device from a new one;
            </li>
            <li>
              a once-a-day &quot;still here&quot; ping carrying just that ID.
            </li>
          </ul>
          <p className="mt-2">
            On our side we store only the random ID, the month, and a coarse
            country label worked out from your connection at the moment of the
            ping. <strong>We never store your IP address</strong>, precise
            location, or browsing activity, and the numbers we can produce are
            counts only — never anything that points back to you.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Turning it off
          </h2>
          <p>
            Clearing your browser storage for this site removes the random ID and
            all saved settings. Private/incognito windows aren&apos;t counted
            across days, and if storage is blocked the ping simply never fires.
          </p>
        </section>

        <section className="text-xs text-gray-500">
          <p>
            Fuel prices are sourced from state government schemes and remain the
            property of those agencies. Questions:{" "}
            <Link href="/data-freshness" className="underline text-blue-700">
              see how each state&apos;s data works
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
