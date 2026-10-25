# Bumper teknisi internet

Animasi ilustrasi orisinal, 5 detik, 1080 × 1080, 30 fps (150 frame), tanpa audio.

Teknisi menjepit konektor, menyambungkan kabel, lalu mengacungkan jempol saat router dan simbol Wi-Fi menyala. Warna hijau, teal, kuning, dan krem terinspirasi nuansa ilustrasi referensi. Tidak memakai logo atau aset Gojek.

## Pratinjau

Jalankan `npm install` lalu `npm run studio`. Pilih **TechnicianBumper**.

## Ekspor

Klik **Render** di Studio atau jalankan `npm run render` untuk membuat `out/technician-bumper.mp4` (H.264). Jalankan `npm run poster` untuk gambar sampul.

## Penyuntingan

Semua ilustrasi berupa SVG dalam `src/index.tsx`, sehingga tetap tajam saat diperbesar. Judul, pesan layanan, ilustrasi, dan titik tunggu berada pada lapisan terpisah di Studio. Gerakan berbasis frame dan tidak bergantung pada CSS animation.

Urutan waktu:
- 0–0,6 detik: ilustrasi dan judul masuk.
- 0,6–2,3 detik: teknisi menjepit konektor dua kali.
- 2,35–2,75 detik: ujung kabel tersambung.
- 2,9–3,6 detik: jempol, lampu router, dan Wi-Fi muncul.
- 3,6–5 detik: pose akhir ditahan.

Animasi ini bersifat ilustratif; status jaringan sebenarnya tetap dikendalikan oleh aplikasi.

## Versi dasbor Android

Komposisi **TechnicianDashboard** memakai ilustrasi tanpa judul/pesan pelanggan, ukuran 960 × 640, 30 fps, 5 detik. Pose kembali ke awal agar animasinya dapat diulang di kartu tugas.

Ekspor aset aplikasi dari folder ini:

```powershell
npx remotion render src/index.tsx TechnicianDashboard out/technician-dashboard.mp4 --codec=h264 --crf=21 --pixel-format=yuv420p --concurrency=2
npx remotion still src/index.tsx TechnicianDashboard out/dashboard-poster.png --frame=42
```

Salin video ke `android-technician/app/src/main/res/raw/technician_work_bumper.mp4` dan poster ke `android-technician/app/src/main/res/drawable-nodpi/technician_work_poster.png` dari akar repositori. Poster sengaja menampilkan proses perbaikan, sehingga gambar diam tidak menyatakan bahwa pekerjaan telah selesai.
