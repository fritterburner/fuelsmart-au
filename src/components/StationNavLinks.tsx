"use client";

interface Props {
  lat: number;
  lng: number;
  name?: string;
}

export default function StationNavLinks({ lat, lng, name }: Props) {
  const label = name ? encodeURIComponent(name) : "";
  return (
    <div
      className="flex gap-3 mt-2 text-xs"
      aria-label="Navigate to this station"
    >
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${label ? `&destination_place_id=` : ""}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-blue-600 hover:text-blue-800"
      >
        Google Maps
      </a>
      <a
        href={`http://maps.apple.com/?daddr=${lat},${lng}${label ? `&q=${label}` : ""}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-blue-600 hover:text-blue-800"
      >
        Apple Maps
      </a>
      <a
        href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-blue-600 hover:text-blue-800"
      >
        Waze
      </a>
    </div>
  );
}
