"use client";

import { useState } from "react";

interface Props {
  onSelect: (lat: number, lng: number) => void;
}

export default function LocationSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);

  async function search() {
    if (!query.trim()) return;
    // Use Nominatim (OSM geocoding) — free, no key needed
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Australia")}&format=json&limit=5`
    );
    const data = await resp.json();
    setResults(data);
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
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      {results.length > 0 && (
        <ul className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[1001] w-80 max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
              onClick={() => {
                onSelect(Number(r.lat), Number(r.lon));
                setResults([]);
                setQuery(r.display_name.split(",")[0]);
              }}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
