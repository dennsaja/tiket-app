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
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 mb-4 shadow-xs">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Terjadi Kesalahan Sistem</h1>
      <p className="mt-1 text-xs text-gray-500 max-w-sm">
        Terjadi kendala yang tidak terduga saat memproses permintaan Anda.
      </p>
      {error.message && (
        <pre className="mt-3 max-w-md rounded bg-gray-100 p-2 text-left font-mono text-[11px] text-gray-700 overflow-x-auto">
          {error.message}
        </pre>
      )}
      <div className="mt-6 flex items-center gap-3">
        <Button
          size="md"
          variant="outline"
          onClick={() => reset()}
          leftIcon={<RotateCcw className="h-4 w-4" />}
        >
          Coba Lagi
        </Button>
        <Link href="/dashboard">
          <Button size="md" leftIcon={<Home className="h-4 w-4" />}>
            Beranda
          </Button>
        </Link>
      </div>
    </div>
  );
}
