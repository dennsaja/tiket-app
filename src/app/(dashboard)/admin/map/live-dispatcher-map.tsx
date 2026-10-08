"use client";

import * as React from "react";
import {
  Navigation,
  RefreshCw,
  MapPin,
  Battery,
  User,
  Ticket,
  Search,
  Filter,
  Layers,
  Maximize2,
  Clock,
  Phone,
  Compass,
  Radio,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TicketTypeBadge } from "@/components/tickets/ticket-type-badge";
import { PriorityBadge } from "@/components/tickets/priority-badge";
import { useSSE } from "@/hooks/use-sse";
import { formatRelativeTime } from "@/lib/utils";
import { formatDistance, distanceMeters, LOCATION_STALE_MS } from "@/lib/utils/geo";
import toast from "react-hot-toast";

// Leaflet TypeScript types only (erased at compile time)
import type * as LType from "leaflet";

interface TechnicianItem {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  phone?: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  battery?: number | null;
  isTracking?: boolean | null;
  activeTicketId?: string | null;
  updatedAt?: string | null;
}

interface TicketDestinationItem {
  id: string;
  ticketNumber: number;
  title: string;
  status: string;
  priority: string;
  ticketType: string;
  reporterName?: string | null;
  reporterAddress?: string | null;
  reporterMapUrl?: string | null;
  latitude: number | null;
  longitude: number | null;
  assigneeIds: string[];
}

export function LiveDispatcherMap() {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<LType.Map | null>(null);
  const LRef = React.useRef<typeof LType | null>(null);

  const markersRef = React.useRef<Map<string, LType.Marker>>(new Map());
  const ticketMarkersRef = React.useRef<Map<string, LType.Marker>>(new Map());
  const polylinesRef = React.useRef<Map<string, LType.Polyline>>(new Map());

  const [technicians, setTechnicians] = React.useState<TechnicianItem[]>([]);
  const [tickets, setTickets] = React.useState<TicketDestinationItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedTechId, setSelectedTechId] = React.useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null);
  const [showTicketsLayer, setShowTicketsLayer] = React.useState(true);
  const [filterQuery, setFilterQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "online" | "offline">("all");
  const [lastSyncTime, setLastSyncTime] = React.useState<string>(new Date().toISOString());

  // Load initial snapshot
  const loadData = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch("/api/technicians/location");
      if (!res.ok) throw new Error("Gagal mengambil data lokasi");
      const data = await res.json();
      setTechnicians(data.technicians || []);
      setTickets(data.tickets || []);
      setLastSyncTime(new Date().toISOString());
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Gagal memuat peta");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen to live SSE broadcast
  useSSE("/api/sse", {
    onEvent: (event) => {
      if (event.type === "location" && event.data) {
        const payload = event.data as TechnicianItem;
        setTechnicians((prev) => {
          const idx = prev.findIndex((t) => t.userId === payload.userId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...payload };
            return next;
          }
          return [...prev, payload];
        });
        setLastSyncTime(new Date().toISOString());
      }
    },
  });

  // Initialize Leaflet map instance
  React.useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      // 1. Dynamically load Leaflet CSS if not already present
      if (typeof document !== "undefined" && !document.getElementById("leaflet-css-bundle")) {
        const link = document.createElement("link");
        link.id = "leaflet-css-bundle";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // 2. Load Leaflet library (from window.L or dynamic script tag)
      let L: typeof LType | null = (typeof window !== "undefined" && (window as any).L) ? (window as any).L : null;
      if (!L) {
        L = await new Promise<typeof LType | null>((resolve) => {
          if (typeof window !== "undefined" && (window as any).L) return resolve((window as any).L);
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.async = true;
          script.onload = () => resolve((window as any).L || null);
          script.onerror = () => resolve(null);
          document.head.appendChild(script);
        });
      }

      if (isCancelled || !L || !mapContainerRef.current) return;
      LRef.current = L;

      // Default center: Indonesia (Jakarta / Center coordinate)
      const map = L.map(mapContainerRef.current, {
        center: [-6.2088, 106.8456],
        zoom: 12,
        zoomControl: true,
      });

      // 100% Free Base Layers — No API Key Required!
      const osmStandard = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });

      const esriSatellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
        maxZoom: 19,
      });

      // Default active layer: OpenStreetMap Standard
      osmStandard.addTo(map);

      // Layer selector control (Peta Jalan vs Satelit)
      L.control
        .layers(
          {
            "🗺️ Peta Jalan (OpenStreetMap)": osmStandard,
            "🛰️ Citra Satelit (Esri Satellite)": esriSatellite,
          },
          undefined,
          { position: "topright" }
        )
        .addTo(map);

      mapInstanceRef.current = map;
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync Markers to Leaflet map whenever technicians or tickets change
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    const bounds: LType.LatLngExpression[] = [];

    // 1. Sync Technician Markers
    const currentTechIds = new Set<string>();

    technicians.forEach((tech) => {
      if (tech.latitude === null || tech.longitude === null) return;
      currentTechIds.add(tech.userId);

      const isOnline =
        tech.isTracking &&
        tech.updatedAt &&
        Date.now() - new Date(tech.updatedAt).getTime() < LOCATION_STALE_MS;

      const initials = tech.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const pulseHtml = isOnline
        ? `<div class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse"></div>`
        : `<div class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-zinc-400 border border-white"></div>`;

      const avatarHtml = tech.avatarUrl
        ? `<img src="${tech.avatarUrl}" class="h-8 w-8 rounded-full object-cover border-2 border-zinc-900 bg-white" />`
        : `<div class="h-8 w-8 rounded-full bg-zinc-900 text-white font-bold flex items-center justify-center text-[10px] border-2 border-white shadow-md">${initials}</div>`;

      const iconHtml = `
        <div class="relative flex flex-col items-center cursor-pointer group">
          <div class="relative">
            ${avatarHtml}
            ${pulseHtml}
          </div>
          <div class="bg-black/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap group-hover:scale-105 transition-transform">
            ${tech.name.split(" ")[0]}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: "custom-technician-marker",
        iconSize: [36, 48],
        iconAnchor: [18, 24],
      });

      const position: [number, number] = [tech.latitude, tech.longitude];
      bounds.push(position);

      let marker = markersRef.current.get(tech.userId);
      if (marker) {
        marker.setLatLng(position);
        marker.setIcon(icon);
      } else {
        marker = L.marker(position, { icon }).addTo(map);
        markersRef.current.set(tech.userId, marker);
      }

      // Popup
      const activeTicket = tickets.find((t) => t.id === tech.activeTicketId);
      const popupHtml = `
        <div class="p-1 min-w-[200px] text-zinc-900 font-sans">
          <div class="flex items-center gap-2 border-b border-zinc-200 pb-1.5 mb-1.5">
            <div class="font-bold text-xs">${tech.name}</div>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold ${
              isOnline ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
            }">${isOnline ? "Online" : "Offline"}</span>
          </div>
          ${
            tech.phone
              ? `<div class="text-[11px] text-zinc-600 mb-1">📞 ${tech.phone}</div>`
              : ""
          }
          ${
            tech.battery !== null && tech.battery !== undefined
              ? `<div class="text-[11px] text-zinc-600 mb-1">🔋 Baterai: <b>${tech.battery}%</b></div>`
              : ""
          }
          ${
            tech.speed && tech.speed > 1
              ? `<div class="text-[11px] text-zinc-600 mb-1">⚡ Kecepatan: <b>${Math.round(
                  tech.speed
                )} km/h</b></div>`
              : ""
          }
          ${
            tech.updatedAt
              ? `<div class="text-[10px] text-zinc-400 mb-2">Waktu: ${formatRelativeTime(
                  tech.updatedAt
                )}</div>`
              : ""
          }
          ${
            activeTicket
              ? `
            <div class="bg-zinc-50 border border-zinc-200 rounded p-1.5 text-[11px] mt-1">
              <div class="font-semibold text-zinc-800">Tiket Aktif #${activeTicket.ticketNumber}</div>
              <div class="text-zinc-600 truncate">${activeTicket.title}</div>
              <div class="text-[10px] text-zinc-500 mt-0.5 truncate">${activeTicket.reporterAddress || ""}</div>
              <a href="/tickets/${activeTicket.id}" class="text-blue-600 font-semibold hover:underline mt-1 inline-block text-[11px]">Buka Tiket &rarr;</a>
            </div>
          `
              : '<div class="text-[11px] text-zinc-400 italic">Tidak ada tiket aktif</div>'
          }
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on("click", () => {
        setSelectedTechId(tech.userId);
      });
    });

    // Remove deleted / inactive tech markers
    markersRef.current.forEach((marker, id) => {
      if (!currentTechIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // 2. Sync Ticket Destination Markers
    const currentTicketIds = new Set<string>();

    if (showTicketsLayer) {
      tickets.forEach((ticket) => {
        if (ticket.latitude === null || ticket.longitude === null) return;
        currentTicketIds.add(ticket.id);

        const ticketPos: [number, number] = [ticket.latitude, ticket.longitude];
        bounds.push(ticketPos);

        const isUrgent = ticket.priority === "critical" || ticket.priority === "high";

        const ticketIconHtml = `
          <div class="flex flex-col items-center cursor-pointer group">
            <div class="h-7 w-7 rounded-lg ${
              isUrgent ? "bg-red-600" : "bg-blue-600"
            } text-white flex items-center justify-center shadow-lg border-2 border-white transform group-hover:scale-110 transition-transform">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div class="bg-black/80 text-white text-[9px] font-bold px-1 rounded shadow mt-0.5">
              #${ticket.ticketNumber}
            </div>
          </div>
        `;

        const ticketIcon = L.divIcon({
          html: ticketIconHtml,
          className: "custom-ticket-marker",
          iconSize: [32, 40],
          iconAnchor: [16, 20],
        });

        let tMarker = ticketMarkersRef.current.get(ticket.id);
        if (tMarker) {
          tMarker.setLatLng(ticketPos);
          tMarker.setIcon(ticketIcon);
        } else {
          tMarker = L.marker(ticketPos, { icon: ticketIcon }).addTo(map);
          ticketMarkersRef.current.set(ticket.id, tMarker);
        }

        const ticketPopupHtml = `
          <div class="p-1 min-w-[210px] text-zinc-900 font-sans">
            <div class="flex items-center justify-between border-b border-zinc-200 pb-1 mb-1">
              <span class="font-bold text-xs text-blue-700">Tiket #${ticket.ticketNumber}</span>
              <span class="text-[10px] px-1 bg-zinc-100 rounded">${ticket.status}</span>
            </div>
            <div class="font-semibold text-xs text-zinc-900 mb-1">${ticket.title}</div>
            ${ticket.reporterName ? `<div class="text-[11px] text-zinc-600">👤 Pelapor: ${ticket.reporterName}</div>` : ""}
            ${ticket.reporterAddress ? `<div class="text-[11px] text-zinc-600 line-clamp-2 mt-0.5">📍 ${ticket.reporterAddress}</div>` : ""}
            <div class="mt-2 pt-1 border-t border-zinc-100 flex items-center justify-between">
              <a href="/tickets/${ticket.id}" class="text-xs text-blue-600 font-bold hover:underline">Detail Tiket &rarr;</a>
              ${ticket.reporterMapUrl ? `<a href="${ticket.reporterMapUrl}" target="_blank" class="text-[11px] text-zinc-500 hover:text-black">Google Maps &nearr;</a>` : ""}
            </div>
          </div>
        `;

        tMarker.bindPopup(ticketPopupHtml);
        tMarker.on("click", () => {
          setSelectedTicketId(ticket.id);
        });
      });
    }

    // Clean up ticket markers if layer toggled off
    ticketMarkersRef.current.forEach((tMarker, id) => {
      if (!currentTicketIds.has(id)) {
        tMarker.remove();
        ticketMarkersRef.current.delete(id);
      }
    });

    // 3. Draw Dotted Connecting Polylines from Technician to Assigned Ticket
    const activePolylineKeys = new Set<string>();

    technicians.forEach((tech) => {
      if (!tech.latitude || !tech.longitude || !tech.activeTicketId) return;
      const targetTicket = tickets.find((t) => t.id === tech.activeTicketId);
      if (!targetTicket || !targetTicket.latitude || !targetTicket.longitude) return;

      const key = `${tech.userId}-${targetTicket.id}`;
      activePolylineKeys.add(key);

      const latlngs: [number, number][] = [
        [tech.latitude, tech.longitude],
        [targetTicket.latitude, targetTicket.longitude],
      ];

      let line = polylinesRef.current.get(key);
      if (line) {
        line.setLatLngs(latlngs);
      } else {
        line = L.polyline(latlngs, {
          color: "#2563eb",
          weight: 2.5,
          dashArray: "6, 8",
          opacity: 0.75,
        }).addTo(map);
        polylinesRef.current.set(key, line);
      }
    });

    polylinesRef.current.forEach((line, key) => {
      if (!activePolylineKeys.has(key)) {
        line.remove();
        polylinesRef.current.delete(key);
      }
    });

    // Initial fit bounds if valid
    if (bounds.length > 0 && !selectedTechId && !selectedTicketId) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
      } catch {}
    }
  }, [technicians, tickets, showTicketsLayer]);

  // Focus on specific technician
  const focusTechnician = (tech: TechnicianItem) => {
    setSelectedTechId(tech.userId);
    const map = mapInstanceRef.current;
    if (!map || tech.latitude === null || tech.longitude === null) return;
    map.flyTo([tech.latitude, tech.longitude], 16, { duration: 1.2 });
    const marker = markersRef.current.get(tech.userId);
    if (marker) marker.openPopup();
  };

  // Focus on specific ticket
  const focusTicket = (t: TicketDestinationItem) => {
    setSelectedTicketId(t.id);
    const map = mapInstanceRef.current;
    if (!map || t.latitude === null || t.longitude === null) return;
    map.flyTo([t.latitude, t.longitude], 16, { duration: 1.2 });
    const marker = ticketMarkersRef.current.get(t.id);
    if (marker) marker.openPopup();
  };

  // Filter technicians
  const filteredTechnicians = React.useMemo(() => {
    return technicians.filter((tech) => {
      const matchQuery =
        !filterQuery ||
        tech.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (tech.phone && tech.phone.includes(filterQuery));

      if (!matchQuery) return false;

      const isOnline =
        tech.isTracking &&
        tech.updatedAt &&
        Date.now() - new Date(tech.updatedAt).getTime() < LOCATION_STALE_MS;

      if (statusFilter === "active" && !tech.activeTicketId) return false;
      if (statusFilter === "online" && !isOnline) return false;
      if (statusFilter === "offline" && isOnline) return false;

      return true;
    });
  }, [technicians, filterQuery, statusFilter]);

  const onlineCount = technicians.filter(
    (t) => t.isTracking && t.updatedAt && Date.now() - new Date(t.updatedAt).getTime() < LOCATION_STALE_MS
  ).length;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-130px)] min-h-[550px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black overflow-hidden shadow-xs">
      {/* ── Left / Main: Map Area ── */}
      <div className="relative flex-1 h-full min-h-[350px]">
        {/* Leaflet DOM container */}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Map Header Floating Overlay */}
        <div className="absolute top-3 left-3 right-3 sm:right-auto z-20 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 px-3 shadow-md pointer-events-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Peta Monitoring Live
              </span>
            </div>

            <span className="text-zinc-300 dark:text-zinc-700">|</span>

            <span className="text-[11px] text-zinc-600 dark:text-zinc-300">
              <strong className="text-emerald-600 dark:text-emerald-400">{onlineCount}</strong> / {technicians.length} Teknisi Online
            </span>

            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>

            <button
              type="button"
              onClick={() => setShowTicketsLayer((prev) => !prev)}
              className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                showTicketsLayer
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
              }`}
            >
              <Ticket className="h-3 w-3" />
              <span>{showTicketsLayer ? "Sembunyikan Tiket" : "Tampilkan Tiket"}</span>
            </button>

            <button
              type="button"
              onClick={() => loadData(false)}
              disabled={isLoading}
              className="text-[11px] text-zinc-500 hover:text-black dark:hover:text-white p-1 rounded"
              title="Perbarui data"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Legend Box at bottom-left */}
        <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 rounded-md px-2.5 py-1.5 text-[10px] text-zinc-600 dark:text-zinc-400 shadow-sm pointer-events-auto">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Teknisi Online</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-zinc-400"></span>
            <span>Teknisi Standby</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-blue-600"></span>
            <span>Lokasi Pelanggan Tiket</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="border-t-2 border-dashed border-blue-600 w-3"></span>
            <span>Rute Penugasan</span>
          </div>
        </div>
      </div>

      {/* ── Right: Technicians Sidebar & Dispatch Queue ── */}
      <div className="w-full lg:w-84 xl:w-96 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-72 lg:h-full bg-zinc-50/50 dark:bg-zinc-950/50">
        {/* Sidebar Header & Filters */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2 bg-white dark:bg-black">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
              Daftar Teknisi ({filteredTechnicians.length})
            </h2>
            <span className="text-[10px] text-zinc-400 font-mono">
              sync {formatRelativeTime(lastSyncTime)}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Cari nama teknisi..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-[10px]">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2 py-0.5 rounded font-medium ${
                statusFilter === "all"
                  ? "bg-black text-white dark:bg-white dark:text-black font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Semua ({technicians.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("online")}
              className={`px-2 py-0.5 rounded font-medium ${
                statusFilter === "online"
                  ? "bg-black text-white dark:bg-white dark:text-black font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Online ({onlineCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2 py-0.5 rounded font-medium ${
                statusFilter === "active"
                  ? "bg-black text-white dark:bg-white dark:text-black font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Bertugas ({technicians.filter((t) => t.activeTicketId).length})
            </button>
          </div>
        </div>

        {/* Technician Cards List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-zinc-100 dark:divide-zinc-800/40">
          {filteredTechnicians.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              Tidak ada teknisi yang sesuai filter.
            </div>
          ) : (
            filteredTechnicians.map((tech) => {
              const isOnline =
                tech.isTracking &&
                tech.updatedAt &&
                Date.now() - new Date(tech.updatedAt).getTime() < LOCATION_STALE_MS;

              const activeTicket = tickets.find((t) => t.id === tech.activeTicketId);
              const isSelected = selectedTechId === tech.userId;
              const hasGps = tech.latitude !== null && tech.longitude !== null;

              // Distance to active ticket if both coords exist
              let distText: string | null = null;
              if (
                tech.latitude &&
                tech.longitude &&
                activeTicket?.latitude &&
                activeTicket?.longitude
              ) {
                const d = distanceMeters(
                  { lat: tech.latitude, lng: tech.longitude },
                  { lat: activeTicket.latitude, lng: activeTicket.longitude }
                );
                distText = formatDistance(d);
              }

              return (
                <div
                  key={tech.userId}
                  onClick={() => hasGps && focusTechnician(tech)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "border-black dark:border-white bg-white dark:bg-zinc-900 shadow-sm"
                      : "border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"
                  } ${!hasGps ? "opacity-60 cursor-default" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        {tech.avatarUrl ? (
                          <img
                            src={tech.avatarUrl}
                            alt={tech.name}
                            className="h-7 w-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-800"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black font-bold text-[10px] flex items-center justify-center">
                            {tech.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white dark:border-black ${
                            isOnline ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {tech.name}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                          {isOnline ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Online
                            </span>
                          ) : (
                            <span>Offline</span>
                          )}
                          {tech.battery !== null && tech.battery !== undefined && (
                            <span>• 🔋{tech.battery}%</span>
                          )}
                          {tech.updatedAt && (
                            <span>• {formatRelativeTime(tech.updatedAt)}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {hasGps ? (
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded shrink-0">
                        Lihat di Peta &rarr;
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 italic shrink-0">
                        GPS Belum Aktif
                      </span>
                    )}
                  </div>

                  {/* Active Ticket Details */}
                  {activeTicket && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                          <Ticket className="h-3 w-3 text-blue-600" />
                          #{activeTicket.ticketNumber} ({activeTicket.status})
                        </span>
                        {distText && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 rounded">
                            {distText} dari lokasi
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-600 dark:text-zinc-400 truncate text-[11px]">
                        {activeTicket.title}
                      </p>
                      {activeTicket.reporterAddress && (
                        <p className="text-zinc-500 text-[10px] truncate flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          {activeTicket.reporterAddress}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveDispatcherMap;
