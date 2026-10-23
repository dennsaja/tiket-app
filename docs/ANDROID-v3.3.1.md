# Android 3.3.1 (13): console dan popup pembaruan

Rilis ini menyertakan pembaca konfigurasi console, popup, realtime tiket/chat,
pemilih gambar gabungan, serta penyelesaian laporan dengan idempotensi dari source
3.3.0 yang sebelumnya belum didistribusikan sebagai APK.

## Penyebab yang ditemukan dari pemeriksaan source

- APK unduhan sebelumnya masih 3.2.0 (11), tanpa pembaca console.
- Publikasi tersimpan di server tetapi belum mengirim event konfigurasi ke APK.
- Event realtime di APK memperbarui tiket/chat saja; konfigurasi dibatasi pemeriksaan
  berkala dan tidak menampilkan popup.
- Console belum memiliki konfirmasi penerapan dari aplikasi, dan tombol publikasi
  menolak konfigurasi yang sama sehingga operator tidak bisa mengirim ulang versi.

## Alur baru

1. Perbarui web dari GitHub, lalu satu kali pasang APK 3.3.1 dengan sertifikat yang
   sama. APK 3.2.0 tidak bisa mendapatkan kemampuan native baru lewat console.
2. NOC/Owner membuka Console Android, menyimpan draft, mengisi catatan perubahan,
   kemudian menerbitkan. Konfigurasi yang sama boleh diterbitkan ulang.
3. Setelah commit database, server mengirim event khusus konfigurasi; SSE meneruskan
   invalidasi ke APK. Heartbeat 15 detik mengatasi perbedaan worker/proses. Polling
   60 detik tetap digunakan saat koneksi realtime terhalang.
4. Di layar utama APK yang online muncul **Pembaruan tersedia**, nomor versi dan
   catatan perubahan, dengan **Terapkan sekarang** / **Nanti**. Jika ditunda, popup
   versi yang sama tidak berulang pada activity itu; tombol Akun dapat memeriksa
   dan menawarkannya lagi. Kembali membuka aplikasi juga memeriksa konfigurasi.
5. Setelah diterapkan, aplikasi menyimpan cache dan mengirim ACK terautentikasi.
   Console menampilkan akun, versi APK, versi konfigurasi, dan waktu konfirmasi
   terakhir per akun. Tabel diperbarui setiap 15 detik, maksimal 250 akun terakhir.
   Konfirmasi ini bukan daftar semua perangkat, status online, atau bukti semua
   teknisi telah memasang versi terbaru.
6. Respons konfigurasi juga membawa metadata APK terbit. Jika versionCode melebihi
   aplikasi terpasang, APK menampilkan **Versi aplikasi baru tersedia** dan tombol
   **Buka pembaruan** menuju halaman unduh helpdesk. APK tidak dipasang diam-diam.

Konfigurasi tetap bersifat deklaratif (konten/tampilan/interval yang didukung).
Perubahan kode Kotlin tetap membutuhkan APK. Tidak ada FCM atau notifikasi saat
aplikasi ditutup; popup konfigurasi muncul di layar utama, termasuk setelah kembali
dari detail tiket/chat. Draft laporan dan antrean offline tetap tersimpan.

## Penyimpanan

Tidak perlu perubahan skema. Publikasi memakai `android_remote_config_v1` dalam
`system_settings`; konfirmasi memakai `android_config_receipt:<userId>`. Pengguna
hanya bisa mengonfirmasi untuk identitasnya sendiri, bukan mengirim identitas
operator/perangkat lain. ACK hanya mengakui versi terbit/default/riwayat yang valid.

## Distribusi dan verifikasi

Build hanya `assembleRelease`, tanpa test, lint, emulator, atau uji interaksi sesuai
permintaan pengguna. APK dipublikasikan bersama version.json yang memuat versi,
ukuran, SHA-256 dan catatan perubahan. Keberhasilan pemakaian pada server/perangkat
produksi belum dikonfirmasi melalui uji langsung; lihat ACK pada console setelah
web diperbarui dan APK dipasang.

Artefak release: `public/downloads/helpdesk-teknisi.apk`, 5.589.146 byte,
SHA-256 `8a16ed5396cbadf5964cdd0b58e2bcbdf07d84582c0af1d6787f1b70b40109fc`.
`assembleRelease` berhasil. Pengemasan dilanjutkan dengan batas memori lebih kecil
setelah JVM pertama berhenti karena memori host tidak cukup. Tidak ada tes/lint
atau emulator yang dijalankan.
