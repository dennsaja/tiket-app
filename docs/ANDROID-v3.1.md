# Android 3.1.0 — ruang kerja produksi

- Lima menu bawah: Beranda, Tiket, Chat, Peta, Akun. Kartu lebih ringkas, aksen biru, detail gradien, avatar, dan transisi lembut mengikuti referensi web. Animasi menghormati pengaturan gerakan sistem.
- Detail dan formulir laporan berada dalam satu halaman. Laporan terkirim ditampilkan bersama tindakan, hasil, serta foto bukti yang dapat dibuka dari aplikasi.
- Grup chat menggunakan API yang sama seperti web. Teknisi hanya dapat melihat tiket penugasannya, termasuk anggota tim pendamping; NOC/admin/owner mengikuti akses staf mereka. Grup tidak dibatasi menjadi 50 tiket pertama. Percakapan memakai bubble pengirim/penerima, avatar, tanggal, dan waktu WIB. Draf serta percakapan tersimpan dipisahkan per akun.
- Semua peran staf dapat mengubah nama, email, telepon, foto, dan kata sandi sendiri melalui Akun → Edit profil. Pergantian email/kata sandi memerlukan kata sandi saat ini. Peran dan izin tidak dapat diubah melalui formulir profil.
- Foto profil divalidasi dan diubah menjadi JPEG terukur di server. Foto laporan dapat dimuat memakai autentikasi APK, tanpa membuka akses lampiran menjadi publik.

## Pembaruan dan data contoh

Perbarui web terlebih dahulu, lalu pasang APK 3.1.0 (versionCode 10). Pembaruan web menjalankan `scripts/production-cleanup.ts --apply` melalui `update-hooks.json`.

Pembersihan mencocokkan lima judul **dan deskripsi persis** dari seed lama, dengan pemohon `user@helpdesk.local`. Sebelum penghapusan, tiket dan baris terkait diarsipkan dalam transaksi yang sama di `production_cleanup_archive`. Tiket asli, akun, dan urutan nomor tiket dipertahankan. Jika tidak ada kecocokan, tidak ada tiket yang dihapus. Data demo tidak dibuat lagi oleh seed produksi. Akun contoh lama tidak dihapus otomatis agar tidak mengunci administrator yang masih menggunakannya; gunakan identitas dan kata sandi pribadi sebelum penggunaan produksi.

Database produksi tidak diakses dari komputer pengembangan. Jumlah tiket yang dibersihkan dan ID arsip muncul dalam keluaran hook saat pembaruan dijalankan di server. Jangan menyatakan penghapusan di server selesai sebelum melihat keluaran tersebut.

## Verifikasi akhir

Pemeriksaan dilakukan setelah implementasi selesai. Pengujian Android dibatasi ke Android 11 (API 30), termasuk emulator dan tes aktivitas. Kasus utama: navigasi lima menu, detail/laporan satu halaman, daftar grup sesuai akun, percakapan, profil, penyimpanan draf, dan kondisi lokasi/offline. Tidak ada fixture tiket demo yang disertakan dalam APK produksi.

Hasil pemeriksaan otomatis: build produksi dan pemeriksaan tipe web berhasil, 43 tes web/API lulus, 15 tes Android lulus pada konfigurasi API 30, dan lint Android selesai tanpa error. Peringatan lint lama/nonfatal tetap ditampilkan. APK distribusi menggunakan build release yang tidak dapat di-debug. Sertifikat penandatanganan dipertahankan dari APK sebelumnya sehingga pembaruan dapat dipasang tanpa menghapus aplikasi. Simpan keystore lokal secara privat untuk rilis selanjutnya; jangan mengganti kunci ketika membangun pembaruan.
