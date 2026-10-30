"use client";
import { apiFetch } from "@/lib/network/client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";

export default function MobileAuthBridgePage() {
  return <Suspense fallback={<main className="auth-page flex min-h-screen items-center justify-center text-sm text-[var(--text-muted)]">Menghubungkan akun ke aplikasi...</main>}><MobileAuthBridgeContent /></Suspense>;
}

function MobileAuthBridgeContent() {
  const { status } = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const state = search.get("state") || "";
  const validState = !state || /^[a-f0-9]{64}$/.test(state);
  const [error, setError] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!validState) return;
    const callbackPath = "/mobile-auth" + (state ? "?state=" + encodeURIComponent(state) : "");
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=" + encodeURIComponent(callbackPath));
      return;
    }
    if (status !== "authenticated") return;
    const controller = new AbortController();
    setError(null);
    setAppUrl(null);
    async function connectApp() {
      try {
        const response = await apiFetch("/api/mobile/auth/bridge", { method: "POST", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success || !data.token || !data.user?.id) {
          throw new Error(data.error || "Sesi belum dapat dihubungkan. Silakan coba lagi.");
        }
        const query = new URLSearchParams({
          token: data.token,
          id: data.user.id,
          name: data.user.name || "Teknisi",
          email: data.user.email || "",
          role: data.user.role || "agent",
        });
        if (state) query.set("state", state);
        setName(data.user.name || "Teknisi");
        setAppUrl("helpdesk://auth?" + query.toString());
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Periksa koneksi lalu coba lagi.");
      }
    }
    void connectApp();
    return () => controller.abort();
  }, [status, state, validState, retry, router]);

  useEffect(() => {
    if (!appUrl) return;
    const timer = window.setTimeout(() => { window.location.href = appUrl; }, 350);
    return () => window.clearTimeout(timer);
  }, [appUrl]);

  return <main className="auth-page flex min-h-screen items-center justify-center px-6 py-10">
    <div className="w-full max-w-[420px]">
      <BrandMark className="auth-brand mb-8" />
      <p className="mb-3 text-[10px] tracking-[.16em] text-[var(--text-muted)]">HELPDESK / ANDROID</p>
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">{appUrl ? "Akun terhubung." : "Kembali ke workspace."}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Gunakan akun helpdesk yang sama untuk melanjutkan pekerjaan di aplikasi.</p>
      <div className="auth-form-card mt-8 rounded-3xl border border-[var(--border-color)] p-7">
        {!validState ? <>
          <h2 className="font-medium">Tautan login tidak berlaku</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Kembali ke aplikasi Android lalu pilih “Lanjutkan lewat web” untuk memulai sesi baru.</p>
        </> : error ? <div role="alert">
          <h2 className="font-medium">Belum dapat menghubungkan akun</h2>
          <p className="my-4 text-sm leading-6 text-[var(--text-muted)]">{error}</p>
          <Button className="w-full" onClick={() => setRetry((value) => value + 1)}>Coba lagi</Button>
        </div> : appUrl ? <>
          <CheckCircle2 className="mb-4 h-9 w-9 text-[var(--success)]" />
          <h2 className="text-lg font-medium">Halo, {name}.</h2>
          <p className="my-4 text-sm leading-6 text-[var(--text-muted)]">Login berhasil. Aplikasi akan terbuka otomatis. Jika browser meminta izin, pilih buka HelpDesk.</p>
          <a href={appUrl} className="primary-action w-full"><Smartphone className="h-4 w-4" />Buka aplikasi HelpDesk<ArrowRight className="h-4 w-4" /></a>
          <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">Jika tautan kedaluwarsa, mulai login lagi dari aplikasi.</p>
        </> : <div role="status" className="flex items-center gap-3 py-7 text-sm text-[var(--text-muted)]"><Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />{status === "unauthenticated" ? "Membuka halaman login..." : "Menghubungkan akun ke aplikasi..."}</div>}
      </div>
      <p className="mt-8 text-xs text-[var(--text-muted)]">HelpDesk / Your support, simplified.</p>
    </div>
  </main>;
}
