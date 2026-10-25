import { NETWORK_COLORS, type LngLat } from "./topology";
import { SATELLITE_NATIVE_ZOOM, type TrackingStyle } from "./styles";

/** Bundled 2D fallback for blocked CDN, unavailable WebGL, or a stalled vector style. */
export async function createRasterMap(container: HTMLElement, style: TrackingStyle, onSelect: (kind: "network" | "ticket", id: string) => void, onReady: () => void, onError: (message: string) => void) {
  const module = await import("leaflet");
  const L = module.default || module;
  const raw = L.map(container, { zoomControl: false, minZoom: 3, maxZoom: 22, preferCanvas: true }).setView([-6.76, 110.857], 12);
  L.control.zoom({ position: "bottomright" }).addTo(raw);
  raw.attributionControl.setPrefix(false);
  const features = L.layerGroup().addTo(raw);
  let base: import("leaflet").GridLayer;
  let lastState: any;
  let tileCount = 0;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const applyStyle = (preset: TrackingStyle) => {
    if (base) raw.removeLayer(base);
    raw.setMaxZoom(preset === "satellite" ? 19 : 22);
    clearTimeout(deadline); tileCount = 0;
    base = preset === "satellite" && (window as any).createHelpdeskSatelliteLayer ? (window as any).createHelpdeskSatelliteLayer(L) : L.tileLayer(preset === "satellite"
      ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false"
      : "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 3, maxZoom: 22, maxNativeZoom: preset === "satellite" ? SATELLITE_NATIVE_ZOOM : 19,
      attribution: preset === "satellite" ? "Imagery © Esri, Maxar, Earthstar Geographics" : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      keepBuffer: 2, updateWhenIdle: true, crossOrigin: true,
    });
    base.on("tileload", () => { tileCount++; clearTimeout(deadline); onReady(); });
    deadline = setTimeout(() => { if (!tileCount) onError("Gambar peta belum tersedia. Periksa koneksi atau ganti mode Peta / Satelit."); }, 15000);
    base.addTo(raw);
    // Data overlays belong to their own group; changing imagery never removes them.
    if (lastState) render(lastState, true);
  };
  const render = (state: any, force = false) => {
    if (!force && lastState && ["geo", "ticketGeo", "routeGeo", "visibleKinds", "showCables", "showTickets", "highlighted"].every(key => lastState[key] === state[key])) return;
    lastState = state; features.clearLayers();
    const latLng = (point: LngLat): [number, number] => [point[1], point[0]];
    const label = (text: string) => { const element = document.createElement("span"); element.textContent = text; return element; };
    if (state.showCables) for (const line of state.geo.lines.features) {
      const p = line.properties;
      if (!state.visibleKinds.includes(p.kind)) continue;
      const selected = state.highlighted.has(p.id);
      L.polyline(line.geometry.coordinates.map(latLng), { color: selected ? "#4563ff" : NETWORK_COLORS[p.kind as keyof typeof NETWORK_COLORS], weight: selected ? 5 : 2, opacity: .8, dashArray: p.traced ? undefined : "5 6", interactive: false }).addTo(features);
    }
    for (const point of state.geo.points.features) {
      const p = point.properties; if (!state.visibleKinds.includes(p.kind)) continue;
      const dot = L.circleMarker(latLng(point.geometry.coordinates), { radius: p.kind === "customer" ? 4 : 6, color: "#fff", weight: 1.5, fillColor: NETWORK_COLORS[p.kind as keyof typeof NETWORK_COLORS], fillOpacity: 1 }).addTo(features);
      dot.on("click", event => { L.DomEvent.stopPropagation(event.originalEvent); onSelect("network", p.id); });
      if (raw.getZoom() >= (p.kind === "customer" ? 17 : 14.5)) dot.bindTooltip(label(p.name), { direction: "top" });
    }
    if (state.showTickets) for (const point of state.ticketGeo.features) {
      const p = point.properties;
      L.circleMarker(latLng(point.geometry.coordinates), { radius: 8, color: "#fff", weight: 3, fillColor: p.urgent ? "#ef4444" : "#4563ff", fillOpacity: 1 })
        .bindTooltip(label("#" + p.number), { permanent: true, direction: "top" }).on("click", () => onSelect("ticket", p.id)).addTo(features);
    }
    for (const line of state.routeGeo.features) L.polyline(line.geometry.coordinates.map(latLng), { color: "#4563ff", weight: line.properties.road ? 6 : 3, dashArray: line.properties.road ? undefined : "6 7", interactive: false }).addTo(features);
  };
  raw.on("zoomend", () => { if (lastState) render(lastState, true); });
  const adapter = {
    __raster: true, render, resize: () => raw.invalidateSize(),
    getZoom: () => raw.getZoom(),
    easeTo: ({ center, zoom }: any) => raw.flyTo([center[1], center[0]], zoom, { duration: .5 }),
    fitBounds: (bounds: any, options: any) => raw.fitBounds(bounds.raw, { maxZoom: options.maxZoom, paddingTopLeft: [options.padding.left, options.padding.top], paddingBottomRight: [options.padding.right, options.padding.bottom], animate: false }),
    setStyle: applyStyle,
    remove: () => { clearTimeout(deadline); raw.remove(); },
  };
  class Bounds {
    raw: import("leaflet").LatLngBounds;
    constructor(a: LngLat, b: LngLat) { this.raw = L.latLngBounds([a[1], a[0]], [b[1], b[0]]); }
    extend(point: LngLat) { this.raw.extend([point[1], point[0]]); return this; }
  }
  class Marker {
    element: HTMLElement; point: LngLat = [0, 0]; marker?: import("leaflet").Marker;
    constructor({ element }: { element: HTMLElement }) { this.element = element; }
    setLngLat(point: LngLat) { this.point = point; this.marker?.setLatLng([point[1], point[0]]); return this; }
    addTo() { this.marker = L.marker([this.point[1], this.point[0]], { icon: L.divIcon({ html: this.element, className: "tracking-marker-shell", iconSize: [38, 38], iconAnchor: [19, 19] }), keyboard: false }).addTo(raw); return this; }
    getLngLat() { return { lng: this.point[0], lat: this.point[1] }; }
    getElement() { return this.element; }
    remove() { this.marker?.remove(); }
  }
  applyStyle(style);
  return { instance: adapter, library: { Marker, LngLatBounds: Bounds } };
}
