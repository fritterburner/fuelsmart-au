import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Live map" },
  { href: "/trends", label: "National trends" },
  { href: "/trip", label: "Trip planner" },
  { href: "/history", label: "Price history & forecast" },
  { href: "/discounts", label: "Discounts & loyalty" },
];

/**
 * Shared "more on FuelSmart" internal-link strip for the SEO landing pages —
 * keeps crawlers and readers a click away from the rest of the app.
 */
export default function SeoFooterLinks({ current }: { current?: string }) {
  return (
    <nav aria-label="More on FuelSmart" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {LINKS.filter((l) => l.href !== current).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 font-medium"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
