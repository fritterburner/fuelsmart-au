"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  onSelect: (lat: number, lng: number) => void;
}

export default function LocationSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = await resp.json();
    setResults(data);
    setSearching(false);
  }

  // Format result to show state context: "Katherine, NT" not just "Katherine"
  function formatResult(r: any): string {
    const parts: string[] = [];
    const name = r.display_name.split(",")[0].trim();
    parts.push(name);

    // Extract state from address details if available
    if (r.address) {
      if (r.address.suburb && r.address.suburb !== name) parts.push(r.address.suburb);
      if (r.address.state) {
        const stateAbbrev: Record<string, string> = {
          "Northern Territory": "NT",
          "Queensland": "QLD",
          "Western Australia": "WA",
          "New South Wales": "NSW",
          "Victoria": "VIC",
          "South Australia": "SA",
          "Tasmania": "TAS",
          "Australian Capital Territory": "ACT",
        };
        parts.push(stateAbbrev[r.address.state] || r.address.state);
      }
      if (r.address.postcode) parts.push(r.address.postcode);
    }

    return parts.join(", ");
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex gap-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search suburb or postcode..."
          className="flex-1 min-h-[44px] px-3 py-2 rounded-l-lg border border-slate-600 bg-slate-700 text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:outline-none"
        />
        <button
          onClick={search}
          disabled={searching}
          className="min-w-[44px] min-h-[44px] px-3 rounded-r-lg bg-emerald-600 active:bg-emerald-700 md:hover:bg-emerald-700 text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center"
          aria-label="Search"
        >
          {searching ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[1001] w-full md:max-w-md max-h-[50vh] md:max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              className="min-h-[44px] px-3 py-2.5 hover:bg-blue-50 active:bg-blue-100 cursor-pointer text-sm text-gray-800 border-b border-gray-100 last:border-0 flex flex-col justify-center"
              onClick={() => {
                onSelect(Number(r.lat), Number(r.lon));
                setResults([]);
                setQuery(formatResult(r));
              }}
            >
              <div className="font-medium">{(r as any).display_name.split(",")[0]}</div>
              <div className="text-xs text-gray-500 truncate">{(r as any).display_name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
