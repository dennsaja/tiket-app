"use client";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";
const LiveDispatcherMap = dynamic(() => import("./live-dispatcher-map"), { ssr: false, loading: () => <div className="flex h-[calc(100dvh-180px)] min-h-[560px] items-center justify-center rounded-3xl border border-[var(--border-color)] bg-[var(--surface)]"><Spinner size="md" /></div> });
export default function AdminLiveMapPage() {
  return <div className="space-y-4"><header><h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">Tracking teknisi</h1><p className="mt-1 text-xs text-[var(--text-muted)]">Lokasi tim, tiket aktif, dan jalur jaringan dalam satu peta.</p></header><LiveDispatcherMap /></div>;
}
