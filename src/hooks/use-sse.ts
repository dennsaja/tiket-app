"use client";

import * as React from "react";

export type SSEEvent = {
  type: string;
  data: any;
};

interface UseSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  enabled?: boolean;
}

/**
 * Shared EventSource per URL — multiple components (notification manager, live map, ...)
 * reuse a single connection instead of each opening their own.
 */
type Channel = {
  es: EventSource | null;
  listeners: Set<(e: SSEEvent) => void>;
  statusListeners: Set<(connected: boolean) => void>;
  connected: boolean;
  retries: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

const channels = new Map<string, Channel>();

function setConnected(ch: Channel, value: boolean) {
  ch.connected = value;
  ch.statusListeners.forEach((fn) => fn(value));
}

function openChannel(url: string, ch: Channel) {
  if (ch.es) return;
  const es = new EventSource(url);
  ch.es = es;

  es.onopen = () => {
    ch.retries = 0;
    setConnected(ch, true);
  };

  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data) as SSEEvent;
      ch.listeners.forEach((fn) => fn(parsed));
    } catch {
      // Non-JSON message
    }
  };

  es.onerror = () => {
    setConnected(ch, false);
    es.close();
    ch.es = null;
    if (ch.listeners.size === 0) return;
    // Exponential backoff reconnect (max 30s)
    const delay = Math.min(1000 * Math.pow(2, ch.retries), 30000);
    ch.retries += 1;
    ch.reconnectTimer = setTimeout(() => {
      ch.reconnectTimer = null;
      if (ch.listeners.size > 0) openChannel(url, ch);
    }, delay);
  };
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { onEvent, enabled = true } = options;
  const [connected, setConnectedState] = React.useState(false);
  const [lastEvent, setLastEvent] = React.useState<SSEEvent | null>(null);
  const onEventRef = React.useRef(onEvent);

  React.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let ch = channels.get(url);
    if (!ch) {
      ch = {
        es: null,
        listeners: new Set(),
        statusListeners: new Set(),
        connected: false,
        retries: 0,
        reconnectTimer: null,
      };
      channels.set(url, ch);
    }

    const listener = (evt: SSEEvent) => {
      setLastEvent(evt);
      onEventRef.current?.(evt);
    };
    const statusListener = (value: boolean) => setConnectedState(value);

    ch.listeners.add(listener);
    ch.statusListeners.add(statusListener);
    setConnectedState(ch.connected);
    openChannel(url, ch);

    return () => {
      const current = channels.get(url);
      if (!current) return;
      current.listeners.delete(listener);
      current.statusListeners.delete(statusListener);
      if (current.listeners.size === 0) {
        current.es?.close();
        current.es = null;
        if (current.reconnectTimer) clearTimeout(current.reconnectTimer);
        channels.delete(url);
      }
    };
  }, [url, enabled]);

  return { connected, lastEvent };
}
