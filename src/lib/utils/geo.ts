/**
 * Geo helpers for live technician tracking
 */

export interface LatLng {
  lat: number;
  lng: number;
}

function valid(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Extract coordinates from a Google Maps / OSM URL or a raw "lat,lng" string.
 */
export function parseCoordinates(input?: string | null): LatLng | null {
  if (!input) return null;
  const text = decodeURIComponent(input.trim());

  const patterns: RegExp[] = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // Google place data
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // Google @lat,lng
    /[?&](?:q|query|ll|destination|daddr|saddr|center)=(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/i, // query params
    /\/dir\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i, // Google Maps /dir/lat,lng
    /\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i, // Google Maps /place/lat,lng
    /[?&]mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/i, // OpenStreetMap
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/, // raw "lat, lng"
    /(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/, // loose lat,lng match inside text
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

// In-memory cache for resolved short URLs
const urlCoordCache = new Map<string, LatLng | null>();

/**
 * Asynchronously resolve coordinates, including following short links
 * like maps.app.goo.gl or goo.gl/maps
 */
export async function resolveCoordinatesAsync(input?: string | null): Promise<LatLng | null> {
  if (!input) return null;
  const direct = parseCoordinates(input);
  if (direct) return direct;

  const text = input.trim();
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return null;

  const url = urlMatch[0];
  if (urlCoordCache.has(url)) {
    return urlCoordCache.get(url) || null;
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(3500),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const finalUrl = res.url;
    let coords = parseCoordinates(finalUrl);

    if (!coords) {
      // Sometimes coordinates are inside the HTML meta tags or canonical URL
      const html = await res.text().catch(() => "");
      coords = parseCoordinates(html);
    }

    urlCoordCache.set(url, coords);
    return coords;
  } catch {
    urlCoordCache.set(url, null);
    return null;
  }
}

/**
 * 12 Vibrant distinct colors for technician routes & markers
 */
export const TECHNICIAN_PALETTE = [
  "#2563eb", // Royal Blue
  "#059669", // Emerald Green
  "#7c3aed", // Vivid Violet
  "#d97706", // Amber
  "#db2777", // Pink / Rose
  "#0891b2", // Cyan / Teal
  "#ea580c", // Deep Orange
  "#4f46e5", // Indigo
  "#16a34a", // Forest Green
  "#9333ea", // Purple
  "#0284c7", // Sky Blue
  "#dc2626", // Crimson Red
];

export function getTechnicianColor(userId?: string | null): string {
  if (!userId) return TECHNICIAN_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TECHNICIAN_PALETTE.length;
  return TECHNICIAN_PALETTE[index];
}

/**
 * Great-circle distance in meters (Haversine)
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** A technician is considered online if the last GPS ping is within this window */
export const LOCATION_STALE_MS = 3 * 60 * 1000;

