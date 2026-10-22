"use client";

import * as React from "react";
import toast from "react-hot-toast";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  ticketId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  marking: boolean;
  error: string | null;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [marking, setMarking] = React.useState(false);
  const generation = React.useRef(0);
  const pending = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    const request = ++generation.current;
    setLoading(true);

    fetch("/api/notifications?perPage=20", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled && request === generation.current && !pending.current) {
          setNotifications(json.notifications || []);
          setUnreadCount(json.unreadCount || 0);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const handleCustomRefresh = () => {
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener("refresh-notifications", handleCustomRefresh);
    window.addEventListener("focus", handleCustomRefresh);
    const timer = window.setInterval(() => { if (!document.hidden) handleCustomRefresh(); }, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("refresh-notifications", handleCustomRefresh);
      window.removeEventListener("focus", handleCustomRefresh);
      clearInterval(timer);
    };
  }, [refreshKey]);

  const markRead = React.useCallback(async (id: string) => {
    if (pending.current) return;
    pending.current = true; setMarking(true); ++generation.current;
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH" });
      if (!response.ok) throw new Error("Status dibaca belum tersimpan. Coba lagi.");
      setNotifications(previous => previous.map(item => item.id === id ? { ...item, isRead: true } : item));
    } catch {
      toast.error("Status dibaca belum tersimpan. Coba lagi.");
    } finally { pending.current = false; setMarking(false); setRefreshKey(key => key + 1); }
  }, []);

  const markAllRead = React.useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setMarking(true); ++generation.current;
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_all_read" }) });
      if (!response.ok) throw new Error("Status dibaca belum tersimpan. Coba lagi.");
      setNotifications(previous => previous.map(item => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      toast.error("Status dibaca belum tersimpan. Coba lagi.");
    } finally { pending.current = false; setMarking(false); setRefreshKey(key => key + 1); }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    marking,
    error,
    markRead,
    markAllRead,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
