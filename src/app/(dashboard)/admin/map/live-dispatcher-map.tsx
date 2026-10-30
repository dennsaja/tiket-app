"use client";
import { assetUrl } from "@/lib/network/origins";
import { apiFetch } from "@/lib/network/client";

import * as React from "react";
import { Search, Layers, LocateFixed, RefreshCw, X, Upload, MapPin, Navigation, ChevronRight, ExternalLink, Loader2, Cable, Users } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import { formatRelativeTime } from "@/lib/utils";
import { distanceMeters, formatDistance, LOCATION_STALE_MS } from "@/lib/utils/geo";
import { emptyTopology, NETWORK_COLORS, NETWORK_LABELS, topologyGeoJson, upstreamLinks, validPosition, type LngLat, type NetworkKind, type TopologySnapshot } from "@/lib/map/topology";
import { type TrackingStyle } from "@/lib/map/styles";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";

interface TechnicianItem {
  userId: string; name: string; latitude: number | null; longitude: number | null;
  accuracy?: number | null; isTracking?: boolean | null; activeTicketId?: string | null; updatedAt?: string | null;
}
interface TicketItem { id: string; ticketNumber: number; title: string; status: string; priority: string; latitude: number | null; longitude: number | null }
interface RoadRoute { coordinates: LngLat[]; distance: number; duration?: number; road: boolean }
type Selection = { kind: "technician" | "network" | "ticket"; id: string } | null;
const ALL_KINDS: NetworkKind[] = ["server", "router", "odp", "customer"];
const EMPTY_GEO = { type: "FeatureCollection", features: [] };
const coordinatesOf = (item: { latitude: number | null; longitude: number | null }): LngLat | null => validPosition([item.longitude, item.latitude]) ? [item.longitude!, item.latitude!] : null;
const fresh = (tech: TechnicianItem, now: number) => Boolean(tech.isTracking && tech.updatedAt && now - Date.parse(tech.updatedAt) >= -60000 && now - Date.parse(tech.updatedAt) < LOCATION_STALE_MS && coordinatesOf(tech));

export function LiveDispatcherMap() {
  const container = React.useRef<HTMLDivElement>(null), map = React.useRef<any>(null), library = React.useRef<any>(null);
  const markers = React.useRef(new Map<string, any>()), fileInput = React.useRef<HTMLInputElement>(null), firstFit = React.useRef(false);
  const [topology, setTopology] = React.useState<TopologySnapshot>(emptyTopology);
  const [technicians, setTechnicians] = React.useState<TechnicianItem[]>([]), [tickets, setTickets] = React.useState<TicketItem[]>([]);
  const [selection, setSelection] = React.useState<Selection>(null), [style, setStyle] = React.useState<TrackingStyle>("streets");
  const [visibleKinds, setVisibleKinds] = React.useState<NetworkKind[]>(ALL_KINDS);
  const [showCables, setShowCables] = React.useState(true), [showTickets, setShowTickets] = React.useState(true);
  const [layersOpen, setLayersOpen] = React.useState(false), [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"team" | "network">("team"), [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true), [importing, setImporting] = React.useState(false);
  const [dataError, setDataError] = React.useState(""), [mapError, setMapError] = React.useState("");
  const [ready, setReady] = React.useState(false), [mapRevision, setMapRevision] = React.useState(0);
  const [route, setRoute] = React.useState<RoadRoute | null>(null), [now, setNow] = React.useState(Date.now);
  const request = React.useRef<AbortController | null>(null), topologyRequest = React.useRef<AbortController | null>(null);
  const routeCache = React.useRef<{ key: string; origin: LngLat; route: RoadRoute; time: number } | null>(null);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const loadLocations = React.useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    try {
      const response = await apiFetch("/api/technicians/location", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "Peta tracking khusus NOC, admin, dan owner." : "Lokasi tim belum dapat diperbarui.");
      const payload = await response.json(); setTechnicians(payload.technicians || []); setTickets(payload.tickets || []); setDataError("");
    } catch (error: any) { if (error.name !== "AbortError") setDataError(error.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  const loadTopology = React.useCallback(async () => {
    topologyRequest.current?.abort(); const controller = new AbortController(); topologyRequest.current = controller;
    try {
      const response = await apiFetch("/api/admin/map/topology", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Topologi belum dapat dimuat. Periksa koneksi atau akses akun.");
      setTopology(await response.json());
    } catch (error: any) { if (error.name !== "AbortError") toast.error(error.message); }
  }, []);
  React.useEffect(() => {
    loadLocations(); loadTopology();
    const timer = window.setInterval(() => { if (!document.hidden) loadLocations(); }, 60000);
    return () => { clearInterval(timer); request.current?.abort(); topologyRequest.current?.abort(); };
  }, [loadLocations, loadTopology]);
  const techniciansRef = React.useRef(technicians); techniciansRef.current = technicians;
  const { connected } = useSSE("/api/sse", { onEvent: event => {
    if (event.type === "location" && event.data?.userId) {
      if (!techniciansRef.current.some(tech => tech.userId === event.data.userId)) { loadLocations(); return; }
      setTechnicians(previous => previous.map(tech => tech.userId === event.data.userId ? { ...tech, ...event.data } : tech)); setNow(Date.now());
    } else if (event.type === "system_event") loadLocations();
  } });
  const geo = React.useMemo(() => topologyGeoJson(topology), [topology]);
  const selectedTech = selection?.kind === "technician" ? technicians.find(tech => tech.userId === selection.id) : null;
  const selectedNode = selection?.kind === "network" ? topology.nodes.find(node => node.id === selection.id) : null;
  const selectedTicket = selection?.kind === "ticket" ? tickets.find(ticket => ticket.id === selection.id) : null;
  const destination = selectedTech?.activeTicketId ? tickets.find(ticket => ticket.id === selectedTech.activeTicketId) : null;
  const highlighted = React.useMemo(() => selection?.kind === "network" ? upstreamLinks(topology, selection.id) : new Set<string>(), [topology, selection]);
  const routeGeo = React.useMemo(() => route ? { type: "FeatureCollection", features: [{ type: "Feature", properties: { road: route.road }, geometry: { type: "LineString", coordinates: route.coordinates } }] } : EMPTY_GEO, [route]);
  const ticketGeo = React.useMemo(() => ({ type: "FeatureCollection", features: tickets.flatMap(ticket => { const point = coordinatesOf(ticket); return point ? [{ type: "Feature", id: ticket.id, properties: { id: ticket.id, number: ticket.ticketNumber, urgent: ["critical", "high"].includes(ticket.priority) }, geometry: { type: "Point", coordinates: point } }] : []; }) }), [tickets]);
  const view = React.useRef<any>(null);
  view.current = { geo, ticketGeo, routeGeo, visibleKinds, showCables, showTickets, highlighted };
  const syncLayers = React.useCallback(() => { map.current?.render(view.current); }, []);
  const appliedStyle = React.useRef("");
  const styleRef = React.useRef(style); styleRef.current = style;
  React.useEffect(() => {
    let disposed = false; let instance: any; let resize: ResizeObserver | undefined;
    setReady(false); setMapError(""); firstFit.current = false;
    async function start() {
      try {
        if (!(window as any).createHelpdeskSatelliteLayer) await new Promise<void>(resolve => {
          const timer = window.setTimeout(resolve, 5000);
          const complete = () => { clearTimeout(timer); resolve(); };
          const script = document.createElement("script"); script.src = assetUrl("/map/satellite.js"); script.onload = complete; script.onerror = complete; document.head.appendChild(script);
        });
        const { createRasterMap } = await import("@/lib/map/raster-engine");
        if (disposed || !container.current) return;
        const built = await createRasterMap(container.current, styleRef.current, (kind, id) => { setSelection({ kind, id }); setSidebarOpen(true); },
          () => { if (!disposed) { setReady(true); setMapError(""); } }, message => { if (!disposed) { setReady(true); setMapError(message); } });
        instance = built.instance;
        if (disposed) { instance.remove(); return; }
        map.current = instance; library.current = built.library; appliedStyle.current = styleRef.current;
        syncLayers(); resize = new ResizeObserver(() => instance.resize()); resize.observe(container.current);
      } catch (error) { if (!disposed) setMapError(error instanceof Error ? error.message : "Peta belum dapat dimuat"); }
    }
    start();
    return () => { disposed = true; resize?.disconnect(); markers.current.forEach(marker => marker.remove()); markers.current.clear(); if (map.current === instance) map.current = null; instance?.remove(); };
  }, [mapRevision, syncLayers]);
  React.useEffect(() => {
    if (!map.current || appliedStyle.current === style) return;
    appliedStyle.current = style; setMapError(""); map.current.setStyle(style); syncLayers();
  }, [style, syncLayers]);
  React.useEffect(() => { syncLayers(); }, [ready, geo, ticketGeo, routeGeo, visibleKinds, showCables, showTickets, highlighted, syncLayers]);
  const fitAll = React.useCallback(() => {
    const instance = map.current, gl = library.current; if (!instance || !gl) return;
    const positions = [...technicians.flatMap(tech => coordinatesOf(tech) ? [coordinatesOf(tech)!] : []), ...tickets.flatMap(ticket => showTickets && coordinatesOf(ticket) ? [coordinatesOf(ticket)!] : []), ...topology.nodes.filter(node => visibleKinds.includes(node.kind)).map(node => node.coordinates)];
    if (!positions.length) return;
    const bounds = positions.reduce((bounds, point) => bounds.extend(point), new gl.LngLatBounds(positions[0], positions[0]));
    instance.fitBounds(bounds, { padding: { top: 100, right: 55, bottom: 65, left: window.innerWidth >= 640 ? 345 : 45 }, maxZoom: 16, duration: 650 });
  }, [technicians, tickets, showTickets, topology, visibleKinds]);
  React.useEffect(() => { if (ready && !firstFit.current && (topology.nodes.length || technicians.some(tech => coordinatesOf(tech)) || tickets.some(ticket => coordinatesOf(ticket)))) { firstFit.current = true; fitAll(); } }, [ready, topology, technicians, tickets, fitAll]);
  const focus = React.useCallback((kind: "technician" | "network" | "ticket", id: string, position: LngLat | null) => {
    setSelection({ kind, id }); setSidebarOpen(true);
    if (position) map.current?.easeTo({ center: position, zoom: Math.max(16, Math.min(18, map.current.getZoom())), duration: 600 });
  }, []);
  const focusRef = React.useRef(focus); focusRef.current = focus;
  React.useEffect(() => {
    if (!ready || !map.current || !library.current) return;
    const active = new Set<string>();
    for (const tech of technicians) {
      const position = coordinatesOf(tech); if (!position) continue; active.add(tech.userId);
      let marker = markers.current.get(tech.userId);
      if (!marker) {
        const element = document.createElement("button"); element.type = "button"; element.className = "tracking-technician";
        const initials = document.createElement("span"); initials.className = "tracking-initials"; element.appendChild(initials);
        const label = document.createElement("span"); label.className = "tracking-name"; element.appendChild(label);
        element.onclick = event => { event.stopPropagation(); const current = markers.current.get(tech.userId)?.getLngLat(); focusRef.current("technician", tech.userId, current ? [current.lng, current.lat] : null); };
        marker = new library.current.Marker({ element, anchor: "center" }).setLngLat(position).addTo(map.current); markers.current.set(tech.userId, marker);
      }
      marker.setLngLat(position);
      const element = marker.getElement() as HTMLButtonElement;
      element.setAttribute("aria-label", tech.name + (fresh(tech, now) ? " · GPS terbaru" : " · Lokasi terakhir"));
      element.dataset.live = String(fresh(tech, now)); element.dataset.selected = String(selection?.kind === "technician" && selection.id === tech.userId);
      element.children[0].textContent = tech.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase(); element.children[1].textContent = tech.name.split(" ")[0];
    }
    markers.current.forEach((marker, id) => { if (!active.has(id)) { marker.remove(); markers.current.delete(id); } });
  }, [ready, technicians, selection, now]);
  const origin = selectedTech && fresh(selectedTech, now) ? coordinatesOf(selectedTech) : null;
  const target = destination ? coordinatesOf(destination) : null;
  const routeKey = selectedTech && destination && target ? JSON.stringify([selectedTech.userId, destination.id, target]) : "";
  const originLng = origin?.[0], originLat = origin?.[1];
  React.useEffect(() => {
    setRoute(null);
    if (!routeKey || originLng === undefined || originLat === undefined || !target) return;
    const start: LngLat = [originLng, originLat], cached = routeCache.current;
    if (cached?.key === routeKey && Date.now() - cached.time < 60000 && distanceMeters({ lat: start[1], lng: start[0] }, { lat: cached.origin[1], lng: cached.origin[0] }) < 50) { setRoute(cached.route); return; }
    setRoute({ coordinates: [start, target], distance: distanceMeters({ lat: start[1], lng: start[0] }, { lat: target[1], lng: target[0] }), road: false });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
          const response = await apiFetch(`https://router.project-osrm.org/route/v1/driving/${start.join(",")};${target.join(",")}?overview=full&geometries=geojson`, { signal: controller.signal });
          if (!response.ok) return;
          const result = (await response.json()).routes?.[0];
          if (!result || !Array.isArray(result.geometry?.coordinates) || result.geometry.coordinates.length < 2 || !result.geometry.coordinates.every(validPosition) || !Number.isFinite(result.distance) || !Number.isFinite(result.duration) || controller.signal.aborted) return;
          const road = { coordinates: result.geometry.coordinates, distance: result.distance, duration: result.duration, road: true };
          routeCache.current = { key: routeKey, origin: start, route: road, time: Date.now() }; setRoute(road);
        } finally { clearTimeout(timeout); }
      } catch { /* A labelled direction line remains when the road service is unavailable. */ }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  // The route key includes destination coordinates; only the selected technician requests road directions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, originLng, originLat]);
  async function importTopology(file: File) {
    setImporting(true);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await apiFetch("/api/admin/map/topology", { method: "POST", body: form });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Impor topologi gagal.");
      setTopology(payload); setSelection(null); setTab("network"); setSidebarOpen(true); firstFit.current = false;
      toast.success(`${payload.nodes.length} titik dan ${payload.links.length} jalur dimuat.`);
    } catch (error: any) { toast.error(error.message); }
    finally { setImporting(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  const normalized = query.trim().toLocaleLowerCase("id");
  const filteredTechs = technicians.filter(tech => tech.name.toLocaleLowerCase("id").includes(normalized));
  const filteredNodes = topology.nodes.filter(node => visibleKinds.includes(node.kind) && (node.name + " " + NETWORK_LABELS[node.kind]).toLocaleLowerCase("id").includes(normalized));
  const live = technicians.filter(tech => fresh(tech, now)).length;
  const selectedPosition = selectedNode?.coordinates || (selectedTech ? coordinatesOf(selectedTech) : selectedTicket ? coordinatesOf(selectedTicket) : null);
  const panel = "border border-white/10 bg-[#17171c]/95 text-[#f6f6f8] shadow-xl backdrop-blur-xl";
  const iconButton = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-200 transition hover:bg-white/10 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-400";
  const importButton = <button type="button" disabled={importing} onClick={() => fileInput.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4563ff] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Impor topology.db</button>;

  return <section aria-label="Peta tracking teknisi dan jaringan" style={{ height: "calc(100dvh - 180px)", minHeight: 560 }} className="tracking-map relative isolate overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[#15151a]">
    {/* SDK CSS sets position:relative; keep the canvas filling its parent regardless of stylesheet load order. */}
    <div ref={container} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />
    <input ref={fileInput} type="file" accept=".db,.sqlite,.sqlite3" className="hidden" aria-label="Database topologi" onChange={event => { const file = event.target.files?.[0]; if (file) importTopology(file); }} />
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-3 sm:inset-x-4 sm:top-4 sm:flex-nowrap">
      <div className={`pointer-events-auto flex w-full items-center justify-between gap-2 rounded-2xl p-1.5 sm:w-auto sm:justify-start ${panel}`}>
        <button type="button" aria-label="Cari teknisi atau titik jaringan" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(value => !value)} className={`${iconButton} sm:hidden`}><Search className="h-4 w-4" /></button>
        <div className="px-3 py-1"><p className="text-xs font-semibold">Tracking lapangan</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-400"><span className={`h-1.5 w-1.5 rounded-full ${connected && !dataError ? "bg-emerald-400" : "bg-amber-400"}`} />{live} GPS terbaru · {topology.nodes.length} titik jaringan</p></div>
        <button type="button" aria-label="Perbarui lokasi" onClick={() => { setLoading(true); loadLocations(); }} disabled={loading} className={iconButton}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
        <div className={`flex items-center rounded-2xl p-1 ${panel}`}>{(["streets", "satellite"] as const).map(preset => <button type="button" key={preset} aria-pressed={style === preset} onClick={() => setStyle(preset)} className={`h-10 rounded-xl px-3 text-xs font-semibold transition ${style === preset ? "bg-[#4563ff] text-white" : "text-zinc-400 hover:text-white"}`}>{preset === "streets" ? "Peta" : "Satelit"}</button>)}</div>
        <div className={`flex gap-1 rounded-2xl p-1 ${panel}`}><button type="button" aria-label="Pusatkan semua titik" title="Pusatkan semua titik" onClick={fitAll} disabled={!ready} className={iconButton}><LocateFixed className="h-4 w-4" /></button><button type="button" aria-label="Lapisan peta" aria-expanded={layersOpen} title="Lapisan peta" onClick={() => setLayersOpen(value => !value)} className={iconButton}><Layers className="h-4 w-4" /></button></div>
      </div>
    </div>
    {layersOpen && <aside aria-label="Lapisan peta" className={`absolute right-3 top-32 z-30 w-64 rounded-2xl p-4 sm:right-4 sm:top-20 ${panel}`}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Lapisan peta</h2><button aria-label="Tutup lapisan" onClick={() => setLayersOpen(false)}><X className="h-4 w-4 text-zinc-400" /></button></div>
      {ALL_KINDS.map(kind => <label key={kind} className="flex cursor-pointer items-center gap-2.5 py-2 text-xs"><input type="checkbox" className="accent-[#4563ff]" checked={visibleKinds.includes(kind)} onChange={event => setVisibleKinds(previous => event.target.checked ? [...previous, kind] : previous.filter(item => item !== kind))} /><span className="h-2 w-2 rounded-full" style={{ background: NETWORK_COLORS[kind] }} /><span className="flex-1">{NETWORK_LABELS[kind]}</span><span className="text-zinc-500">{topology.nodes.filter(node => node.kind === kind).length}</span></label>)}
      <div className="my-2 border-t border-white/10" /><label className="flex cursor-pointer items-center gap-2.5 py-2 text-xs"><input type="checkbox" checked={showCables} onChange={event => setShowCables(event.target.checked)} className="accent-[#4563ff]" />Jalur jaringan</label><label className="flex cursor-pointer items-center gap-2.5 py-2 text-xs"><input type="checkbox" checked={showTickets} onChange={event => setShowTickets(event.target.checked)} className="accent-[#4563ff]" />Tiket aktif</label>
      <p className="mb-4 mt-2 text-[10px] leading-relaxed text-zinc-500">Garis utuh: jalur kabel tersimpan.<br />Garis putus: hubungan antartitik.</p>{importButton}<p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Mengganti data topologi peta. Kredensial perangkat tidak disimpan.</p>
    </aside>}
    <aside aria-label="Daftar dan detail lokasi" className={`${sidebarOpen ? "flex" : "hidden"} absolute bottom-8 left-3 top-40 z-10 w-[300px] max-w-[calc(100%_-_24px)] flex-col overflow-hidden rounded-2xl sm:bottom-4 sm:left-4 sm:top-24 sm:flex ${panel}`}>
      <div className="shrink-0 p-4 pb-3"><div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search className="h-4 w-4 text-zinc-500" /><input aria-label="Cari nama teknisi atau titik" value={query} onChange={event => { setQuery(event.target.value); setSelection(null); }} placeholder={tab === "team" ? "Cari teknisi..." : "Cari pelanggan, ODP, router..."} className="h-10 w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500" /><button aria-label="Tutup daftar" onClick={() => setSidebarOpen(false)} className="sm:hidden"><X className="h-4 w-4" /></button></div>
        <div className="flex rounded-xl bg-black/20 p-1">{(["team", "network"] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setSelection(null); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold ${tab === value ? "bg-white/10 text-white" : "text-zinc-500"}`}>{value === "team" ? <Users className="h-3.5 w-3.5" /> : <Cable className="h-3.5 w-3.5" />}{value === "team" ? `Teknisi · ${technicians.length}` : `Jaringan · ${topology.nodes.length}`}</button>)}</div>
      </div>
      {dataError && <p role="status" className="mx-4 mb-3 rounded-xl bg-amber-400/10 p-3 text-[11px] leading-relaxed text-amber-200">{dataError}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {selection && (selectedTech || selectedNode || selectedTicket) ? <div className="px-2">
          <button type="button" onClick={() => setSelection(null)} className="mb-4 text-[11px] text-zinc-400">← Kembali ke daftar</button><p className="text-[10px] uppercase tracking-widest text-[#8da1ff]">{selectedNode ? NETWORK_LABELS[selectedNode.kind] : selectedTicket ? `Tiket #${selectedTicket.ticketNumber}` : "Lokasi teknisi"}</p><h2 className="mt-2 break-words text-lg font-semibold leading-snug">{selectedNode?.name || selectedTech?.name || selectedTicket?.title}</h2>
          {selectedTech && <div className="mt-4 rounded-xl bg-white/5 p-3 text-xs"><p className={fresh(selectedTech, now) ? "text-emerald-400" : "text-amber-300"}>{fresh(selectedTech, now) ? "GPS terbaru" : "Lokasi terakhir · belum diperbarui"}</p><p className="mt-2 text-zinc-400">{selectedTech.updatedAt ? formatRelativeTime(selectedTech.updatedAt) : "Belum ada lokasi"}</p>{Number.isFinite(selectedTech.accuracy) && <p className="mt-2 text-zinc-500">Akurasi ±{Math.round(selectedTech.accuracy!)} m</p>}</div>}
          {selectedNode && <div className="mt-4 text-xs leading-relaxed text-zinc-400"><p>{highlighted.size} hubungan ke arah sumber jaringan.</p>{selectedNode.parentIds.length > 0 && <p className="mt-2">Terhubung ke {selectedNode.parentIds.map(id => topology.nodes.find(node => node.id === id)?.name).filter(Boolean).join(", ")}</p>}<p className="mt-3 text-[10px] text-zinc-500">Topologi tersimpan; status perangkat tidak dipantau dari peta ini.</p></div>}
          {selectedTicket && <a href={`/tickets/${encodeURIComponent(selectedTicket.id)}`} className="mt-4 flex items-center gap-2 text-xs text-[#8da1ff]">Buka detail tiket<ChevronRight className="h-3.5 w-3.5" /></a>}
          {destination && <div className="mt-4 rounded-xl border border-white/10 p-3"><p className="text-[10px] text-zinc-500">TUJUAN PEKERJAAN</p><a href={`/tickets/${encodeURIComponent(destination.id)}`} className="mt-1 block text-xs font-semibold text-[#8da1ff]">#{destination.ticketNumber} · {destination.title}</a>{route && <p className="mt-3 text-xs">{formatDistance(route.distance)}{route.road && route.duration !== undefined ? ` · ±${Math.max(1, Math.round(route.duration / 60))} menit` : " · garis arah"}</p>}{route && !route.road && <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Rute jalan belum tersedia; garis menunjukkan arah tujuan.</p>}</div>}
          {selectedPosition && <><p className="mt-5 font-mono text-[10px] text-zinc-500">{selectedPosition[1].toFixed(6)}, {selectedPosition[0].toFixed(6)}</p><a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPosition[1]},${selectedPosition[0]}`} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#4563ff] py-3 text-xs font-semibold text-white"><Navigation className="h-3.5 w-3.5" />Buka navigasi<ExternalLink className="h-3 w-3" /></a></>}
        </div> : tab === "team" ? <>
          {!filteredTechs.length && <p className="px-4 py-8 text-center text-xs leading-relaxed text-zinc-500">{loading ? "Memuat lokasi tim..." : query ? "Teknisi tidak ditemukan." : "Belum ada teknisi. Lokasi muncul setelah teknisi mengaktifkan aplikasi."}</p>}
          {filteredTechs.map(tech => <button type="button" key={tech.userId} onClick={() => focus("technician", tech.userId, coordinatesOf(tech))} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5"><span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${fresh(tech, now) ? "bg-blue-500/20 text-blue-300" : "bg-white/5 text-zinc-500"}`}>{tech.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("")}<span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#17171c] ${fresh(tech, now) ? "bg-emerald-400" : "bg-zinc-600"}`} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{tech.name}</span><span className="mt-1 block text-[10px] text-zinc-500">{!coordinatesOf(tech) ? "Belum ada lokasi" : tech.updatedAt ? formatRelativeTime(tech.updatedAt) : "Lokasi terakhir"}</span></span><ChevronRight className="h-3.5 w-3.5 text-zinc-600" /></button>)}
        </> : <>
          {!topology.nodes.length && <div className="px-3 py-6 text-center"><MapPin className="mx-auto mb-3 h-7 w-7 text-zinc-600" /><p className="mb-5 text-xs leading-relaxed text-zinc-500">Muat titik pelanggan, MikroTik, ODP, dan jalur kabel dari topology.db.</p>{importButton}</div>}
          {topology.nodes.length > 0 && !filteredNodes.length && <p className="p-5 text-center text-xs text-zinc-500">Titik tidak ditemukan. Periksa pencarian atau lapisan yang aktif.</p>}
          {filteredNodes.slice(0, 50).map(node => <button type="button" key={node.id} onClick={() => focus("network", node.id, node.coordinates)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: NETWORK_COLORS[node.kind] }} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{node.name}</span><span className="mt-1 block text-[10px] text-zinc-500">{NETWORK_LABELS[node.kind]}</span></span><ChevronRight className="h-3.5 w-3.5 text-zinc-600" /></button>)}
          {filteredNodes.length > 50 && <p className="px-3 py-3 text-[10px] text-zinc-500">Menampilkan 50 dari {filteredNodes.length} titik. Gunakan pencarian; semua titik tetap tampil pada peta.</p>}
        </>}
      </div><div className="shrink-0 border-t border-white/10 px-4 py-3 text-[10px] text-zinc-500">{topology.links.length} jalur jaringan · {tickets.filter(ticket => coordinatesOf(ticket)).length} lokasi tiket</div>
    </aside>
    {mapError && <div role="status" className={`absolute bottom-12 left-1/2 z-30 w-[min(340px,90%)] -translate-x-1/2 rounded-2xl p-4 text-xs ${panel}`}><p>{mapError}</p><button type="button" onClick={() => setMapRevision(value => value + 1)} className="mt-3 font-semibold text-[#8da1ff]">Coba muat ulang peta</button></div>}
    {!ready && !mapError && <div role="status" className={`pointer-events-none absolute bottom-12 right-4 z-20 flex items-center gap-2 rounded-xl px-4 py-3 text-xs ${panel}`}><Loader2 className="h-4 w-4 animate-spin" />Memuat peta...</div>}
    <style jsx global>{`
      .tracking-map .maplibregl-ctrl-bottom-left,.tracking-map .mapboxgl-ctrl-bottom-left{z-index:1}
      .tracking-map .maplibregl-ctrl-bottom-right,.tracking-map .mapboxgl-ctrl-bottom-right{z-index:2}
      .tracking-map .maplibregl-ctrl-group,.tracking-map .mapboxgl-ctrl-group{border-radius:12px;overflow:hidden}
      .tracking-technician{position:relative;display:flex;width:38px;height:38px;align-items:center;justify-content:center;border:3px solid white;border-radius:50%;background:#52525b;color:white;box-shadow:0 3px 12px #0004;cursor:pointer}
      .tracking-technician[data-live=true]{background:#4563ff}.tracking-technician[data-selected=true]{outline:4px solid #4563ff66}
      .tracking-initials{font:700 11px system-ui}.tracking-name{position:absolute;bottom:44px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:7px;background:#17171c;color:#fafafa;padding:4px 8px;font:600 10px system-ui;box-shadow:0 2px 8px #0003}
      .tracking-technician:focus-visible{outline:3px solid #a5b4fc;outline-offset:3px}
    `}</style>
  </section>;
}
export default LiveDispatcherMap;
