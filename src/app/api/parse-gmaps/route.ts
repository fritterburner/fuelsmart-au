import { NextRequest, NextResponse } from "next/server";

interface ParsedRoute {
  waypoints: { label: string; lat?: number; lng?: number }[];
}

// Follow redirects manually to get the final URL from shortened Google Maps links
async function resolveUrl(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < 10; i++) {
    const resp = await fetch(current, { redirect: "manual" });
    const location = resp.headers.get("location");
    if (!location) return current;
    current = location.startsWith("http") ? location : new URL(location, current).href;
  }
  return current;
}

// Try to parse a lat,lng pair from a string
function parseCoords(s: string): { lat: number; lng: number } | null {
  const m = s.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseGoogleMapsUrl(url: string): ParsedRoute {
  const waypoints: ParsedRoute["waypoints"] = [];

  // Format 1: /maps/dir/Place1/Place2/Place3/...
  const dirMatch = url.match(/\/maps\/dir\/(.+?)(?:\/(@|data=)|$|\?)/);
  if (dirMatch) {
    const parts = dirMatch[1]
      .split("/")
      .map((p) => decodeURIComponent(p).trim())
      .filter((p) => p && !p.startsWith("@") && !p.startsWith("data="));

    for (const part of parts) {
      const coords = parseCoords(part);
      if (coords) {
        waypoints.push({ label: `${coords.lat}, ${coords.lng}`, ...coords });
      } else {
        waypoints.push({ label: part.replace(/\+/g, " ") });
      }
    }
    return { waypoints };
  }

  // Format 2: /maps/?api=1&origin=...&destination=...&waypoints=...
  try {
    const parsed = new URL(url);
    const origin = parsed.searchParams.get("origin");
    const destination = parsed.searchParams.get("destination");
    const via = parsed.searchParams.get("waypoints");

    if (origin) {
      const coords = parseCoords(origin);
      waypoints.push(coords ? { label: origin, ...coords } : { label: origin });
    }
    if (via) {
      for (const w of via.split("|")) {
        const trimmed = w.trim();
        const coords = parseCoords(trimmed);
        waypoints.push(coords ? { label: trimmed, ...coords } : { label: trimmed });
      }
    }
    if (destination) {
      const coords = parseCoords(destination);
      waypoints.push(coords ? { label: destination, ...coords } : { label: destination });
    }
    if (waypoints.length > 0) return { waypoints };
  } catch { /* not a valid URL for this format */ }

  // Format 3: /maps/@lat,lng,zoom — single point
  const atMatch = url.match(/\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    waypoints.push({ label: `${lat}, ${lng}`, lat, lng });
    return { waypoints };
  }

  // Format 4: /maps/place/Name/@lat,lng
  const placeMatch = url.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch) {
    const name = decodeURIComponent(placeMatch[1]).replace(/\+/g, " ");
    const placeCoords = url.match(/\/place\/[^/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (placeCoords) {
      waypoints.push({ label: name, lat: Number(placeCoords[1]), lng: Number(placeCoords[2]) });
    } else {
      waypoints.push({ label: name });
    }
    return { waypoints };
  }

  return { waypoints };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    // Resolve shortened URLs
    let finalUrl = url;
    if (url.includes("goo.gl") || url.includes("maps.app")) {
      finalUrl = await resolveUrl(url);
    }

    const result = parseGoogleMapsUrl(finalUrl);

    if (result.waypoints.length === 0) {
      return NextResponse.json(
        { error: "Could not parse waypoints from this Google Maps URL" },
        { status: 400 }
      );
    }

    // Geocode any waypoints that don't have coordinates
    const resolved = await Promise.all(
      result.waypoints.map(async (wp) => {
        if (wp.lat !== undefined && wp.lng !== undefined) return wp;
        // Use Nominatim to geocode the place name
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(wp.label + " Australia")}&format=json&limit=1&addressdetails=1`,
            { headers: { "User-Agent": "FuelSmartAU/1.0" } }
          );
          const data = await resp.json();
          if (data.length > 0) {
            return { ...wp, lat: Number(data[0].lat), lng: Number(data[0].lon), label: wp.label };
          }
        } catch { /* geocode failed, return without coords */ }
        return wp;
      })
    );

    return NextResponse.json({ waypoints: resolved, resolvedUrl: finalUrl });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse Google Maps URL" },
      { status: 500 }
    );
  }
}
