# HelpDesk Android 3.6.1 (17)

Beranda teknisi menampilkan kartu tugas berjalan saat ada tiket dengan status `in_progress` atau `on_site`. Tiket yang sedang dikerjakan diprioritaskan, lalu pembaruan terbaru. Tugas yang baru ditugaskan, diterima, menunggu, dan selesai tetap berada di daftar tiket. Kartu tidak ditampilkan untuk owner, admin, atau NOC.

Kartu memuat status asli tiket, ilustrasi teknisi memperbaiki kabel, judul dan nomor tiket, pelanggan, serta tombol **Lanjutkan tugas**. Jumlah tugas membuka filter Dikerjakan. Tombol melanjutkan membuka laporan untuk tiket yang sedang dikerjakan dan halaman detail untuk tiket di lokasi. Perubahan status tiket tetap mengikuti alur aplikasi yang sudah ada; animasi tidak mengubah status pekerjaan.

Video H.264 960 × 640, 30 fps, 5 detik, tanpa audio, disertakan di APK. Pemutaran memakai TextureView dan MediaPlayer Android, tanpa koneksi atau WebView. Pemutar dilepas ketika kartu tersembunyi, berada di luar area gulir, aplikasi dijeda, atau pengguna pindah menu. Gambar proses perbaikan menjadi fallback saat hemat daya, animasi sistem dinonaktifkan, atau decoder gagal.

Sumber animasi: `motion/technician-bumper/src/index.tsx`, komposisi `TechnicianDashboard`. Panduan ekspor aset ada di README proyek motion.

Build rilis tetap menggunakan sertifikat aplikasi yang sudah ada. Jalankan `scripts/android-release-manifest.ts` setelah membangun APK agar unduhan dan fingerprint sumber sesuai. Distribusi ke perangkat memerlukan APK baru; konfigurasi console saja tidak dapat menambahkan kartu native ini.
