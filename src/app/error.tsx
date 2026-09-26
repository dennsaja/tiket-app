"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Unhandled error:", error);
    
    // Auto reload on chunk load failure (happens when new build is deployed)
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

  const isChunk =
    error?.message?.includes("Loading chunk") ||
    error?.name === "ChunkLoadError";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-black px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 mb-4 shadow-xs">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        {isChunk ? "Pembaruan Versi Terdeteksi" : "Terjadi Kesalahan Sistem"}
      </h1>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
        {isChunk
          ? "Sistem baru saja diperbarui. Muat ulang halaman untuk memuat versi aplikasi terbaru."
          : "Terjadi kendala yang tidak terduga saat memproses permintaan Anda."}
      </p>
      {error.message && (
        <pre className="mt-3 max-w-md rounded-md bg-zinc-100 dark:bg-zinc-900 p-2.5 text-left font-mono text-[11px] text-zinc-600 dark:text-zinc-400 overflow-x-auto border border-zinc-200 dark:border-zinc-800">
          {error.message}
        </pre>
      )}
      <div className="mt-5 flex items-center gap-2.5">
        <Button
          size="sm"
          onClick={() => {
            if (isChunk) {
              window.location.reload();
            } else {
              reset();
            }
          }}
          leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
        >
          {isChunk ? "Muat Ulang Halaman" : "Coba Lagi"}
        </Button>
        <Link href="/dashboard">
          <Button size="sm" variant="outline" leftIcon={<Home className="h-3.5 w-3.5" />}>
            Beranda
          </Button>
        </Link>
      </div>
    </div>
  );
}
