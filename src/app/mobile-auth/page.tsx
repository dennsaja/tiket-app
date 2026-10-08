"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Smartphone, CheckCircle2, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function MobileAuthBridgePage() {
  const { data: session, status } = useSession();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = React.useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = React.useState(false);
  const [techName, setTechName] = React.useState<string>("");

  // Helper to trigger redirection to custom android scheme
  const triggerAppRedirect = React.useCallback(
    (token: string, user: { id: string; name: string; email: string; role: string }) => {
      const url = `helpdesk://auth?token=${encodeURIComponent(token)}&id=${encodeURIComponent(
        user.id
      )}&name=${encodeURIComponent(user.name || "Teknisi")}&email=${encodeURIComponent(
        user.email
      )}&role=${encodeURIComponent(user.role || "agent")}`;

      setDeepLinkUrl(url);
      setAuthSuccess(true);
      setTechName(user.name || "Teknisi");

      // Auto-trigger intent
      setTimeout(() => {
        window.location.href = url;
      }, 400);
    },
    []
  );

  // If already logged in via web session, generate mobile token automatically
  React.useEffect(() => {
    if (status === "authenticated" && session?.user && !authSuccess) {
      setLoading(true);
      fetch("/api/mobile/auth/bridge", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          setLoading(false);
          if (data.success && data.token) {
            triggerAppRedirect(data.token, data.user);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [status, session, authSuccess, triggerAppRedirect]);

  // Handle direct login from this mobile bridge page
  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email dan kata sandi wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/mobile/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok || !data.success) {
        setError(data.error || "Email atau kata sandi tidak valid");
        return;
      }

      triggerAppRedirect(data.token, data.user);
    } catch {
      setLoading(false);
      setError("Gagal terhubung ke server. Periksa jaringan Anda.");
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black shadow-md">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Masuk HelpDesk Teknisi
            </h1>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Sinkronisasi otentikasi web dengan aplikasi mobile
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
          {authSuccess ? (
            /* SUCCESS STATE: Redirecting */
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Login Berhasil!
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Halo, <strong>{techName}</strong>. Sedang membuka aplikasi HelpDesk Teknisi...
                </p>
              </div>

              {deepLinkUrl && (
                <div className="pt-2">
                  <a
                    href={deepLinkUrl}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 px-4 py-3 text-xs font-bold transition-all shadow-xs"
                  >
                    <span>Buka Aplikasi Sekarang</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <p className="text-[11px] text-zinc-400 mt-2">
                    Jika aplikasi tidak terbuka otomatis, ketuk tombol di atas.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* LOGIN FORM */
            <form onSubmit={handleFormLogin} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Email Teknisi
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teknisi@infinityteknik.net"
                  required
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun"
                    required
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2.5 pr-10 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 px-4 py-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span>Memproses Masuk...</span>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Masuk &amp; Buka Aplikasi</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          Infinity Teknik &amp; IT HelpDesk Portal • 2026
        </p>
      </div>
    </div>
  );
}
