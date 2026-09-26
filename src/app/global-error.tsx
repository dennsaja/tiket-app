"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Global Root Error:", error);

    const isChunkError =
      error?.message?.includes("Loading chunk") ||
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Failed to fetch dynamically imported module");

    if (isChunkError && typeof window !== "undefined") {
      const storageKey = "chunk_reload_" + window.location.pathname;
      const lastReload = sessionStorage.getItem(storageKey);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="id">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white text-zinc-900 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4 shadow-xs">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Pembaruan Aplikasi Terdeteksi</h1>
        <p className="mt-1 text-xs text-zinc-500 max-w-sm">
          Aplikasi telah diperbarui ke versi terbaru. Silakan muat ulang halaman.
        </p>
        <div className="mt-5">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-md bg-black px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Muat Ulang Halaman
          </button>
        </div>
      </body>
    </html>
  );
}
