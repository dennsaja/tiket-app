"use client";

import * as React from "react";
import {
  Navigation,
  RefreshCw,
  MapPin,
  Battery,
  Ticket,
  Search,
  Compass,
  ExternalLink,
  Settings,
  Building2,
  CornerUpRight,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Layers,
  Eye,
  KeyRound,
  Check,
  X,
  Zap,
  Route,
  LocateFixed,
  RotateCw,
} from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import { formatRelativeTime } from "@/lib/utils";
import {
  formatDistance,
  distanceMeters,
  LOCATION_STALE_MS,
  getTechnicianColor,
} from "@/lib/utils/geo";
import toast from "react-hot-toast";

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

interface RouteMeta {
  key: string;
  techId: string;
  ticketId: string;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lng, lat]
}

type MapStylePreset = "3d-architectural" | "3d-navigation" | "3d-dark" | "satellite";

const DEFAULT_CENTER_LNG_LAT: [number, number] = [106.8272, -6.1754]; // Jakarta center [lng, lat]
const MAPBOX_TOKEN_STORAGE_KEY = "helpdesk_mapbox_access_token";

export function LiveDispatcherMap() {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const glLibRef = React.useRef<any>(null);
  const markersRef = React.useRef<Map<string, any>>(new Map());
  const ticketMarkersRef = React.useRef<Map<string, any>>(new Map());

  const [technicians, setTechnicians] = React.useState<TechnicianItem[]>([]);
  const [tickets, setTickets] = React.useState<TicketDestinationItem[]>([]);
  const [routesMap, setRoutesMap] = React.useState<Record<string, RouteMeta>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [mapReady, setMapReady] = React.useState(false);

  const [selectedTechId, setSelectedTechId] = React.useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(null);
  const [showTicketsLayer, setShowTicketsLayer] = React.useState(true);
  const [show3DBuildings, setShow3DBuildings] = React.useState(true);
  const [showTrafficDetailCards, setShowTrafficDetailCards] = React.useState(true);
  const [is3DPitched, setIs3DPitched] = React.useState(true);
  const [cameraBearing, setCameraBearing] = React.useState(-18);
  const [stylePreset, setStylePreset] = React.useState<MapStylePreset>("3d-architectural");

  const [filterQuery, setFilterQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "online" | "offline">("all");
  const [lastSyncTime, setLastSyncTime] = React.useState<string>(new Date().toISOString());
  const [bottomCardExpanded, setBottomCardExpanded] = React.useState(true);

  // Mapbox Token state (supports .env NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN or custom user token)
  const envMapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  const [mapboxToken, setMapboxToken] = React.useState<string>("");
  const [tokenInput, setTokenInput] = React.useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [usingOfficialMapbox, setUsingOfficialMapbox] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(MAPBOX_TOKEN_STORAGE_KEY) || envMapboxToken;
      setMapboxToken(saved);
      setTokenInput(saved);
    }
  }, [envMapboxToken]);

  // Load initial technician & ticket coordinates
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

  // Real-time SSE listener
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
      } else if (event.type === "system_event") {
        loadData(true);
      }
    },
  });

  // Helper: Resolve Map Style URL / Object based on engine & preset
  const getStyleConfig = React.useCallback(
    (preset: MapStylePreset, useMapbox: boolean) => {
      if (useMapbox && mapboxToken.startsWith("pk.")) {
        switch (preset) {
          case "3d-architectural":
            return "mapbox://styles/mapbox/light-v11";
          case "3d-navigation":
            return "mapbox://styles/mapbox/navigation-day-v1";
          case "3d-dark":
            return "mapbox://styles/mapbox/navigation-night-v1";
          case "satellite":
            return "mapbox://styles/mapbox/satellite-streets-v12";
        }
      }

      // Free 3D Vector Tile Styles (OpenFreeMap / CARTO / Esri) — Zero API Key Needed
      if (preset === "satellite") {
        return {
          version: 8,
          sources: {
            "esri-sat": {
              type: "raster",
              tiles: [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ],
              tileSize: 256,
              attribution: "Tiles &copy; Esri",
            },
          },
          layers: [
            {
              id: "esri-sat-layer",
              type: "raster",
              source: "esri-sat",
              minzoom: 0,
              maxzoom: 20,
            },
          ],
        };
      }

      if (preset === "3d-dark") {
        return "https://tiles.openfreemap.org/styles/dark";
      }

      if (preset === "3d-navigation") {
        return "https://tiles.openfreemap.org/styles/bright";
      }

      // Default: "3d-architectural" (Liberty 3D vector style enhanced with warm ivory 3D buildings)
      return "https://tiles.openfreemap.org/styles/liberty";
    },
    [mapboxToken]
  );

  // Enhance style with 3D Extruded Buildings (Reference Image 5 aesthetic) + Route GeoJSON sources
  const apply3DBuildingsAndCustomStyling = React.useCallback(
    (map: any, preset: MapStylePreset) => {
      if (!map || !map.getStyle()) return;

      try {
        const style = map.getStyle();
        const layers: any[] = style?.layers || [];

        // Adjust road & background tint in 3d-architectural mode to match Reference Image 5
        // (Warm beige/ivory 3D buildings #EAE2D3 + cool slate-blue streets #A5B8D1)
        if (preset === "3d-architectural") {
          layers.forEach((layer) => {
            if (layer.type === "background") {
              try {
                map.setPaintProperty(layer.id, "background-color", "#F2EFE9");
              } catch {}
            }
            if (
              layer.type === "line" &&
              (layer.id.includes("road") ||
                layer.id.includes("highway") ||
                layer.id.includes("street") ||
                layer.id.includes("transportation")) &&
              !layer.id.includes("casing")
            ) {
              try {
                map.setPaintProperty(layer.id, "line-color", "#B4C3D8");
              } catch {}
            }
          });
        }

        // Find vector source containing 'building' layer (OpenMapTiles / Mapbox composite)
        const sources = style?.sources || {};
        const vectorSourceKey = Object.keys(sources).find(
          (k) => sources[k].type === "vector"
        );

        // Style existing building extrusion layers or add our own high-detail 3D extrusion layer
        let foundExistingExtrusion = false;
        layers.forEach((layer) => {
          if (layer.type === "fill-extrusion" && layer.id.includes("building")) {
            foundExistingExtrusion = true;
            try {
              map.setLayoutProperty(
                layer.id,
                "visibility",
                show3DBuildings ? "visible" : "none"
              );
              map.setPaintProperty(
                layer.id,
                "fill-extrusion-color",
                preset === "3d-dark"
                  ? "#1E293B"
                  : preset === "3d-navigation"
                  ? "#E2E8F0"
                  : [
                      "interpolate",
                      ["linear"],
                      ["coalesce", ["get", "render_height"], ["get", "height"], 15],
                      0,
                      "#EFECE6",
                      40,
                      "#E6DEC8",
                      120,
                      "#D8CEB8",
                    ]
              );
              map.setPaintProperty(layer.id, "fill-extrusion-opacity", 0.92);
            } catch {}
          }
        });

        if (!foundExistingExtrusion && vectorSourceKey && !map.getLayer("helpdesk-3d-buildings")) {
          // Find first symbol layer so 3D buildings render beneath street/POI labels
          const labelLayerId = layers.find(
            (l) => l.type === "symbol" && l.layout && l.layout["text-field"]
          )?.id;

          try {
            map.addLayer(
              {
                id: "helpdesk-3d-buildings",
                source: vectorSourceKey,
                "source-layer": "building",
                type: "fill-extrusion",
                minzoom: 13,
                layout: {
                  visibility: show3DBuildings ? "visible" : "none",
                },
                paint: {
                  "fill-extrusion-color":
                    preset === "3d-dark"
                      ? "#1E293B"
                      : preset === "3d-navigation"
                      ? "#E2E8F0"
                      : [
                          "interpolate",
                          ["linear"],
                          ["coalesce", ["get", "render_height"], ["get", "height"], 16],
                          0,
                          "#EFECE6",
                          35,
                          "#E5DDD0",
                          100,
                          "#D5CBB8",
                        ],
                  "fill-extrusion-height": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13,
                    0,
                    14.5,
                    ["coalesce", ["get", "render_height"], ["get", "height"], 18],
                  ],
                  "fill-extrusion-base": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    13,
                    0,
                    14.5,
                    ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
                  ],
                  "fill-extrusion-opacity": 0.9,
                },
              },
              labelLayerId
            );
          } catch {}
        }
      } catch (e) {
        console.warn("3D layer styling warning:", e);
      }
    },
    [show3DBuildings]
  );

  // Initialize Mapbox GL JS (if token present) or MapLibre GL JS (free 3D vector engine)
  React.useEffect(() => {
    let isCancelled = false;

    async function init3DMap() {
      if (!mapContainerRef.current) return;

      // Clean up previous map instance when switching engines
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
        markersRef.current.clear();
        ticketMarkersRef.current.clear();
        setMapReady(false);
      }

      const useMapbox = Boolean(mapboxToken && mapboxToken.trim().startsWith("pk."));
      setUsingOfficialMapbox(useMapbox);

      if (useMapbox) {
        // Load Official Mapbox GL JS v3
        if (!document.getElementById("mapbox-gl-css")) {
          const link = document.createElement("link");
          link.id = "mapbox-gl-css";
          link.rel = "stylesheet";
          link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";
          document.head.appendChild(link);
        }

        let mapboxgl = (window as any).mapboxgl;
        if (!mapboxgl) {
          mapboxgl = await new Promise<any>((resolve) => {
            const script = document.createElement("script");
            script.src = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js";
            script.async = true;
            script.onload = () => resolve((window as any).mapboxgl || null);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
          });
        }

        if (isCancelled || !mapboxgl || !mapContainerRef.current) return;
        mapboxgl.accessToken = mapboxToken.trim();
        glLibRef.current = mapboxgl;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: getStyleConfig(stylePreset, true),
          center: DEFAULT_CENTER_LNG_LAT,
          zoom: 15.2,
          pitch: 56,
          bearing: -18,
          antialias: true,
        });

        map.on("load", () => {
          if (isCancelled) return;
          apply3DBuildingsAndCustomStyling(map, stylePreset);
          setMapReady(true);
        });

        map.on("rotate", () => {
          setCameraBearing(Math.round(map.getBearing()));
        });

        map.on("pitch", () => {
          setIs3DPitched(map.getPitch() > 20);
        });

        mapRef.current = map;
      } else {
        // Load MapLibre GL JS v4 (100% Free WebGL 3D Vector Engine with 3D Extruded Buildings)
        if (!document.getElementById("maplibre-gl-css")) {
          const link = document.createElement("link");
          link.id = "maplibre-gl-css";
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
          document.head.appendChild(link);
        }

        let maplibregl = (window as any).maplibregl;
        if (!maplibregl) {
          maplibregl = await new Promise<any>((resolve) => {
            if ((window as any).maplibregl) return resolve((window as any).maplibregl);
            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
            script.async = true;
            script.onload = () => resolve((window as any).maplibregl || null);
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
          });
        }

        if (isCancelled || !maplibregl || !mapContainerRef.current) return;
        glLibRef.current = maplibregl;

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: getStyleConfig(stylePreset, false),
          center: DEFAULT_CENTER_LNG_LAT,
          zoom: 15.2,
          pitch: 56,
          bearing: -18,
          antialias: true,
        });

        map.on("load", () => {
          if (isCancelled) return;
          apply3DBuildingsAndCustomStyling(map, stylePreset);
          setMapReady(true);
        });

        map.on("rotate", () => {
          setCameraBearing(Math.round(map.getBearing()));
        });

        map.on("pitch", () => {
          setIs3DPitched(map.getPitch() > 20);
        });

        mapRef.current = map;
      }
    }

    init3DMap();

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, [mapboxToken, stylePreset, getStyleConfig, apply3DBuildingsAndCustomStyling]);

  // Toggle 3D buildings visibility dynamically
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      const layers: any[] = map.getStyle()?.layers || [];
      layers.forEach((l) => {
        if (l.type === "fill-extrusion") {
          map.setLayoutProperty(
            l.id,
            "visibility",
            show3DBuildings ? "visible" : "none"
          );
        }
      });
    } catch {}
  }, [show3DBuildings, mapReady]);

  // Fetch OSRM Road Routes for active technician assignments
  React.useEffect(() => {
    technicians.forEach((tech) => {
      if (tech.latitude === null || tech.longitude === null || !tech.activeTicketId) return;
      const targetTicket = tickets.find((t) => t.id === tech.activeTicketId);
      if (!targetTicket || targetTicket.latitude === null || targetTicket.longitude === null) return;

      const key = `${tech.userId}-${targetTicket.id}`;
      const fallbackDist = distanceMeters(
        { lat: tech.latitude, lng: tech.longitude },
        { lat: targetTicket.latitude, lng: targetTicket.longitude }
      );

      // Seed straight line first if not present
      setRoutesMap((prev) => {
        if (prev[key]) return prev;
        return {
          ...prev,
          [key]: {
            key,
            techId: tech.userId,
            ticketId: targetTicket.id,
            distanceMeters: fallbackDist,
            durationSeconds: Math.max(180, Math.round(fallbackDist / 8.5)),
            coordinates: [
              [tech.longitude!, tech.latitude!],
              [targetTicket.longitude!, targetTicket.latitude!],
            ],
          },
        };
      });

      fetch(
        `https://router.project-osrm.org/route/v1/driving/${tech.longitude},${tech.latitude};${targetTicket.longitude},${targetTicket.latitude}?overview=full&geometries=geojson`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const route = data?.routes?.[0];
          if (route?.geometry?.coordinates) {
            setRoutesMap((prev) => ({
              ...prev,
              [key]: {
                key,
                techId: tech.userId,
                ticketId: targetTicket.id,
                distanceMeters: route.distance || fallbackDist,
                durationSeconds: route.duration || Math.round(fallbackDist / 8.5),
                coordinates: route.geometry.coordinates,
              },
            }));
          }
        })
        .catch(() => {});
    });
  }, [technicians, tickets]);

  // Render & Update 3D Markers + Multi-Layer Traffic Route Lines (Reference Image 4)
  React.useEffect(() => {
    const map = mapRef.current;
    const gl = glLibRef.current;
    if (!map || !gl || !mapReady) return;

    const allLngLats: [number, number][] = [];

    // 1. Technician Markers (Gojek/Mapbox 3D Navigation Puck + Avatar Badge)
    const activeTechIds = new Set<string>();

    technicians.forEach((tech) => {
      if (tech.latitude === null || tech.longitude === null) return;
      activeTechIds.add(tech.userId);
      const lngLat: [number, number] = [tech.longitude, tech.latitude];
      allLngLats.push(lngLat);

      const isOnline = Boolean(
        tech.isTracking &&
          tech.updatedAt &&
          Date.now() - new Date(tech.updatedAt).getTime() < LOCATION_STALE_MS
      );
      const isSelected = selectedTechId === tech.userId;
      const techColor = getTechnicianColor(tech.userId);
      const activeTicket = tickets.find((t) => t.id === tech.activeTicketId);

      // Remove existing marker to refresh state cleanly
      const oldMarker = markersRef.current.get(tech.userId);
      if (oldMarker) {
        oldMarker.remove();
      }

      const el = document.createElement("div");
      el.className = "cursor-pointer select-none group";

      const initials = tech.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const speedBadge =
        tech.speed && tech.speed > 1
          ? `<span style="background:#0066FF;color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:999px;margin-left:4px;">${Math.round(
              tech.speed
            )} km/j</span>`
          : "";

      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:${
          isSelected ? "scale(1.12)" : "scale(1)"
        };transition:transform 0.2s ease;">
          <!-- Floating Name & Speed Pill -->
          <div style="background:${
            isSelected ? "#0066FF" : "#09090B"
          };color:#FFFFFF;font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;box-shadow:0 6px 16px rgba(0,0,0,0.22);display:flex;align-items:center;gap:4px;margin-bottom:5px;border:1.5px solid #FFFFFF;white-space:nowrap;">
            <span style="width:7px;height:7px;border-radius:999px;background:${
              isOnline ? "#10B981" : "#9CA3AF"
            };display:inline-block;"></span>
            <span>${tech.name.split(" ")[0]}</span>
            ${speedBadge}
          </div>

          <!-- 3D Navigation Puck / Avatar Ring (Reference Image 4 Arrow Puck) -->
          <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
            ${
              isOnline
                ? `<div style="position:absolute;inset:-4px;border-radius:999px;background:${techColor};opacity:0.25;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>`
                : ""
            }
            <div style="width:40px;height:40px;border-radius:999px;background:linear-gradient(135deg, ${techColor}, #0052CC);border:3px solid #FFFFFF;box-shadow:0 8px 18px rgba(0,82,204,0.38);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-weight:800;font-size:12px;overflow:hidden;">
              ${
                tech.avatarUrl
                  ? `<img src="${tech.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />`
                  : initials
              }
            </div>
            <!-- Navigation Arrow Badge at bottom-right -->
            <div style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:999px;background:#00AA5B;border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFFFFF">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
          </div>
        </div>
      `;

      const popupHtml = `
        <div style="padding:6px 4px;min-width:215px;font-family:system-ui,sans-serif;color:#09090B;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E4E4E7;padding-bottom:6px;margin-bottom:6px;">
            <strong style="font-size:13px;">${tech.name}</strong>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${
              isOnline ? "#DCFCE7" : "#F4F4F5"
            };color:${isOnline ? "#15803D" : "#52525B"};">
              ${isOnline ? "LIVE GPS" : "STANDBY"}
            </span>
          </div>
          <div style="font-size:11px;color:#52525B;display:flex;flex-direction:column;gap:3px;">
            ${tech.phone ? `<div>Telepon: <b>${tech.phone}</b></div>` : ""}
            ${
              tech.battery !== null && tech.battery !== undefined
                ? `<div>Baterai HP: <b>${tech.battery}%</b></div>`
                : ""
            }
            ${
              tech.speed && tech.speed > 1
                ? `<div>Kecepatan: <b>${Math.round(tech.speed)} km/jam</b></div>`
                : ""
            }
          </div>
          ${
            activeTicket
              ? `<div style="margin-top:8px;padding:7px;border-radius:10px;background:#F0F7FF;border:1px solid #BAE6FD;">
                  <div style="font-size:10px;font-weight:800;color:#0284C7;">MENUJU TIKET #${activeTicket.ticketNumber}</div>
                  <div style="font-size:11px;font-weight:600;color:#0F172A;margin-top:1px;">${activeTicket.title}</div>
                  <a href="/tickets/${activeTicket.id}" style="display:inline-block;margin-top:5px;font-size:11px;font-weight:700;color:#0066FF;text-decoration:none;">Buka Detail Tiket &rarr;</a>
                </div>`
              : ""
          }
        </div>
      `;

      const popup = new gl.Popup({ offset: 25, closeButton: false }).setHTML(popupHtml);
      const marker = new gl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", () => {
        setSelectedTechId(tech.userId);
        if (tech.activeTicketId) {
          setSelectedTicketId(tech.activeTicketId);
        }
        map.flyTo({
          center: lngLat,
          zoom: 16.5,
          pitch: 60,
          bearing: tech.heading || -20,
          duration: 1400,
        });
      });

      markersRef.current.set(tech.userId, marker);
    });

    markersRef.current.forEach((m, id) => {
      if (!activeTechIds.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    });

    // 2. Ticket Destination Markers (3D Pin Card with Priority Ribbon)
    const activeTicketMarkerIds = new Set<string>();
    if (showTicketsLayer) {
      tickets.forEach((ticket) => {
        if (ticket.latitude === null || ticket.longitude === null) return;
        activeTicketMarkerIds.add(ticket.id);
        const lngLat: [number, number] = [ticket.longitude, ticket.latitude];
        allLngLats.push(lngLat);

        const oldTMarker = ticketMarkersRef.current.get(ticket.id);
        if (oldTMarker) oldTMarker.remove();

        const isUrgent = ticket.priority === "critical" || ticket.priority === "high";
        const pinBg = isUrgent ? "#EF4444" : "#0066FF";

        const el = document.createElement("div");
        el.className = "cursor-pointer select-none";
        el.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="background:#FFFFFF;border:2px solid ${pinBg};border-radius:12px;padding:3px 8px;box-shadow:0 8px 18px rgba(0,0,0,0.18);display:flex;align-items:center;gap:5px;">
              <span style="background:${pinBg};color:#FFFFFF;font-size:9px;font-weight:800;padding:1px 5px;border-radius:6px;">#${ticket.ticketNumber}</span>
              <span style="font-size:10px;font-weight:700;color:#0F172A;max-width:95px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${
                ticket.reporterName || ticket.title
              }</span>
            </div>
            <div style="width:3px;height:10px;background:${pinBg};"></div>
            <div style="width:10px;height:10px;border-radius:999px;background:${pinBg};border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `;

        const popupHtml = `
          <div style="padding:6px 4px;min-width:210px;font-family:system-ui,sans-serif;color:#09090B;">
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E4E4E7;padding-bottom:5px;margin-bottom:6px;">
              <strong style="font-size:12px;color:${pinBg};">Tiket #${ticket.ticketNumber}</strong>
              <span style="font-size:10px;font-weight:700;background:#F4F4F5;padding:2px 6px;border-radius:6px;">${ticket.status.toUpperCase()}</span>
            </div>
            <div style="font-size:12px;font-weight:700;margin-bottom:4px;">${ticket.title}</div>
            ${
              ticket.reporterName
                ? `<div style="font-size:11px;color:#52525B;">Pelapor: <b>${ticket.reporterName}</b></div>`
                : ""
            }
            ${
              ticket.reporterAddress
                ? `<div style="font-size:11px;color:#71717A;margin-top:2px;">${ticket.reporterAddress}</div>`
                : ""
            }
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #F4F4F5;display:flex;justify-content:space-between;align-items:center;">
              <a href="/tickets/${ticket.id}" style="font-size:11px;font-weight:700;color:#0066FF;text-decoration:none;">Detail Tiket &rarr;</a>
              ${
                ticket.reporterMapUrl
                  ? `<a href="${ticket.reporterMapUrl}" target="_blank" style="font-size:11px;color:#52525B;text-decoration:none;">GMap &nearr;</a>`
                  : ""
              }
            </div>
          </div>
        `;

        const popup = new gl.Popup({ offset: 22, closeButton: false }).setHTML(popupHtml);
        const tMarker = new gl.Marker({ element: el, anchor: "bottom" })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          setSelectedTicketId(ticket.id);
          map.flyTo({
            center: lngLat,
            zoom: 16.5,
            pitch: 58,
            duration: 1200,
          });
        });

        ticketMarkersRef.current.set(ticket.id, tMarker);
      });
    }

    ticketMarkersRef.current.forEach((m, id) => {
      if (!activeTicketMarkerIds.has(id)) {
        m.remove();
        ticketMarkersRef.current.delete(id);
      }
    });

    // 3. Draw Multi-Segment Traffic Navigation Route Lines (Reference Image 4)
    const routeFeatures: any[] = [];
    const trafficHighlightFeatures: any[] = [];

    Object.values(routesMap).forEach((route) => {
      const tech = technicians.find((t) => t.userId === route.techId);
      if (!tech || !route.coordinates || route.coordinates.length < 2) return;

      const isFocused =
        !selectedTechId ||
        selectedTechId === route.techId ||
        selectedTicketId === route.ticketId;

      const baseColor =
        selectedTechId === route.techId
          ? "#0066FF"
          : getTechnicianColor(route.techId);

      routeFeatures.push({
        type: "Feature",
        properties: {
          color: baseColor,
          opacity: isFocused ? 0.96 : 0.45,
        },
        geometry: {
          type: "LineString",
          coordinates: route.coordinates,
        },
      });

      // Create simulated traffic congestion segment (amber/red like Reference Image 4) on the final 30% approach if route has enough points
      if (route.coordinates.length >= 6) {
        const startIdx = Math.floor(route.coordinates.length * 0.62);
        const endIdx = Math.min(
          route.coordinates.length,
          Math.floor(route.coordinates.length * 0.88)
        );
        const slice = route.coordinates.slice(startIdx, endIdx);
        if (slice.length >= 2) {
          trafficHighlightFeatures.push({
            type: "Feature",
            properties: {
              color: "#F59E0B", // Amber traffic indicator
            },
            geometry: {
              type: "LineString",
              coordinates: slice,
            },
          });
        }

        const redSlice = route.coordinates.slice(
          Math.floor(route.coordinates.length * 0.75),
          Math.min(route.coordinates.length, Math.floor(route.coordinates.length * 0.86))
        );
        if (redSlice.length >= 2) {
          trafficHighlightFeatures.push({
            type: "Feature",
            properties: {
              color: "#EF4444", // Heavy traffic indicator segment
            },
            geometry: {
              type: "LineString",
              coordinates: redSlice,
            },
          });
        }
      }
    });

    const routeGeoJson = {
      type: "FeatureCollection",
      features: routeFeatures,
    };

    const trafficGeoJson = {
      type: "FeatureCollection",
      features: trafficHighlightFeatures,
    };

    try {
      if (map.getSource("dispatch-routes")) {
        map.getSource("dispatch-routes").setData(routeGeoJson);
      } else {
        map.addSource("dispatch-routes", {
          type: "geojson",
          data: routeGeoJson,
        });

        // Outer Casing (deep navy border like Mapbox Navigation)
        map.addLayer({
          id: "dispatch-routes-casing",
          type: "line",
          source: "dispatch-routes",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#0F172A",
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 12],
            "line-opacity": ["get", "opacity"],
          },
        });

        // Main Route Line (vibrant Mapbox Blue / Tech Color)
        map.addLayer({
          id: "dispatch-routes-main",
          type: "line",
          source: "dispatch-routes",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 8],
            "line-opacity": ["get", "opacity"],
          },
        });
      }

      if (map.getSource("dispatch-traffic-segments")) {
        map.getSource("dispatch-traffic-segments").setData(trafficGeoJson);
      } else {
        map.addSource("dispatch-traffic-segments", {
          type: "geojson",
          data: trafficGeoJson,
        });

        map.addLayer({
          id: "dispatch-traffic-segments-layer",
          type: "line",
          source: "dispatch-traffic-segments",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 16, 8],
            "line-opacity": 0.95,
          },
        });
      }
    } catch {}
  }, [technicians, tickets, routesMap, showTicketsLayer, selectedTechId, selectedTicketId, mapReady]);

  // Fit bounds helper
  const fitAllMarkers = React.useCallback(() => {
    const map = mapRef.current;
    const gl = glLibRef.current;
    if (!map || !gl) return;

    const coords: [number, number][] = [];
    technicians.forEach((t) => {
      if (t.latitude !== null && t.longitude !== null) {
        coords.push([t.longitude, t.latitude]);
      }
    });
    if (showTicketsLayer) {
      tickets.forEach((tk) => {
        if (tk.latitude !== null && tk.longitude !== null) {
          coords.push([tk.longitude, tk.latitude]);
        }
      });
    }

    if (coords.length === 0) {
      map.flyTo({
        center: DEFAULT_CENTER_LNG_LAT,
        zoom: 15.2,
        pitch: 56,
        bearing: -18,
        duration: 1200,
      });
      return;
    }

    if (coords.length === 1) {
      map.flyTo({
        center: coords[0],
        zoom: 16,
        pitch: 58,
        bearing: -18,
        duration: 1200,
      });
      return;
    }

    const bounds = coords.reduce(
      (b, coord) => b.extend(coord),
      new gl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, {
      padding: { top: 110, bottom: 130, left: 60, right: 60 },
      pitch: 54,
      bearing: -15,
      maxZoom: 16,
      duration: 1400,
    });
  }, [technicians, tickets, showTicketsLayer]);

  // Auto-fit once when initial data arrives
  const hasInitialFittedRef = React.useRef(false);
  React.useEffect(() => {
    if (mapReady && !hasInitialFittedRef.current && (technicians.length > 0 || tickets.length > 0)) {
      hasInitialFittedRef.current = true;
      fitAllMarkers();
    }
  }, [mapReady, technicians, tickets, fitAllMarkers]);

  // Focus specific technician in 3D
  const focusTechnician = (tech: TechnicianItem) => {
    setSelectedTechId(tech.userId);
    if (tech.activeTicketId) {
      setSelectedTicketId(tech.activeTicketId);
    }
    const map = mapRef.current;
    if (!map || tech.latitude === null || tech.longitude === null) return;
    map.flyTo({
      center: [tech.longitude, tech.latitude],
      zoom: 16.6,
      pitch: 60,
      bearing: tech.heading || -20,
      duration: 1400,
    });
    const marker = markersRef.current.get(tech.userId);
    if (marker && marker.getPopup && !marker.getPopup().isOpen()) {
      marker.togglePopup();
    }
  };

  // Toggle 3D pitch vs 2D top-down
  const toggle3DPitch = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextPitch = map.getPitch() > 25 ? 0 : 58;
    const nextBearing = nextPitch === 0 ? 0 : -18;
    map.easeTo({ pitch: nextPitch, bearing: nextBearing, duration: 800 });
    setIs3DPitched(nextPitch > 20);
  };

  // Rotate 3D camera 45 degrees
  const rotate3DCamera = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      bearing: map.getBearing() + 45,
      pitch: Math.max(map.getPitch(), 55),
      duration: 700,
    });
  };

  // Save Mapbox Token
  const handleSaveMapboxToken = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tokenInput.trim();
    if (typeof window !== "undefined") {
      if (cleaned) {
        window.localStorage.setItem(MAPBOX_TOKEN_STORAGE_KEY, cleaned);
        toast.success("Token Mapbox disimpan! Memuat mesin Mapbox GL 3D...");
      } else {
        window.localStorage.removeItem(MAPBOX_TOKEN_STORAGE_KEY);
        toast.success("Kembali ke mode 3D Vector Gratis (Tanpa Token)");
      }
    }
    setMapboxToken(cleaned);
    setIsSettingsOpen(false);
  };

  // Filtered technicians for the GoPay-style sidebar
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
    (t) =>
      t.isTracking &&
      t.updatedAt &&
      Date.now() - new Date(t.updatedAt).getTime() < LOCATION_STALE_MS
  ).length;

  const activeDispatchCount = technicians.filter((t) => Boolean(t.activeTicketId)).length;

  // Determine active featured route for the Top Blue Navigation Banner & Bottom ETA Card (Reference Image 4)
  const featuredTech = React.useMemo(() => {
    if (selectedTechId) {
      const found = technicians.find((t) => t.userId === selectedTechId);
      if (found) return found;
    }
    return (
      technicians.find((t) => t.activeTicketId && t.latitude !== null) ||
      technicians.find((t) => t.latitude !== null) ||
      null
    );
  }, [technicians, selectedTechId]);

  const featuredTicket = React.useMemo(() => {
    if (selectedTicketId) {
      const found = tickets.find((tk) => tk.id === selectedTicketId);
      if (found) return found;
    }
    if (featuredTech?.activeTicketId) {
      return tickets.find((tk) => tk.id === featuredTech.activeTicketId) || null;
    }
    return tickets[0] || null;
  }, [tickets, selectedTicketId, featuredTech]);

  const featuredRoute = React.useMemo(() => {
    if (featuredTech && featuredTicket) {
      const key = `${featuredTech.userId}-${featuredTicket.id}`;
      if (routesMap[key]) return routesMap[key];
    }
    const firstRoute = Object.values(routesMap)[0];
    return firstRoute || null;
  }, [featuredTech, featuredTicket, routesMap]);

  const displayDistance = featuredRoute
    ? formatDistance(featuredRoute.distanceMeters)
    : featuredTech?.latitude &&
      featuredTech?.longitude &&
      featuredTicket?.latitude &&
      featuredTicket?.longitude
    ? formatDistance(
        distanceMeters(
          { lat: featuredTech.latitude, lng: featuredTech.longitude },
          { lat: featuredTicket.latitude, lng: featuredTicket.longitude }
        )
      )
    : "1.2 km";

  const displayDurationMin = featuredRoute
    ? Math.max(1, Math.round(featuredRoute.durationSeconds / 60))
    : 8;

  const currentTimeWib = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(lastSyncTime));
    } catch {
      return "13:00";
    }
  }, [lastSyncTime]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-118px)] min-h-[620px] rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-[#F4F6F9] dark:bg-zinc-950 overflow-hidden shadow-lg">
      {/* =====================================================================
          LEFT / MAIN: 3D MAPBOX / MAPLIBRE CANVAS + NAVIGATION HUD OVERLAYS
          (Reference Images 4 & 5: 3D Buildings + Precise Traffic Navigation UI)
         ===================================================================== */}
      <div className="relative flex-1 h-full min-h-[420px] bg-[#EAE3D5] overflow-hidden">
        {/* WebGL 3D Map Container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* ── TOP-LEFT: Square Control Buttons + Blue Turn-by-Turn Navigation Banner (Ref Image 4) ── */}
        <div className="absolute top-4 left-4 right-4 sm:right-auto z-20 flex items-start gap-3 pointer-events-none">
          {/* Two Stacked White Rounded-2xl Square Buttons (Compass 3D & Settings) */}
          <div className="flex flex-col gap-2.5 pointer-events-auto shrink-0">
            <button
              type="button"
              onClick={toggle3DPitch}
              title={is3DPitched ? "Ubah ke Tampilan 2D Atas" : "Aktifkan Sudut Pandang 3D Gedung"}
              className="h-12 w-12 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg border border-zinc-200/80 dark:border-zinc-700 flex flex-col items-center justify-center text-zinc-900 dark:text-white hover:scale-105 active:scale-95 transition-all"
            >
              <Navigation
                className="h-5 w-5 text-zinc-900 dark:text-white transition-transform duration-300"
                style={{ transform: `rotate(${cameraBearing}deg)` }}
              />
              <span className="text-[9px] font-extrabold tracking-tighter text-[#0066FF] mt-0.5">
                {is3DPitched ? "3D ON" : "2D"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Pengaturan Mapbox.com & Layer 3D"
              className="h-12 w-12 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:scale-105 active:scale-95 transition-all"
            >
              <Settings className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={rotate3DCamera}
              title="Putar Kamera 3D 45°"
              className="h-12 w-12 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-lg border border-zinc-200/80 dark:border-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-100 hover:scale-105 active:scale-95 transition-all"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          {/* Royal Blue Navigation Sign Banner (Exact match to Reference Image 4) */}
          <div
            onClick={() => {
              if (featuredTech) focusTechnician(featuredTech);
              else fitAllMarkers();
            }}
            className="pointer-events-auto cursor-pointer bg-gradient-to-br from-[#0066FF] via-[#005CE6] to-[#0047B3] text-white rounded-2xl px-4 py-3 shadow-[0_12px_28px_rgba(0,102,255,0.38)] border border-white/20 min-w-[230px] max-w-[340px] hover:brightness-105 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <CornerUpRight className="h-6 w-6 text-white stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold tracking-tight leading-none">
                    {displayDistance}
                  </span>
                  <span className="text-[11px] font-bold text-sky-100 uppercase tracking-wider">
                    • {displayDurationMin} mnt
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-blue-100 truncate mt-0.5">
                  {featuredTech
                    ? `${featuredTech.name} ${
                        featuredTicket ? `➔ ${featuredTicket.reporterName || featuredTicket.title}` : "(Siaga Lapangan)"
                      }`
                    : `${onlineCount} Teknisi Aktif di Peta 3D`}
                </div>
              </div>
            </div>

            {/* Highway Shield Badges Row (like [18↗] [103] / Steglitz in Ref Image 4) */}
            <div className="mt-2.5 pt-2 border-t border-white/15 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 bg-white text-zinc-950 text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-2xs">
                {featuredTicket ? `#${featuredTicket.ticketNumber}` : "3D LIVE"}
                <span className="text-[#0066FF]">↗</span>
              </span>
              <span className="inline-flex items-center bg-[#0041A3] border border-white/40 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                {usingOfficialMapbox ? "MAPBOX GL" : "3D VECTOR"}
              </span>
              <span className="text-xs font-semibold text-white/95 truncate max-w-[140px]">
                / {featuredTicket?.reporterAddress || featuredTicket?.title || "Jakarta 3D Area"}
              </span>
            </div>
          </div>
        </div>

        {/* ── TOP-RIGHT: Map Style Pills & 3D Building Toggle ── */}
        <div className="absolute top-4 right-4 z-20 hidden md:flex items-center gap-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-zinc-200/80 dark:border-zinc-700">
          {(
            [
              { id: "3d-architectural", label: "3D Gedung" },
              { id: "3d-navigation", label: "Traffic Rute" },
              { id: "3d-dark", label: "3D Malam" },
              { id: "satellite", label: "Satelit" },
            ] as { id: MapStylePreset; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStylePreset(item.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                stylePreset === item.id
                  ? "bg-[#0066FF] text-white shadow-xs"
                  : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {item.label}
            </button>
          ))}

          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

          <button
            type="button"
            onClick={() => setShow3DBuildings((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all ${
              show3DBuildings
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>3D</span>
          </button>
        </div>

        {/* ── RIGHT SIDE FLOATING TRAFFIC INDICATOR CARDS (Reference Image 4 "Through traffic / Exit traffic") ── */}
        {showTrafficDetailCards && (
          <div className="absolute right-4 top-20 z-20 hidden xl:flex flex-col gap-2.5 w-44 pointer-events-auto">
            {/* Card 1: Through Traffic / Active Route Status */}
            <div
              onClick={fitAllMarkers}
              className="group cursor-pointer rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2.5 shadow-lg border border-zinc-200/80 dark:border-zinc-800 hover:border-[#0066FF] transition-all"
            >
              <div className="relative h-20 w-full rounded-xl bg-gradient-to-br from-[#DDF2E8] via-[#E2E8F0] to-[#CBD5E1] overflow-hidden flex items-center justify-center">
                {/* Simulated 3D highway lane graphic matching Ref Image 4 */}
                <svg viewBox="0 0 120 75" className="w-full h-full">
                  <path
                    d="M 25 75 Q 55 35 95 0"
                    stroke="#94A3B8"
                    strokeWidth="22"
                    fill="none"
                  />
                  <path
                    d="M 25 75 Q 55 35 95 0"
                    stroke="#0066FF"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 48 46 Q 70 22 95 0"
                    stroke="#EF4444"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="32" cy="64" r="6" fill="#0066FF" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
                <span className="absolute bottom-1.5 right-1.5 bg-zinc-900/85 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                  Jalur Teknisi
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-zinc-700 dark:text-zinc-200">Rute Aktif</span>
                <span className="font-extrabold text-[#0066FF]">
                  {Object.keys(routesMap).length} Jalur
                </span>
              </div>
            </div>

            {/* Card 2: Exit Traffic / SLA Priority */}
            <div
              onClick={() => setShowTicketsLayer((v) => !v)}
              className="group cursor-pointer rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2.5 shadow-lg border border-zinc-200/80 dark:border-zinc-800 hover:border-amber-500 transition-all"
            >
              <div className="relative h-20 w-full rounded-xl bg-gradient-to-br from-[#DCFCE7] via-[#F1F5F9] to-[#E2E8F0] overflow-hidden flex items-center justify-center">
                <svg viewBox="0 0 120 75" className="w-full h-full">
                  <path
                    d="M 25 75 Q 55 35 95 0"
                    stroke="#94A3B8"
                    strokeWidth="22"
                    fill="none"
                  />
                  <path
                    d="M 25 75 Q 55 35 88 8"
                    stroke="#F59E0B"
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="32" cy="64" r="6" fill="#00AA5B" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
                <span className="absolute bottom-1.5 right-1.5 bg-zinc-900/85 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                  Titik Pelanggan
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px]">
                <span className="font-bold text-zinc-700 dark:text-zinc-200">Pin Tiket</span>
                <span className="font-extrabold text-emerald-600">{tickets.length} Lokasi</span>
              </div>
            </div>
          </div>
        )}

        {/* ── BOTTOM FLOATING ETA & MULTI-COLOR TRAFFIC PROGRESS BAR (Exact match to Reference Image 4) ── */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-3 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto max-w-full sm:max-w-md w-full">
            {/* Glowing Blue 3D Navigation Assistant Orb (Bottom-left of Ref Image 4) */}
            <button
              type="button"
              onClick={fitAllMarkers}
              title="Pusatkan Semua Teknisi & Gedung 3D"
              className="h-14 w-14 rounded-full bg-gradient-to-b from-[#60A5FA] via-[#2563EB] to-[#1D4ED8] p-1 shadow-[0_8px_24px_rgba(37,99,235,0.55)] border-2 border-white flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-transform"
            >
              <div className="h-full w-full rounded-full bg-gradient-to-tr from-[#1E40AF] to-[#93C5FD] flex flex-col items-center justify-center text-white">
                <LocateFixed className="h-6 w-6 drop-shadow" />
              </div>
            </button>

            {/* White Rounded-3xl ETA & Traffic Progress Bar Card */}
            <div className="flex-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.16)] border border-zinc-200/90 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={fitAllMarkers}
                  className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shrink-0 transition-colors"
                  title="Cari / Reset Area"
                >
                  <Search className="h-4 w-4" />
                </button>

                <div className="text-center min-w-0 flex-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                      {currentTimeWib}
                    </span>
                    <span className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-md">
                      WIB
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
                    {displayDurationMin} mnt · {displayDistance}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setBottomCardExpanded((v) => !v)}
                  className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shrink-0 transition-colors"
                >
                  {bottomCardExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Multi-Color Traffic Progress Bar with Blue Navigation Arrow (Ref Image 4) */}
              {bottomCardExpanded && (
                <div className="mt-2.5 pt-1">
                  <div className="relative h-2.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-visible flex items-center">
                    <div className="w-[15%] h-full bg-zinc-300 dark:bg-zinc-700 rounded-l-full" />
                    {/* Blue Navigation Arrow Indicator */}
                    <div
                      className=" -ml-2 z-10 flex items-center justify-center"
                      title="Posisi Teknisi Saat Ini"
                    >
                      <div className="h-5 w-5 rounded-full bg-white shadow-md flex items-center justify-center border border-blue-500">
                        <Navigation className="h-3 w-3 text-[#0066FF] rotate-90 fill-[#0066FF]" />
                      </div>
                    </div>
                    <div className="w-[22%] h-full bg-[#0066FF]" />
                    <div className="w-[14%] h-full bg-amber-400" />
                    <div className="w-[12%] h-full bg-red-500" />
                    <div className="w-[18%] h-full bg-[#0066FF]" />
                    <div className="w-[19%] h-full bg-emerald-500 rounded-r-full" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom-Right Highway / Route Shield Pill (Ref Image 4: [111] / [E26]) */}
          <div className="hidden sm:flex items-center gap-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg border border-zinc-200/80 dark:border-zinc-800 pointer-events-auto">
            <span className="bg-[#1E3A8A] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-md">
              {onlineCount} LIVE
            </span>
            <span className="text-zinc-400 font-bold">/</span>
            <span className="bg-[#00AA5B] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-md">
              {tickets.length} TIKET
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT SIDEBAR: GOPAY / GOJEK SUPER-APP INSPIRED CONTROL PANEL
          (Reference Images 1, 2, 3: Deep Blue GoPay Card, "Gratis" Green Corner
           Ribbons, Circular Pastel Icons, Avatar Strip, & Clean Contact List)
         ===================================================================== */}
      <div className="w-full lg:w-[390px] xl:w-[420px] flex flex-col h-[460px] lg:h-full bg-[#F4F6F9] dark:bg-zinc-950 border-t lg:border-t-0 lg:border-l border-zinc-200/80 dark:border-zinc-800 overflow-y-auto">
        {/* ── 1. GoPay "Fully Protected" Deep Blue Header Card (Ref Image 2) ── */}
        <div className="bg-gradient-to-br from-[#005FAA] via-[#0074D4] to-[#004987] text-white p-4 pb-7 relative overflow-hidden shrink-0">
          {/* Decorative diagonal sheen */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-xl" />

          {/* Top Pill Row: gopay/dispatch badge + "Fully protected" translucent pill */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-full bg-[#00AED6] flex items-center justify-center shadow-xs">
                <Compass className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-tight">go•dispatch</span>
            </div>

            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-200" />
              <span>Realtime 3D Active</span>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="h-7 w-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
              title="Konfigurasi Mapbox Token"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Main Balance-Style Telemetry Row + 2 Action Buttons (Top up / Withdraw style) */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-sky-100 uppercase tracking-wider">
                Status Armada Lapangan
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-extrabold tracking-tight">
                  {onlineCount} Online
                </span>
                <span className="text-xs font-semibold text-sky-200">
                  / {technicians.length} Teknisi
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-sky-100/90">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                <span>
                  <b>{activeDispatchCount}</b> sedang menuju lokasi tiket &bull; sync{" "}
                  {formatRelativeTime(lastSyncTime)}
                </span>
              </div>
            </div>

            {/* Right Action Stack (like Top up / Withdraw in Ref Image 2) */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => loadData(false)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Sync GPS</span>
              </button>
              <button
                type="button"
                onClick={fitAllMarkers}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                <span>Reset 3D</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── 2. Overlapping Rounded-3xl Super-App Sheet (Ref Images 1, 2, 3) ── */}
        <div className="-mt-4 rounded-t-3xl bg-[#F4F6F9] dark:bg-zinc-950 px-3.5 pt-4 pb-5 space-y-3.5 flex-1">
          {/* Quick Filter Grid with GoPay "Gratis" Green Corner Ribbon Tags (Ref Images 1 & 3) */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-3.5 shadow-xs border border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h2 className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                  Kontrol &amp; Filter Armada
                </h2>
                <p className="text-[10px] text-zinc-400">
                  Pilih kategori tampilan teknisi di peta 3D
                </p>
              </div>
              <button
                type="button"
                onClick={toggle3DPitch}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/70 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300"
              >
                <Building2 className="h-3 w-3" />
                <span>{is3DPitched ? "Gedung 3D Aktif" : "Mode 2D"}</span>
              </button>
            </div>

            {/* 2x2 Card Grid matching Ref Image 1 ("Top up", "Tarik tunai", "GoPay Tabungan", "BCA") */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Card 1: Semua Teknisi */}
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`relative text-left p-3 rounded-2xl border transition-all ${
                  statusFilter === "all"
                    ? "border-[#0066AE] bg-sky-50/50 dark:bg-sky-950/30 shadow-xs"
                    : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-[#00AED6]/15 text-[#00AED6] flex items-center justify-center shrink-0">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                      Semua Tim
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {technicians.length} Teknisi terdaftar
                    </div>
                  </div>
                </div>
              </button>

              {/* Card 2: Sedang Bertugas (On Route) */}
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`relative text-left p-3 rounded-2xl border transition-all ${
                  statusFilter === "active"
                    ? "border-[#0066AE] bg-sky-50/50 dark:bg-sky-950/30 shadow-xs"
                    : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-500/15 text-[#0066FF] flex items-center justify-center shrink-0">
                    <Route className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                      Jalan Tugas
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {activeDispatchCount} Rute aktif
                    </div>
                  </div>
                </div>
              </button>

              {/* Card 3: Online Live GPS (with GoPay "Gratis" style green top-left ribbon!) */}
              <button
                type="button"
                onClick={() => setStatusFilter("online")}
                className={`relative text-left p-3 pt-4 rounded-2xl border transition-all ${
                  statusFilter === "online"
                    ? "border-[#00AA5B] bg-emerald-50/40 dark:bg-emerald-950/30 shadow-xs"
                    : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
                }`}
              >
                <span className="absolute -top-2 left-2.5 bg-gradient-to-r from-[#00AA5B] to-[#0096A6] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-t-md rounded-br-md shadow-2xs">
                  LIVE GPS
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/15 text-[#00AA5B] flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                      Teknisi Online
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {onlineCount} Aktif sekarang
                    </div>
                  </div>
                </div>
              </button>

              {/* Card 4: Toggle Pin Tiket Pelanggan (with GoPay "Gratis" style ribbon!) */}
              <button
                type="button"
                onClick={() => setShowTicketsLayer((v) => !v)}
                className={`relative text-left p-3 pt-4 rounded-2xl border transition-all ${
                  showTicketsLayer
                    ? "border-[#0066AE] bg-sky-50/40 dark:bg-sky-950/30 shadow-xs"
                    : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 opacity-75"
                }`}
              >
                <span className="absolute -top-2 left-2.5 bg-gradient-to-r from-[#00AA5B] to-[#0096A6] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-t-md rounded-br-md shadow-2xs">
                  3D PIN
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-indigo-500/15 text-indigo-600 flex items-center justify-center shrink-0">
                    <Ticket className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                      Pin Pelanggan
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {showTicketsLayer ? `${tickets.length} Ditampilkan` : "Disembunyikan"}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* ── 3. Quick Avatar Strip (Matching "Gisel, Odelia, Pandu, Others" in Ref Image 2) ── */}
          {technicians.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-3.5 shadow-xs border border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-extrabold text-zinc-800 dark:text-zinc-200">
                  Pintasan Kamera 3D Teknisi
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTechId(null);
                    setSelectedTicketId(null);
                    fitAllMarkers();
                  }}
                  className="text-[10px] font-bold text-[#0066FF] hover:underline"
                >
                  Lihat Semua
                </button>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {technicians.map((tech) => {
                  const isOnline =
                    tech.isTracking &&
                    tech.updatedAt &&
                    Date.now() - new Date(tech.updatedAt).getTime() < LOCATION_STALE_MS;
                  const isSelected = selectedTechId === tech.userId;
                  const color = getTechnicianColor(tech.userId);

                  return (
                    <button
                      key={tech.userId}
                      type="button"
                      onClick={() => focusTechnician(tech)}
                      className="flex flex-col items-center shrink-0 group"
                    >
                      <div
                        className={`relative h-12 w-12 rounded-full p-0.5 transition-transform group-hover:scale-105 ${
                          isSelected ? "ring-2 ring-[#0066FF]" : ""
                        }`}
                        style={{
                          background: isOnline
                            ? `linear-gradient(135deg, ${color}, #00AED6)`
                            : "#E4E4E7",
                        }}
                      >
                        {tech.avatarUrl ? (
                          <img
                            src={tech.avatarUrl}
                            alt={tech.name}
                            className="h-full w-full rounded-full object-cover bg-white"
                          />
                        ) : (
                          <div className="h-full w-full rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-xs font-extrabold text-zinc-800 dark:text-zinc-100">
                            {tech.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {/* Small Cyan/Green Badge Icon at bottom-right (Ref Image 2 & 3) */}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white ${
                            isOnline ? "bg-[#00AA5B]" : "bg-zinc-400"
                          }`}
                        >
                          ✓
                        </span>
                      </div>
                      <span className="mt-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 max-w-[58px] truncate">
                        {tech.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 4. Technician & Active Route List ("Sering dipantau" style in Ref Image 3) ── */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-3.5 shadow-xs border border-zinc-100 dark:border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                Daftar Teknisi &amp; Rute ({filteredTechnicians.length})
              </h3>
              {selectedTechId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTechId(null);
                    setSelectedTicketId(null);
                    fitAllMarkers();
                  }}
                  className="text-[10px] font-bold text-rose-600 hover:underline"
                >
                  Reset Fokus
                </button>
              )}
            </div>

            {/* Search Input (GoPay rounded pill search bar) */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Cari nama teknisi atau nomor HP..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-[#F4F6F9] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
              />
            </div>

            {/* List Items */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredTechnicians.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400">
                  Tidak ada teknisi yang sesuai filter pencarian.
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
                  const techColor = getTechnicianColor(tech.userId);

                  const routeKey = activeTicket ? `${tech.userId}-${activeTicket.id}` : "";
                  const routeInfo = routeKey ? routesMap[routeKey] : null;

                  const distLabel = routeInfo
                    ? formatDistance(routeInfo.distanceMeters)
                    : tech.latitude &&
                      tech.longitude &&
                      activeTicket?.latitude &&
                      activeTicket?.longitude
                    ? formatDistance(
                        distanceMeters(
                          { lat: tech.latitude, lng: tech.longitude },
                          { lat: activeTicket.latitude, lng: activeTicket.longitude }
                        )
                      )
                    : null;

                  return (
                    <div
                      key={tech.userId}
                      onClick={() => hasGps && focusTechnician(tech)}
                      className={`py-3 px-2 rounded-2xl transition-all ${
                        hasGps ? "cursor-pointer hover:bg-sky-50/50 dark:hover:bg-zinc-800/50" : "opacity-60"
                      } ${
                        isSelected
                          ? "bg-sky-50/80 dark:bg-sky-950/30 ring-1 ring-[#0066FF]/40"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Circular Initials/Avatar + GoPay Cyan/Green Sub-badge (Ref Image 3) */}
                          <div className="relative shrink-0">
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-extrabold text-white shadow-xs"
                              style={{ backgroundColor: techColor }}
                            >
                              {tech.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center ${
                                isOnline ? "bg-[#00AED6]" : "bg-zinc-400"
                              }`}
                            >
                              <Navigation className="h-2 w-2 text-white fill-white" />
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                                {tech.name}
                              </p>
                              {isOnline && (
                                <span className="bg-[#00AA5B]/15 text-[#00AA5B] text-[9px] font-extrabold px-1.5 py-0.2 rounded">
                                  LIVE
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                              {tech.battery !== null && tech.battery !== undefined && (
                                <span className="inline-flex items-center gap-0.5 font-medium">
                                  <Battery className="h-3 w-3 text-emerald-600" />
                                  {tech.battery}%
                                </span>
                              )}
                              {tech.speed && tech.speed > 1 ? (
                                <span>• {Math.round(tech.speed)} km/j</span>
                              ) : null}
                              {tech.updatedAt && (
                                <span>• {formatRelativeTime(tech.updatedAt)}</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {hasGps ? (
                          <span className="text-[10px] font-extrabold text-white bg-[#0066FF] hover:bg-[#0052CC] px-2.5 py-1 rounded-xl shrink-0 shadow-2xs">
                            3D Fly &rarr;
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 italic shrink-0">
                            No GPS
                          </span>
                        )}
                      </div>

                      {/* Active Ticket Destination Pill */}
                      {activeTicket && (
                        <div className="mt-2.5 ml-12 p-2.5 rounded-2xl bg-[#F4F6F9] dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 text-[11px]">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-[#0066FF] flex items-center gap-1">
                              <Ticket className="h-3 w-3" />
                              Tiket #{activeTicket.ticketNumber}
                            </span>
                            {distLabel && (
                              <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                {distLabel}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                            {activeTicket.title}
                          </p>
                          {activeTicket.reporterAddress && (
                            <p className="text-[10px] text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                              {activeTicket.reporterAddress}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center justify-between">
                            <a
                              href={`/tickets/${activeTicket.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-extrabold text-[#0066AE] hover:underline inline-flex items-center gap-0.5"
                            >
                              <span>Buka Tiket</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                            {routeInfo && (
                              <span className="text-[10px] font-bold text-zinc-500">
                                ETA ~{Math.max(1, Math.round(routeInfo.durationSeconds / 60))} mnt
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL PENGATURAN MAPBOX.COM & LAYER 3D
         ===================================================================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-[#0066FF]/10 text-[#0066FF] flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                    Konfigurasi Mapbox &amp; Peta 3D
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Mendukung Mapbox GL JS v3 resmi maupun 3D Vector Gratis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMapboxToken} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  Mapbox Public Access Token (Opsional — mapbox.com)
                </label>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="pk.eyJ1Ijoi..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
                <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                  Jika dikosongkan, peta otomatis berjalan menggunakan{" "}
                  <b>3D Vector Engine Gratis (OpenFreeMap 3D Extrusion)</b> dengan gedung 3D tanpa perlu kartu kredit/API key. Jika Anda memasukkan token{" "}
                  <code>pk.eyJ1...</code> dari{" "}
                  <a
                    href="https://account.mapbox.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0066FF] font-bold underline"
                  >
                    mapbox.com
                  </a>
                  , peta akan beralih ke mesin resmi <b>Mapbox GL JS v3</b>.
                </p>
              </div>

              {/* Quick Layer Toggles */}
              <div className="pt-2 space-y-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <span>Tampilkan Ekstrusi Gedung 3D</span>
                  <input
                    type="checkbox"
                    checked={show3DBuildings}
                    onChange={(e) => setShow3DBuildings(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#0066FF]"
                  />
                </label>
                <label className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <span>Tampilkan Mini Card Indikator Traffic</span>
                  <input
                    type="checkbox"
                    checked={showTrafficDetailCards}
                    onChange={(e) => setShowTrafficDetailCards(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#0066FF]"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan &amp; Terapkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveDispatcherMap;
