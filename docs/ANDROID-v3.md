# Android HelpDesk 3.0

Pembaruan ini menyamakan aplikasi teknisi dengan desain web: latar gelap, kartu membulat, aksen biru, metrik utama putih, grafik batang, dan navigasi Ringkasan / Tiket / Peta / Akun.

## Penggunaan

- Splash dan halaman login baru. Alamat helpdesk ditetapkan ke `https://helpdesk.infinityteknik.net`; kolom server dihapus.
- **Lanjutkan lewat web** membuka browser eksternal. Login web mengembalikan pengguna ke aplikasi, lalu aplikasi memverifikasi profil melalui server. Tersedia tombol pembuka aplikasi jika browser membatasi pembukaan otomatis.
- Login langsung memakai **email akun helpdesk dan password** yang sama seperti web. Model akun saat ini menggunakan email, belum memiliki kolom username tersendiri.
- Penanganan disingkat menjadi **Mulai pengerjaan → Isi laporan & selesaikan**. Check-in radius, barcode eksternal, dan tombol workflow ganda dihapus. Status lama tetap dapat dibaca.
- Checklist, detail teknis, dan konfirmasi pelanggan berada di bagian opsional. Navigasi jalan tetap membuka aplikasi peta; tampilan Peta di aplikasi menunjukkan sebaran koordinat yang tersedia.
- Draf teks dan referensi foto disimpan per akun. Antrean offline disinkronkan berurutan dan hanya entri yang sudah berhasil yang dihapus.

## GPS dan sesi

- GPS memerlukan akun teknisi, tiket aktif, izin lokasi, dan layanan lokasi perangkat yang aktif. Menolak izin tidak menghalangi penggunaan tiket.
- Pembacaan lokasi dibatasi waktunya, diserialisasi, dan listener dilepas saat dibatalkan. Koordinat tidak valid, kedaluwarsa, atau tidak akurat tidak ditampilkan sebagai posisi terkini.
- Layanan sinkronisasi dapat tetap berjalan tanpa izin GPS. Jenis foreground service dipilih sesuai izin, termasuk pembatasan Android 14.
- Logout membersihkan sesi/lokasi dan menghentikan layanan. Draf akun tetap tersedia saat akun yang sama masuk kembali.
- Callback login memerlukan state acak dari aplikasi yang cocok dan belum kedaluwarsa. Identitas dan hak akses dibaca dari server, bukan parameter callback.

## Rilis dan verifikasi

Pasang pembaruan **web terlebih dahulu**, lalu distribusikan APK 3.0.0 (versionCode 9). APK baru memerlukan halaman `/mobile-auth` yang mengembalikan state login. Halaman web masih menerima alur APK lama tanpa state selama perpindahan versi.

Perintah pemeriksaan:

```powershell
./android-technician/gradlew.bat -p android-technician assembleDebug testDebugUnitTest lintDebug --max-workers=2
npm run type-check
npm test
npm run build
```

Hasil Android: build berhasil, 11 tes lulus, lint 0 error. Masih ada peringatan lint, terutama teks lokal yang belum dipindahkan ke resource terjemahan dan aksesibilitas/tata letak lama; peringatan tersebut tidak disembunyikan lewat baseline atau penonaktifan lint.

Hasil web: pemeriksaan tipe, 30 tes, dan build produksi berhasil, termasuk halaman penghubung login browser dan halaman unduhan APK.

Tes Android mencakup validasi dan umur koordinat, syarat pelacakan GPS, state callback, penolakan callback tanpa sesi login dari aplikasi, browser eksternal, alamat server tetap, password yang mengandung spasi, kesalahan HTTP, dan isolasi draf/foto antar akun.

Uji emulator Android 7 menggunakan data tiket lokal: splash, login, dashboard, daftar/detail tiket, formulir laporan, peta, dan akun. Aplikasi tetap berjalan saat izin lokasi belum diberikan maupun saat kedua penyedia lokasi dimatikan; setelah izin diberikan layanan berhasil memperoleh lokasi dan menyimpan titik ketika offline. Tombol web membuka pemilih browser eksternal. Log crash aplikasi kosong pada pengujian akhir. Perbaikan font menggunakan referensi string untuk menghindari crash komponen tombol pada Android 7. Label GPS membedakan posisi terbaru dari kondisi menunggu jaringan.

Pengujian otomatis dan emulator tidak menggantikan uji lapangan pada perangkat teknisi: login akun asli melalui browser, penerimaan GPS di luar ruangan, pembatasan baterai vendor, kamera, serta pengiriman laporan ke server produksi tetap perlu diverifikasi pada perangkat yang digunakan.
