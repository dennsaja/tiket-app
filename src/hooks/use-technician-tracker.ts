"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { distanceMeters } from "@/lib/utils/geo";

export interface GeoLocationState {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  battery?: number | null;
  updatedAt: string;
}

export type GpsPermissionState = "prompt" | "granted" | "denied" | "unsupported";

interface UseTechnicianTrackerReturn {
  isSupported: boolean;
  isTracking: boolean;
  isLocating: boolean;
  permissionStatus: GpsPermissionState;
  error: string | null;
  lastLocation: GeoLocationState | null;
  battery: number | null;
  activeTicketId: string | null;
  toggleTracking: (val?: boolean) => void;
  requestPermission: () => Promise<boolean>;
  forceSendLocation: () => Promise<boolean>;
}

const STORAGE_KEY = "helpdesk_technician_gps_enabled";
const MIN_SEND_INTERVAL_MS = 25000; // 25 seconds
const MIN_DISTANCE_METERS = 15; // 15 meters

export function useTechnicianTracker(): UseTechnicianTrackerReturn {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isTechnician = userRole === "agent";

  const [isSupported, setIsSupported] = React.useState(true);
  const [permissionStatus, setPermissionStatus] = React.useState<GpsPermissionState>("prompt");
  const [isTracking, setIsTracking] = React.useState<boolean>(true);
  const [isLocating, setIsLocating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLocation, setLastLocation] = React.useState<GeoLocationState | null>(null);
  const [battery, setBattery] = React.useState<number | null>(null);
  const [activeTicketId, setActiveTicketId] = React.useState<string | null>(null);

  const lastSentRef = React.useRef<{
    lat: number;
    lng: number;
    time: number;
  } | null>(null);

  const isSendingRef = React.useRef(false);

  // Check browser support and initial permission status
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("geolocation" in navigator)) {
      setIsSupported(false);
      setPermissionStatus("unsupported");
      return;
    }

    if (
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setIsSupported(false);
      setPermissionStatus("unsupported");
      setError("Fitur GPS memerlukan HTTPS. Buka via https://helpdesk.infinityteknik.net");
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setIsTracking(saved === "true");
    }

    // Query Permissions API if supported
    if ("permissions" in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((perm) => {
          setPermissionStatus(perm.state as GpsPermissionState);
          perm.onchange = () => {
            setPermissionStatus(perm.state as GpsPermissionState);
            if (perm.state === "granted") {
              setError(null);
            }
          };
        })
        .catch(() => {
          // Fallback if query not allowed
          setPermissionStatus("prompt");
        });
    }
  }, []);

  // Monitor battery level if Battery API is supported
  React.useEffect(() => {
    if (typeof window === "undefined" || !("getBattery" in navigator)) return;
    let batteryObj: any = null;

    const updateBattery = () => {
      if (batteryObj) {
        setBattery(Math.round(batteryObj.level * 100));
      }
    };

    (navigator as any)
      .getBattery()
      .then((b: any) => {
        batteryObj = b;
        updateBattery();
        b.addEventListener("levelchange", updateBattery);
      })
      .catch(() => {});

    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener("levelchange", updateBattery);
      }
    };
  }, []);

  // Send coordinates to server
  const sendCoordinates = React.useCallback(
    async (coords: GeolocationCoordinates, currentBattery: number | null): Promise<boolean> => {
      if (isSendingRef.current) return false;
      isSendingRef.current = true;

      try {
        const payload = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy || null,
          heading: coords.heading || null,
          speed: coords.speed ? Math.max(0, coords.speed * 3.6) : null, // km/h
          battery: currentBattery,
        };

        const res = await fetch("/api/technicians/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Gagal mengirim lokasi");
        }

        const data = await res.json();
        setActiveTicketId(data.activeTicketId ?? null);

        const now = Date.now();
        lastSentRef.current = {
          lat: coords.latitude,
          lng: coords.longitude,
          time: now,
        };

        setLastLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy || null,
          heading: coords.heading || null,
          speed: coords.speed ? Math.max(0, coords.speed * 3.6) : null,
          battery: currentBattery,
          updatedAt: new Date(now).toISOString(),
        });
        setError(null);
        return true;
      } catch (err: any) {
        setError(err.message || "Gagal mengirim lokasi");
        return false;
      } finally {
        isSendingRef.current = false;
      }
    },
    []
  );

  // User-gesture triggered permission request & immediate GPS fix
  const requestPermission = React.useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Browser tidak mendukung geolokasi GPS");
      return false;
    }

    setIsLocating(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setIsLocating(false);
          setPermissionStatus("granted");
          setError(null);
          const ok = await sendCoordinates(pos.coords, battery);
          resolve(ok);
        },
        (err) => {
          setIsLocating(false);
          if (err.code === 1) {
            setPermissionStatus("denied");
            setError("Izin akses lokasi ditolak oleh browser.");
          } else if (err.code === 2) {
            setError("Sinyal GPS lemah atau tidak tersedia di perangkat Anda.");
          } else {
            setError("Waktu pencarian sinyal GPS habis. Coba lagi.");
          }
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, [battery, sendCoordinates]);

  // Manual one-shot force update
  const forceSendLocation = React.useCallback(async (): Promise<boolean> => {
    return requestPermission();
  }, [requestPermission]);

  // Only run background watchPosition if permission is already granted and tracking is active
  React.useEffect(() => {
    if (
      !isTechnician ||
      !isTracking ||
      permissionStatus !== "granted" ||
      typeof window === "undefined" ||
      !navigator.geolocation
    ) {
      return;
    }

    setIsLocating(true);
    let watchId: number | null = null;

    const handleSuccess = (pos: GeolocationPosition) => {
      setIsLocating(false);
      setError(null);

      const coords = pos.coords;
      const now = Date.now();
      const last = lastSentRef.current;

      // Determine if we should send update
      let shouldSend = false;
      if (!last) {
        shouldSend = true;
      } else {
        const timeDiff = now - last.time;
        const dist = distanceMeters(
          { lat: last.lat, lng: last.lng },
          { lat: coords.latitude, lng: coords.longitude }
        );

        if (timeDiff >= MIN_SEND_INTERVAL_MS || dist >= MIN_DISTANCE_METERS) {
          shouldSend = true;
        }
      }

      if (shouldSend) {
        sendCoordinates(coords, battery);
      } else {
        // Just update local display
        setLastLocation((prev) => ({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy || null,
          heading: coords.heading || null,
          speed: coords.speed ? Math.max(0, coords.speed * 3.6) : null,
          battery,
          updatedAt: prev?.updatedAt || new Date().toISOString(),
        }));
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      setIsLocating(false);
      if (err.code === 1) {
        setPermissionStatus("denied");
        setError("Izin akses lokasi ditolak oleh browser.");
      } else if (err.code === 2) {
        setError("Sinyal GPS lemah atau tidak tersedia.");
      } else if (err.code === 3) {
        setError("Mencari sinyal GPS...");
      }
    };

    try {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 25000,
        maximumAge: 10000,
      });
    } catch (e: any) {
      setError(e.message || "Gagal mengaktifkan sensor GPS");
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isTechnician, isTracking, permissionStatus, battery, sendCoordinates]);

  // Toggle tracking on/off
  const toggleTracking = React.useCallback(
    async (val?: boolean) => {
      const next = typeof val === "boolean" ? val : !isTracking;
      setIsTracking(next);
      localStorage.setItem(STORAGE_KEY, String(next));

      if (!next) {
        // Notify server that technician stopped tracking
        try {
          await fetch("/api/technicians/location", { method: "DELETE" });
        } catch {}
      } else {
        // If turning on, trigger permission/update
        requestPermission();
      }
    },
    [isTracking, requestPermission]
  );

  return {
    isSupported,
    isTracking,
    isLocating,
    permissionStatus,
    error,
    lastLocation,
    battery,
    activeTicketId,
    toggleTracking,
    requestPermission,
    forceSendLocation,
  };
}
