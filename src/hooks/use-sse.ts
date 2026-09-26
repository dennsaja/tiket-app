"use client";

import * as React from "react";

type SSEEvent = {
  type: string;
  data: unknown;
};

interface UseSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  enabled?: boolean;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { onEvent, enabled = true } = options;
  const [connected, setConnected] = React.useState(false);
  const [lastEvent, setLastEvent] = React.useState<SSEEvent | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const retriesRef = React.useRef(0);

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!cancelled) {
          setConnected(true);
          retriesRef.current = 0;
        }
      };

      es.onmessage = (e) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(e.data) as SSEEvent;
          setLastEvent(parsed);
          onEvent?.(parsed);
        } catch {
          // Non-JSON message
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        es.close();

        // Exponential backoff reconnect
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
        retriesRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      setConnected(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [url, enabled]);

  return { connected, lastEvent };
}
