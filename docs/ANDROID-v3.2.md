# Android 3.2.0 — detail penugasan dan notifikasi

- Tombol **Terima tiket** pada daftar membuka **Detail tiket** sekaligus menyimpan status diterima. Perubahan ketika offline masuk antrean akun dan tidak ditimpa oleh penyegaran detail. Daftar tiket membaca ulang cache terbaru saat koneksi terputus agar status setelah kembali dari detail tetap benar.
- Ringkasan pekerjaan memakai kartu putih, tipografi lebih jelas, serta kartu gelap dengan aksen biru. Data pelapor, telepon, alamat, spesifikasi tiap jenis pekerjaan, kategori/subkategori, dan lampiran admin ditampilkan jika diisi. Laporan tetap berada di halaman yang sama.
- Spesifikasi dan daftar lampiran ikut disimpan dalam cache tiket. Foto memakai autentikasi aplikasi; dokumen diunduh dengan autentikasi ke cache privat lalu dibuka melalui izin berkas sementara.
- Panel lonceng menyediakan **Tandai semua dibaca**. Tombol menunggu penyimpanan server berhasil dan memperbarui cache lokal bersama proses sinkronisasi agar status lama tidak menimpa hasilnya. Kegagalan koneksi ditampilkan tanpa mengaku telah tersimpan.
- Navbar web memakai endpoint penyimpanan notifikasi yang benar dan jumlah belum dibaca dari server. Respons daftar notifikasi tidak di-cache.

## Subkategori dan SLA

Pembaruan web menjalankan `scripts/prepare-workspace.ts` setelah pembersihan demo. Lima kategori layanan memiliki 26 subkategori: PSB (5), perbaikan infrastruktur (6), pemasangan CCTV (5), perbaikan CCTV (5), dan maintenance (5). Formulir memilih kategori layanan sesuai jenis tiket, menyediakan pilihan subkategori, dan server memeriksa hubungan kategori/subkategori. Kategori buatan NOC tetap dapat digunakan.

Penghapusan seluruh kebijakan SLA, tenggat tiket, dan event SLA lama berjalan **sekali**, dalam satu transaksi. Snapshot disimpan di `production_cleanup_archive` dengan alasan `helpdesk-sla-reset-2026-10-v1`. Pembaruan berikutnya melewati reset ini sehingga kebijakan baru milik NOC tetap tersimpan. Seed tidak menambahkan SLA bawaan lagi. Nama kebijakan, tiket asli, dan data jaringan tidak dikirim ke log.

Perbarui web terlebih dahulu, lalu pasang APK versi 3.2.0 (versionCode 11). Database server tidak terhubung dari lingkungan pengembangan; penghapusan SLA produksi baru terkonfirmasi setelah keluaran hook di server menunjukkan keberhasilan.

## Peta tracking

Gaya pustaka peta sebelumnya dapat mengubah posisi container menjadi relatif dan mengecilkan kanvas. Posisi dan ukuran kanvas kini ditentukan secara eksplisit. Loader mempunyai batas waktu; kegagalan CDN/WebGL/style beralih otomatis ke mesin 2D yang dibundel dengan aplikasi. Titik, jalur, pencarian, filter, navigasi, dan pin teknisi dipertahankan. Kedua mode satelit menggunakan batas zoom gambar asli 17 dan memperbesar gambar tersedia saat zoom lebih dekat.

Pemeriksaan browser lokal memperlihatkan peta jalan penuh dengan 331 titik/330 hubungan, dua teknisi uji, serta satu tiket uji. Mode satelit pada zoom dekat memuat 18 gambar berhasil (256 px) pada zoom sumber 17. GPS contoh hanya berada di pratinjau lokal dan tidak disertakan dalam rilis.

## Verifikasi

- Build produksi web dan pemeriksaan TypeScript berhasil; APK debug dan rilis berhasil dibuat. Paket rilis akhir diperiksa langsung pada Android 11.
- 64 uji web/API lulus. Satu uji pembacaan SQLite yang melewati batas 5 detik ketika komputer sibuk diulang sendiri dan lulus; batas uji tersebut sekarang 30 detik.
- 18 uji Android lulus pada konfigurasi Android 11 / API 30. Lint Android selesai dengan 0 error dan 339 peringatan nonfatal.
- Emulator Android 11 memverifikasi penerimaan tiket dari daftar langsung ke detail, nama halaman, data pelapor, kategori/subkategori, spesifikasi, daftar lampiran, tombol notifikasi, dan penanganan kegagalan koneksi tanpa mengaku status telah tersimpan.
- GPS menghasilkan koordinat dengan akurasi 5 meter; layanan berjalan sebagai foreground service dan menyimpan titik saat offline. Status tiket dalam cache tetap tersimpan. Pemeriksaan APK rilis membuktikan daftar mengikuti perubahan status setelah kembali dari detail saat offline. Buffer crash aplikasi kosong.
- APK rilis versi 3.2.0 / kode 11 berhasil dipasang sebagai pembaruan tanpa menghapus data, tidak dapat di-debug, dan mempertahankan sertifikat versi sebelumnya. Checksum dan ukuran ada di `public/downloads/version.json`. Data akun/tiket uji dibersihkan dari emulator setelah pemeriksaan.
- Database produksi tidak diakses dalam pengujian lokal; pelaksanaan reset SLA di server harus dilihat dari hasil hook pembaruan web.
