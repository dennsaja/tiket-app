import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Download, MapPin, Smartphone, MessageSquare, ShieldCheck, Camera } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import release from "../../../public/downloads/version.json";

export const metadata = {
  title: "Download HelpDesk Android " + release.versionName,
  description: "HelpDesk Android: tampilan selaras dengan web, login browser, tiket, chat tim, laporan foto, dan GPS otomatis saat ada pekerjaan aktif.",
};
const features = [
  { icon: Smartphone, title: "Workspace yang lebih ringkas", text: "Lima tab: Beranda, Tiket, Chat, Peta, dan Akun. Tampilan gelap, kartu statistik, dan transisi yang lebih halus." },
  { icon: Smartphone, title: "Popup pembaruan dari console", text: "Terima pemberitahuan konfigurasi terbaru dari pengelola, lalu pilih Terapkan sekarang. Konfirmasi penerapan tampil di console dan konfigurasi tersimpan untuk penggunaan offline." },
  { icon: ShieldCheck, title: "Login lewat browser atau akun", text: "Login di browser lalu kembali ke aplikasi, atau gunakan email dan kata sandi akun helpdesk. Alamat server sudah terpasang." },
  { icon: MapPin, title: "Lokasi sesuai pekerjaan", text: "GPS aktif untuk teknisi yang memiliki tiket belum selesai. Peta hanya menampilkan koordinat yang tersedia." },
  { icon: Camera, title: "Detail tiket, siap ditangani", text: "Terima tiket untuk langsung melihat pelapor, lokasi, subkategori, spesifikasi, dan lampiran admin. Laporan pekerjaan tetap dalam satu halaman." },
  { icon: MessageSquare, title: "Chat dan notifikasi tim", text: "Lihat grup sesuai penugasan, lanjutkan diskusi tim, dan tandai semua notifikasi dibaca dari aplikasi." },
  { icon: ShieldCheck, title: "Profil dan draf per akun", text: "Ubah nama, email, telepon, foto, dan kata sandi dari aplikasi. Draf tetap tersimpan per akun ketika offline." },
];
export default function DownloadPage() {
  return <main className="auth-page min-h-screen px-5 py-10 sm:py-16">
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard" className="mb-10 inline-flex items-center gap-2 text-xs text-[var(--text-muted)]"><ArrowLeft className="h-4 w-4" />Kembali ke helpdesk</Link>
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div className="max-w-xl"><BrandMark className="auth-brand mb-6" /><p className="mb-3 text-[10px] tracking-[.16em] text-[var(--text-muted)]">HELPDESK / ANDROID</p>
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--text)]">Workspace kamu,<br />siap dibawa ke lapangan.</h1>
          <p className="mt-5 text-sm leading-7 text-[var(--text-muted)]">Tampilan yang selaras dengan web, alur yang lebih singkat, dan alat yang kamu perlukan untuk menuntaskan pekerjaan.</p>
        </div>
        <div className="dashboard-panel w-full p-7 sm:w-72">
          <span className="metric-badge tone-success">Versi {release.versionName}</span>
          <h2 className="mt-4 text-xl font-medium">HelpDesk Teknisi</h2>
          <p className="mb-6 mt-2 text-xs text-[var(--text-muted)]">Android 6.0 atau lebih baru · Build {release.versionCode}</p>
          <a href={"/downloads/helpdesk-teknisi.apk?v=" + release.versionCode} download={"helpdesk-teknisi-" + release.versionName + ".apk"} className="primary-action w-full"><Download className="h-4 w-4" />Unduh APK<ArrowUpRight className="h-4 w-4" /></a>
          <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">Sudah punya versi lama? Pasang pembaruan ini tanpa menghapus aplikasi agar draf tetap tersimpan.</p>
        </div>
      </div>
      <section className="mt-12 grid gap-4 sm:grid-cols-2" aria-label="Fitur aplikasi">{features.map(({ icon: Icon, title, text }) => <article className="dashboard-panel p-6" key={title}><Icon className="mb-5 h-5 w-5 text-[var(--accent)]" /><h2 className="text-base font-medium">{title}</h2><p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">{text}</p></article>)}</section>
      <section className="dashboard-panel mt-6 p-7"><h2 className="text-lg font-medium">Mulai bekerja</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-[var(--text-secondary)]"><li>Unduh APK dan izinkan pemasangan dari browser bila Android memintanya.</li><li>Pilih “Lanjutkan lewat web” atau masuk dengan akun helpdesk kamu.</li><li>Izinkan lokasi saat ada pekerjaan aktif dan aktifkan notifikasi agar pembaruan tiket mudah diketahui.</li></ol><p className="mt-5 text-xs leading-6 text-[var(--text-muted)]">Untuk login browser pada versi ini, pastikan pembaruan web juga sudah diterapkan lewat menu Pembaruan Sistem.</p></section>
      <p className="mt-8 text-xs text-[var(--text-muted)]">HelpDesk / Your support, simplified.</p>
    </div>
  </main>;
}
