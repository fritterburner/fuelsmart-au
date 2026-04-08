"use client";

import { useState } from "react";

interface Props {
  onSelect: (lat: number, lng: number) => void;
}

export default function LocationSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Australia")}&format=json&limit=5&addressdetails=1`
    );
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
    <div className="relative">
      <div className="flex gap-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search suburb or postcode..."
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {searching && (
          <span className="self-center text-xs text-gray-300">Searching...</span>
        )}
      </div>
      {results.length > 0 && (
        <ul className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[1001] w-96 max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800 border-b border-gray-100 last:border-0"
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
