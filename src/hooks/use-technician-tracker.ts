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

interface UseTechnicianTrackerReturn {
  isSupported: boolean;
  isTracking: boolean;
  isLocating: boolean;
  error: string | null;
  lastLocation: GeoLocationState | null;
  battery: number | null;
  activeTicketId: string | null;
  toggleTracking: (val?: boolean) => void;
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

  // Load user preference from localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setIsSupported("geolocation" in navigator);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setIsTracking(saved === "true");
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

  // Manual one-shot force update
  const forceSendLocation = React.useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) return false;
    setIsLocating(true);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setIsLocating(false);
          const ok = await sendCoordinates(pos.coords, battery);
          resolve(ok);
        },
        (err) => {
          setIsLocating(false);
          setError(
            err.code === 1
              ? "Izin akses lokasi ditolak oleh browser."
              : err.code === 2
              ? "Posisi GPS tidak tersedia saat ini."
              : "Timeout saat mencari sinyal GPS."
          );
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    });
  }, [battery, sendCoordinates]);

  // Main watchPosition effect
  React.useEffect(() => {
    if (!isTechnician || !isTracking || typeof window === "undefined" || !navigator.geolocation) {
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
        setError("Izin akses lokasi ditolak. Buka pengaturan browser untuk mengizinkan.");
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
  }, [isTechnician, isTracking, battery, sendCoordinates]);

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
        // Trigger immediate position fix
        forceSendLocation();
      }
    },
    [isTracking, forceSendLocation]
  );

  return {
    isSupported,
    isTracking,
    isLocating,
    error,
    lastLocation,
    battery,
    activeTicketId,
    toggleTracking,
    forceSendLocation,
  };
}
