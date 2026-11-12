"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/network/client";
import { PRINTER_ROLES } from "@/lib/printing/presence";

export function usePrinterPresence(connected: boolean) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!role || !PRINTER_ROLES.includes(role)) { setStatus(""); return; }
    const endpoint = "/api/printer/presence" + (connected ? "?host=" + crypto.randomUUID() : "");
    let stopped = false, busy = false;
    const release = () => {
      if (connected) void apiFetch(endpoint, { method: "DELETE", keepalive: true }).catch(() => {});
    };
    const refresh = async () => {
      if (stopped || busy) return;
      busy = true;
      try {
        const response = await apiFetch(endpoint, { method: connected ? "PUT" : "GET", cache: "no-store", signal: AbortSignal.timeout(6500) });
        if (!response.ok) throw new Error();
        const { roles }: { roles: string[] } = await response.json();
        if (!stopped) setStatus(roles.length ? "Terhubung · " + roles.join(", ").toUpperCase() : "");
      } catch {
        if (!stopped) setStatus("Status bersama belum tersedia");
      } finally {
        busy = false;
        if (stopped) release();
      }
    };
    setStatus("");
    void refresh();
    const timer = window.setInterval(refresh, connected ? 15000 : 8000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", release);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", release);
      release();
    };
  }, [connected, role, session?.user?.id]);
  return status;
}
