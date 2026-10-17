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
  Bell,
  Camera,
  MessageSquare,
  Flame,
  Clock,
  Sparkles,
  Layers,
} from "lucide-react";

export const metadata = {
  title: "Download Aplikasi Android Teknisi v1.6.0 | HelpDesk",
  description:
    "Unduh aplikasi Android resmi HelpDesk Teknisi v1.6.0 dengan notifikasi real-time, alur kerja progresif, kamera before-after, dan GPS hemat daya.",
};

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="max-w-3xl w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Web HelpDesk</span>
        </Link>

        {/* Header Badge & Title */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="h-14 w-14 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0 shadow-md">
            <svg
              className="h-7 w-7 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 3L22 20H2L12 3Z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Versi Rilis Terbaru v1.6.0
              </span>
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Update Oktober 2026
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-1">
              HelpDesk Teknisi Lapangan
            </h1>
          </div>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
          Aplikasi resmi teknisi dengan dukungan <strong>Notifikasi Real-Time</strong> (Status Bar,
          Notification Drawer &amp; Heads-Up Pop-up), alur tiket terarah (terima hingga selesai),
          dokumentasi foto kamera/galeri Sebelum &amp; Sesudah (Before &amp; After), serta{" "}
          <strong>Pelacakan GPS Hemat Daya 1 Menit (Anti Panas)</strong>.
        </p>

        {/* Primary Download Banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 border border-sky-200 dark:border-sky-800 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-sky-950 dark:text-sky-100">
                Paket Instalasi Android APK (v1.6.0)
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-200/70 dark:bg-sky-800/60 text-sky-800 dark:text-sky-200">
                Build Resmi
              </span>
            </div>
            <p className="text-xs text-sky-800 dark:text-sky-300 mt-1">
              Ukuran: ~6.8 MB • Target: Android 8.0 s/d Android 15/16 • Bebas Panas &amp; Irit Baterai
            </p>
          </div>
          <a
            href="/downloads/helpdesk-teknisi.apk"
            download="helpdesk-teknisi-v1.6.0.apk"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3.5 text-sm font-bold shadow-lg transition-all active:scale-95 shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Unduh APK v1.6.0</span>
          </a>
        </div>

        {/* Feature Highlights Grid */}
        <div className="space-y-4 mb-8">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Fitur Utama &amp; Pembaruan v1.6.0:
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            {/* 1. Full Notification System */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5 text-xs">
                  Notifikasi Real-Time Lengkap
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Status Bar (ikon segitiga web), Panel Drawer dengan tombol &quot;Detail&quot; &amp; &quot;Chat Tim&quot;, serta Pop-up Heads-Up bersuara &amp; bergetar saat layar menyala.
                </span>
              </div>
            </div>

            {/* 2. Web-Aligned Progressive Stepper */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5 text-xs">
                  Alur Bertahap Terarah (Progressive)
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Tombol diawali dengan <em>1. Terima Tiket</em> ➔ <em>2. Tiba di Lokasi</em> ➔ <em>3. Mulai Pengerjaan</em> ➔ <em>4. Selesai</em> yang selaras 100% dengan Web.
                </span>
              </div>
            </div>

            {/* 3. Camera & Gallery Before-After */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5 text-xs">
                  Foto Dokumentasi Before &amp; After
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Pilihan langsung dari Kamera atau Galeri untuk foto kondisi awal gangguan dan bukti hasil tuntas perbaikan sebelum tiket diselesaikan.
                </span>
              </div>
            </div>

            {/* 4. Thermal-Safe GPS */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5 text-xs">
                  GPS 1 Menit (Anti Panas &amp; Irit)
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Hardware GPS hanya aktif sesaat tiap 60 detik lalu tidur kembali. HP tetap dingin, baterai tahan seharian, dengan rute warna unik per teknisi.
                </span>
              </div>
            </div>

            {/* 5. Team Chat Shortcut */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5 text-xs">
                  Ruang Chat Tim &amp; Catatan Khusus
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Koordinasi cepat dengan tim NOC dan dispatcher langsung di dalam tiket dengan auto-sync otomatis tiap 4 detik.
                </span>
              </div>
            </div>

            {/* 6. Schedule Auto On/Off */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-zinc-900 dark:text-zinc-100 block mb-0.5 text-xs">
                  Otomatisasi Jadwal Dinas
                </strong>
                <span className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Auto-ON pada jam 08:00 WIB atau saat ada tiket aktif, dan auto-OFF setelah jam 16:00 WIB saat semua tugas telah tuntas.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Steps */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Langkah Pemasangan di HP Android:
          </h2>

          <ol className="space-y-3.5 text-xs text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                Ketuk tombol <strong>Unduh APK v1.6.0</strong> di atas. Jika Anda sudah menginstal versi lama, cukup instal file baru ini untuk memperbarui (tidak perlu uninstall).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>
                Setelah unduhan selesai, buka file <code>helpdesk-teknisi.apk</code>. Bila muncul konfirmasi keamanan Play Protect / browser, pilih <strong>Tetap Install / Izinkan dari sumber ini</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>
                Buka aplikasi <strong>HelpDesk Teknisi</strong>, Anda dapat masuk melalui <strong>Login via Web (SSO 1-Klik)</strong> atau memasukkan email dan password akun teknisi Anda.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <span>
                Saat aplikasi meminta izin, berikan izin <strong>Lokasi (Sepanjang Waktu/Saat Digunakan)</strong> dan izin <strong>Notifikasi</strong> agar notifikasi popup dan nada dering berfungsi maksimal.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] items-center justify-center shrink-0 mt-0.5">
                ✓
              </span>
              <span>
                Aktifkan sakelar <strong>Sedang Dinas</strong>. Notifikasi chat tim dan penugasan tiket akan otomatis muncul di status bar dan popup layar Anda!
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
