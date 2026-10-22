# Peta tracking dan topologi jaringan

Peta `/admin/map` menyatukan lokasi teknisi, tujuan tiket aktif, pelanggan, ODP, router/MikroTik, server, dan hubungan jaringan. Pilih titik untuk melihat sambungan ke arah sumber. Jalur `cable_path` asli dipertahankan; hubungan tanpa jalur tersimpan memakai garis putus, bukan rute kabel terukur. Status perangkat dari database topologi tidak diperlakukan sebagai pemantauan langsung.

## Impor ke server

Setelah memperbarui web, buka **Tracking teknisi → Lapisan peta → Impor topology.db** dan pilih database lokal. Impor hanya dapat dilakukan NOC, owner, atau admin. Data topologi lama diganti setelah database baru berhasil dibaca. File SQLite asli tidak disimpan di server. Kredensial login router, PPPoE, IP, data tagihan, dan riwayat trafik tidak disertakan dalam snapshot.

Snapshot privat disimpan di `uploads/topology/network.json`, di luar `public` dan diabaikan Git. Akses koordinat melalui API memerlukan akun administrator. Data lokal tidak ikut terkirim ke GitHub; lakukan impor sekali di server. Folder uploads perlu disimpan pada disk persisten serta dicadangkan bersama upload lainnya. Untuk beberapa instance aplikasi, gunakan volume bersama yang mendukung penggantian file atomik. Lokasi opsional dapat diatur melalui `TOPOLOGY_DATA_FILE`.

Alternatif dari terminal server: `npx tsx scripts/import-topology.ts /private/path/topology.db`. Tidak diperlukan perubahan tabel PostgreSQL. Importir menggunakan SQLite WASM sehingga tidak membutuhkan instalasi SQLite atau Node dengan modul SQLite bawaan.

## Satelit dan performa

Tampilan diringkas menjadi Peta/Satelit, pencarian, lapisan, zoom, dan pusatkan. Kamera tidak dibuat ulang ketika berpindah gaya atau menyembunyikan lapisan. Titik/jalur jaringan dirender sebagai sumber GeoJSON di GPU; marker teknisi diperbarui tanpa dibuat ulang. Hanya teknisi yang dipilih meminta rute jalan, dengan pembatalan permintaan lama dan cache singkat. Jika layanan rute gagal, aplikasi menampilkan garis arah berlabel tanpa membuat estimasi waktu palsu.

Mapbox tetap digunakan jika public token dikonfigurasi; tersedia fallback MapLibre tanpa token. Pada fallback satelit Esri, zoom sumber dibatasi ke 17 dan lapisan tidak dihentikan pada zoom 20. Zoom lebih dekat memperbesar citra yang tersedia. Detail citra tidak dapat melampaui resolusi penyedia. Pemeriksaan tilemap Esri di pusat area topologi menunjukkan tile level 17 tersedia dan level 19 kosong. Penggunaan `maxzoom` pada sumber mengikuti [spesifikasi MapLibre](https://maplibre.org/maplibre-style-spec/sources/#raster).

Semua koneksi antartitik memakai urutan koordinat GeoJSON `[longitude, latitude]`, dikonversi dari `[latitude, longitude]` pada database sumber. Parent tunggal, beberapa parent, dan jaringan dengan loop didukung. Node/parent/koordinat yang tidak valid dilewati tanpa menebak titik baru.

## Hasil pemeriksaan

Database sumber berhasil dibaca menjadi 331 titik (262 pelanggan, 64 ODP, 4 router, 1 server) dan 330 hubungan unik: 150 memiliki jalur kabel tersimpan dan 180 berupa hubungan skematis. Tidak ada titik yang dilewati. Snapshot privat berukuran 153.722 byte, dibanding database sumber 4.493.312 byte. Seluruh 410 tile level 17 yang mencakup batas jaringan tersedia menurut tilemap Esri.

Pemeriksaan tipe, 14 tes topologi/API, dan build produksi web berhasil. Paket produksi juga menyertakan SQLite WASM yang dibutuhkan importir. Pengujian mencakup koordinat, beberapa parent, jalur terbalik, loop, penyaringan data sensitif, akses administrator, batas unggahan, kegagalan impor, dan konfigurasi overzoom satelit. Pemeriksaan interaksi layar belum terkonfirmasi karena browser pratinjau bawaan gagal tersambung; tidak diklaim sebagai pengujian visual yang lulus.
