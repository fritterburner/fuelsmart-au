"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    suburb?: string;
    state?: string;
    postcode?: string;
  };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (lat: number, lng: number, label: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Show a green tick when coordinates have been confirmed */
  confirmed?: boolean;
}

function formatResult(r: GeoResult): string {
  const parts: string[] = [];
  const name = r.display_name.split(",")[0].trim();
  parts.push(name);

  if (r.address) {
    if (r.address.suburb && r.address.suburb !== name) parts.push(r.address.suburb);
    if (r.address.state) {
      const abbrev: Record<string, string> = {
        "Northern Territory": "NT",
        "Queensland": "QLD",
        "Western Australia": "WA",
        "New South Wales": "NSW",
        "Victoria": "VIC",
        "South Australia": "SA",
        "Tasmania": "TAS",
        "Australian Capital Territory": "ACT",
      };
      parts.push(abbrev[r.address.state] || r.address.state);
    }
    if (r.address.postcode) parts.push(r.address.postcode);
  }

  return parts.join(", ");
}

export default function LocationInput({
  value,
  onChange,
  onSelect,
  placeholder = "Search location...",
  required = false,
  confirmed = false,
}: Props) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — fires 400ms after user stops typing
  const search = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await resp.json();
      setResults(data);
      setShowDropdown(data.length > 0);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, []);

  function handleChange(newValue: string) {
    onChange(newValue);
    // Clear any pending search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Debounce the search
    debounceRef.current = setTimeout(() => search(newValue), 400);
  }

  function handleSelect(r: GeoResult) {
    const label = formatResult(r);
    onChange(label);
    onSelect(Number(r.lat), Number(r.lon), label);
    setResults([]);
    setShowDropdown(false);
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className={`w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base pr-10 ${
            confirmed ? "border-emerald-400 bg-emerald-50/50" : ""
          }`}
          required={required}
        />
        {/* Status indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {searching && (
            <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {!searching && confirmed && (
            <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>

      {/* Results dropdown */}
      {showDropdown && results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-[40vh] overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={i}
              className="px-3 py-2.5 min-h-[44px] flex flex-col justify-center hover:bg-blue-50 active:bg-blue-100 cursor-pointer text-sm text-gray-800 border-b border-gray-100 last:border-0"
              onClick={() => handleSelect(r)}
            >
              <div className="font-medium">{r.display_name.split(",")[0]}</div>
              <div className="text-xs text-gray-500 truncate">{formatResult(r)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
