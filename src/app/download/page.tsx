import * as React from "react";
import Link from "next/link";
import {
  Smartphone,
  Download,
  MapPin,
  ShieldCheck,
  Zap,
  PhoneCall,
  CheckCircle2,
  Navigation,
  ArrowLeft,
} from "lucide-react";

export const metadata = {
  title: "Download Aplikasi Android Teknisi | HelpDesk",
  description: "Unduh aplikasi Android resmi HelpDesk Teknisi untuk pelacakan GPS lapangan realtime",
};

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="max-w-2xl w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Web HelpDesk</span>
        </Link>

        {/* Header Badge & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Aplikasi Resmi Teknisi v1.0.0
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-1">
              HelpDesk Teknisi Lapangan
            </h1>
          </div>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
          Aplikasi Android khusus teknisi lapangan dengan fitur <strong>Background GPS Tracking</strong>, 
          sehingga koordinat pergerakan Anda tetap terkirim secara berkala ke peta dispatcher Admin meskipun 
          layar HP terkunci atau saat berkendara.
        </p>

        {/* Primary Download Button */}
        <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <p className="font-semibold text-sm text-sky-950 dark:text-sky-100">
              File Paket Instalasi Android (.APK)
            </p>
            <p className="text-xs text-sky-750 dark:text-sky-300">
              Ukuran: ~6.5 MB • Kompatibel: Android 8.0 s/d Android 15/16
            </p>
          </div>
          <a
            href="/downloads/helpdesk-teknisi.apk"
            download="helpdesk-teknisi.apk"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-5 py-3 text-sm font-bold shadow-md transition-all active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>Download APK Sekarang</span>
          </a>
        </div>

        {/* Features List */}
        <div className="space-y-4 mb-8">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Keunggulan Aplikasi Android Dibandingkan Web:
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex gap-2.5">
              <Navigation className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5">
                  Foreground GPS Tracking
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Tetap melacak lokasi di latar belakang tanpa dibekukan browser saat layar HP mati di saku.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex gap-2.5">
              <ShieldCheck className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5">
                  Izin Lokasi Resmi Android
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Tidak lagi terkendala pemblokiran izin oleh browser Chrome / error HTTPS IP.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex gap-2.5">
              <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5">
                  Navigasi 1-Klik Google Maps
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Ketuk tombol "Rute Maps" pada kartu tiket untuk langsung membuka navigasi rute ke pelanggan.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex gap-2.5">
              <PhoneCall className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5">
                  Panggil Pelanggan Langsung
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400">
                  Tombol cepat untuk menelepon atau menghubungi nomor telepon pelapor tiket.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Steps */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Cara Pasang di HP Android:
          </h2>

          <ol className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                Ketuk tombol <strong>Download APK Sekarang</strong> di atas.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>
                Setelah unduhan selesai, buka file <code>helpdesk-teknisi.apk</code>. Jika muncul peringatan keamanan, pilih <strong>Tetap Install / Izinkan dari sumber ini</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>
                Buka aplikasi <strong>HelpDesk Teknisi</strong>, pastikan Server URL terisi <code>https://helpdesk.infinityteknik.net</code>, lalu masuk dengan email dan kata sandi teknisi Anda.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <span>
                Saat aplikasi meminta izin lokasi, pilih <strong>"Saat aplikasi digunakan"</strong> atau <strong>"Izinkan sepanjang waktu"</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                ✓
              </span>
              <span>
                Aktifkan sakelar <strong>Sedang Dinas (GPS Aktif)</strong>. Lokasi Anda kini otomatis terpantau di live map Admin!
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
