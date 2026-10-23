# Pembaruan data, bukti foto, dan penyelesaian tiket Android

Perubahan ini termasuk source Android 3.3.0 (12), yang belum dibangun atau diterbitkan.
Sesuai permintaan, tidak menjalankan tes, emulator, lint, type-check, atau build.
APK dan metadata unduhan tetap versi 3.2.0. Perbarui web dahulu, lalu bangun dan
distribusikan APK dengan sertifikat yang sama agar perbaikan native ini tersedia.

## Data otomatis

`GET /api/mobile/events` menyediakan SSE Bearer untuk staf aktif. Event tiket,
laporan, chat, dan notifikasi pribadi mengirim sinyal invalidasi tanpa isi data.
Aplikasi mengambil ulang melalui API yang sudah memeriksa akses tiket/chat.
Beranda/daftar tiket, detail tiket, dan chat tim berlangganan selama layar aktif;
koneksi ditutup saat layar ditinggalkan, tersambung ulang setelah putus, dan
dibuka ulang ketika pengguna kembali. Event beruntun digabung, permintaan yang
sedang berjalan tidak diduplikasi, dan invalidasi detail/tiket yang masuk saat
pengambilan berlangsung dijadwalkan kembali. Form laporan tidak ditimpa.

Heartbeat 15 detik menyediakan penyegaran cadangan bila perubahan berasal dari
worker lain. Polling sebelumnya juga tetap tersedia ketika streaming terhalang.
Jadi pembaruan dalam proses server yang sama didorong langsung; instalasi beberapa
worker tanpa bus bersama memakai penyegaran cadangan. Proxy perlu meneruskan SSE
tanpa buffering (`X-Accel-Buffering: no`). Tidak menambahkan layanan GPS baru.

## Tambah gambar

Bagian before/after masing-masing memiliki satu tombol **Tambah gambar**. Chooser
Android menjalankan `ACTION_GET_CONTENT` untuk gambar, termasuk pilihan kamera
`ACTION_IMAGE_CAPTURE` dengan `EXTRA_OUTPUT` FileProvider dan izin URI sementara.
Pilihan yang terlihat mengikuti aplikasi yang tersedia di perangkat. Galeri
mendukung beberapa gambar; kamera memakai hasil berkas penuh. Penentuan tahap
before/after dan berkas kamera tetap disimpan saat activity dibuat ulang. Hasil
tetap melewati kompresi dan watermark waktu/GPS sebelum masuk draft.

Rujukan intent: https://developer.android.com/guide/components/intents-common

## Selesai dan idempotensi

- Tombol kirim terkunci sejak konfirmasi; ketukan/dialog ganda tidak memulai
  pengiriman kedua. Form pada tiket selesai disembunyikan dan kirim dinonaktifkan.
- Sukses online atau tersimpan dalam antrean offline menutup detail, menghapus
  draft, dan membuka tab **Tiket** dengan filter Semua agar status terbaru terlihat.
- Setiap pengiriman memiliki UUID tersimpan per akun/tiket sebelum HTTP. UUID sama
  dikirim melalui `Idempotency-Key`, termasuk retry dan unggahan antrean offline.
  Antrean menolak penambahan laporan pending kedua untuk tiket yang sama.
- Server mengunci baris tiket dalam transaksi PostgreSQL. Lampiran, laporan,
  status, riwayat, dan receipt `system_settings` disimpan atomik. Receipt diikat
  pada pengguna, tiket, dan key. Replay mengembalikan laporan sebelumnya tanpa
  menambahkan laporan/lampiran/riwayat/notifikasi.
- Tiket resolved/closed yang sudah memiliki laporan mengembalikan laporan terakhir
  juga untuk APK lama tanpa key. Tiket cancelled ditolak. Laporan baru dapat
  diserahkan setelah tiket dibuka kembali dengan key baru.
- Berkas baru dibersihkan jika transaksi gagal; notifikasi hanya dikirim setelah
  commit. Error validasi/otorisasi tetap ditampilkan; kegagalan jaringan dapat
  masuk antrean dengan UUID yang sama. Status pending lokal dipertahankan sampai
  sinkronisasi selesai.

Tidak ada perubahan skema database. Receipt menggunakan key hash dalam tabel
`system_settings` yang sudah ada. Receipt dipertahankan agar replay tetap aman
setelah restart server; tidak menyimpan token atau isi foto dalam receipt.
