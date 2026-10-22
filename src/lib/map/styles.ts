export type TrackingStyle = "streets" | "satellite";
// Overzoom existing imagery rather than requesting unavailable high-resolution tiles.
export const SATELLITE_NATIVE_ZOOM = 17;
export function trackingStyle(preset: TrackingStyle, mapbox: boolean): string | Record<string, unknown> {
  if (mapbox) return preset === "satellite" ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/streets-v12";
  if (preset === "streets") return "https://tiles.openfreemap.org/styles/liberty";
  return {
    version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { imagery: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, minzoom: 0, maxzoom: SATELLITE_NATIVE_ZOOM, attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community" } },
    layers: [{ id: "imagery", type: "raster", source: "imagery", paint: { "raster-resampling": "linear", "raster-fade-duration": 150 } }],
  };
}
const scripts = new Map<string, Promise<any>>();
export function loadMapEngine(mapbox: boolean): Promise<any> {
  const key = mapbox ? "mapboxgl" : "maplibregl";
  if ((window as any)[key]) return Promise.resolve((window as any)[key]);
  if (scripts.has(key)) return scripts.get(key)!;
  const base = mapbox ? "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl" : "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl";
  if (!document.getElementById("tracking-css-" + key)) { const css = document.createElement("link"); css.id = "tracking-css-" + key; css.rel = "stylesheet"; css.href = base + ".css"; document.head.appendChild(css); }
  const promise = new Promise<any>((resolve, reject) => {
    const script = document.createElement("script"); script.src = base + ".js"; script.async = true;
    const timer = window.setTimeout(() => { script.remove(); scripts.delete(key); reject(new Error("Koneksi peta terlalu lama.")); }, 20000);
    script.onload = () => { clearTimeout(timer); const gl = (window as any)[key]; if (gl) resolve(gl); else { scripts.delete(key); reject(new Error("Mesin peta belum tersedia.")); } };
    script.onerror = () => { clearTimeout(timer); script.remove(); scripts.delete(key); reject(new Error("Peta belum dapat dimuat. Periksa koneksi.")); };
    document.head.appendChild(script);
  });
  scripts.set(key, promise); return promise;
}
