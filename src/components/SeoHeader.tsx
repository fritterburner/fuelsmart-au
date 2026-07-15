import Link from "next/link";

/**
 * Shared sticky header for the server-rendered SEO pages (/trends,
 * /prices/[state], /station/[id]) — matches the sticky slate header markup
 * used by /history, /discounts and /compare, just factored out since three
 * new pages share it verbatim.
 */
export default function SeoHeader({ title, backHref = "/" }: { title: string; backHref?: string }) {
  return (
    <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
      <Link
        href={backHref}
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
      <h1 className="font-bold text-lg truncate">{title}</h1>
    </div>
  );
}
