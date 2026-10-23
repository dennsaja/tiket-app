# Console pembaruan Android

Console `/admin/mobile-console` tersedia bagi **NOC dan Owner** melalui sidebar
**Console Android** setelah web diperbarui dari GitHub. Hak operator diperiksa
kembali terhadap akun aktif di database pada setiap permintaan API.

## Yang dapat dikirim tanpa APK

- Teks beranda (maksimal 140 karakter).
- Pengumuman tim (judul 80, isi 600 karakter); kosongkan isi untuk menyembunyikan.
- Tampilkan/sembunyikan grafik aktivitas.
- Jumlah tiket terbaru di beranda (1–8).
- Interval penyegaran tiket/chat pada layar utama (15–120 detik).

Perubahan data tiket, kategori, SLA, dan data server tetap memakai API yang ada.
Console ini tidak mengirim executable, DEX, JavaScript, atau pengganti kode native.
Perbaikan GPS/login, layar baru, dan perubahan kode Kotlin tetap membutuhkan rilis
APK. Pembaruan aplikasi melalui Google Play dapat mengurangi distribusi APK manual,
tetapi memerlukan distribusi dan integrasi Play tersendiri; itu tidak ditambahkan
dalam perubahan ini. Rujukan: https://developer.android.com/guide/playcore/in-app-updates

## Cara menggunakan

1. Perbarui web melalui **Pembaruan sistem**.
2. Bangun dan distribusikan **satu kali APK 3.3.0 (versionCode 12)** dengan sertifikat
   yang sama dengan aplikasi terpasang. Versi 3.2.0 belum memiliki pembaca konfigurasi.
3. Masuk sebagai NOC/Owner, buka **Console Android**.
4. Ubah isian, lihat pratinjau, pilih **Simpan draft**.
5. Isi catatan perubahan, pilih **Terbitkan pembaruan**. Draft yang belum disimpan
   tidak bisa diterbitkan; draft tersimpan belum dikirim ke perangkat.
6. Aplikasi online memeriksa konfigurasi saat layar utama dibuka (dibatasi sekali
   per 60 detik) dan setiap 60 detik selama layar utama aktif. Tab Akun menyediakan
   **Periksa pembaruan tampilan** untuk pemeriksaan manual. Saat berada di layar
   Detail tiket atau chat terpisah, pemeriksaan berlanjut setelah kembali.
7. Jika diperlukan, pilih **Pulihkan** pada riwayat. Ini menerbitkan isi versi lama
   sebagai versi baru dan mengganti draft. Untuk kembali ke kondisi awal, pilih
   **Gunakan pengaturan bawaan**, simpan, lalu terbitkan.

Pembaruan diterapkan ke komponen yang ada tanpa me-restart activity, mengosongkan
draft laporan/chat, atau mengubah kebijakan GPS. Interval data tidak mengatur GPS
atau polling notifikasi. Respons gagal atau konfigurasi yang tidak kompatibel
mempertahankan konfigurasi terakhir. Cache terikat sesi dan dibersihkan saat akun
berganti/logout. Cache dapat dipakai offline. Pengumuman ditampilkan sebagai teks.

## Penyimpanan dan publikasi

- Tabel `system_settings`, key `android_remote_config_v1`; tidak perlu migrasi baru.
- Satu draft, satu publikasi aktif, maksimal 20 riwayat publikasi.
- Lock transaksi database dan nomor revisi mencegah dua editor menimpa draft diam-diam.
- API `GET/POST /api/admin/mobile-console`: simpan/publikasi/pulihkan, dengan validasi,
  pembatasan ukuran 8 KiB, rate limit, serta log aktivitas.
- API `GET /api/mobile/config`: staf terautentikasi saja, respons `private, no-store`.
  Tidak mengekspos draft, riwayat, atau identitas operator.
- Protocol `schemaVersion: 1`, `minAppVersionCode: 12`; aplikasi memvalidasi semua
  isian dan batas ukuran sebelum menyimpan/menerapkan.
- Status di console adalah **publikasi server**, bukan bukti sudah diterima semua
  perangkat. Tidak ada push FCM, laporan penerimaan perangkat, atau pembaruan saat
  aplikasi ditutup dalam implementasi ini.

## Status distribusi perubahan ini

Source Android disiapkan untuk **3.3.0 / 12**. Sesuai permintaan, **tidak dijalankan
tes, lint, type-check, emulator, atau build**. Perubahan source langsung dikirim ke
GitHub. APK dan `public/downloads/version.json` tetap **3.2.0 / 11**; keduanya belum
diganti dan tidak boleh dianggap sebagai APK yang sudah mendukung console.

Saat APK 3.3.0 kelak dibangun, terbitkan APK bersama metadata versi, ukuran, dan
SHA-256 yang benar. Tidak cukup menaikkan metadata tanpa mengganti berkas APK.
