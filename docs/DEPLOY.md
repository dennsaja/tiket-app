# HelpDesk: satu aplikasi, satu layanan

Halaman web, login, API, database, SSE/chat, lampiran, aset publik, unduhan APK, dan menu update berada di aplikasi yang sama. Domain utama: https://helpdesk.infinityteknik.net, port aplikasi 3000. PostgreSQL tetap merupakan layanan database seperti sebelumnya; tidak ada proses frontend/backend/CDN terpisah.

## Server yang sudah berjalan seperti semula

Tidak perlu mengganti Tunnel, DNS, database, atau unit layanan Anda karena pemisahan belum pernah diaktifkan. Kirim seluruh perubahan ke branch GitHub yang digunakan server, lalu buka **Pembaruan Sistem → Periksa pembaruan → Jalankan pembaruan**. Nama tombol mengikuti UI halaman.

Updater mengambil commit GitHub, menjalankan npm ci, migrasi skema yang tersedia, build aplikasi, dan restart satu layanan helpdesk. Tidak menjalankan publisher frontend/CDN. Konfigurasi split lama diabaikan oleh aplikasi. Penggabungan ini tidak membuat ulang pengguna, mereset tiket, menghapus upload, atau mengganti AUTH_SECRET/DATABASE_URL. Hook reset data lama telah dinonaktifkan.

Login ulang sekali mungkin diperlukan karena cookie sesi sekarang host-only dengan nama helpdesk.*; akun dan kata sandi tetap sama.

Jika layanan saat ini menjalankan .next/standalone/server.js, itu tetap didukung: build menyalin public dan static ke standalone. Updater mencari checkout Git di atas folder standalone. Upload, avatar, backup, topologi, metadata APK, dan pemeriksaan sumber Android memakai folder sumber/data, bukan folder build yang diganti. Jika source checkout berada di tempat lain, set APP_ROOT ke folder yang memiliki .git dan package.json.

## Instalasi baru pada Ubuntu

Prasyarat: Git, Node.js minimal 20.9 (tersedia pada /usr/bin/node untuk contoh systemd), npm, PostgreSQL, dan akun Linux helpdesk. Gunakan Node yang memenuhi versi minimum dalam package Next terpasang.

1. Clone repository sebagai akun pemilik aplikasi ke /opt/helpdesk/app.
2. Buat database PostgreSQL milik akun database aplikasi.
3. Salin .env.example ke .env.local. Isi DATABASE_URL, AUTH_SECRET (nilai acak minimal 32 karakter), NEXTAUTH_URL dan APP_URL sesuai domain HTTPS utama. Sesuaikan UPLOAD_DIR ke lokasi upload yang dapat ditulis akun layanan. Untuk instalasi lama, selalu pertahankan secret dan koneksi yang sudah ada.
4. Instal dependensi, jalankan migrasi yang sudah ada, lalu build:

~~~bash
cd /opt/helpdesk/app
npm ci --include=dev --no-audit --no-fund
npm run db:migrate
npm run build
~~~

Untuk database baru saja, isi BOOTSTRAP_OWNER_EMAIL, BOOTSTRAP_OWNER_PASSWORD (minimal 12 karakter), dan BOOTSTRAP_OWNER_NAME sebelum menjalankan npm run db:seed. Jangan mengaktifkan SEED_DEMO_DATA di produksi.

5. Pasang deploy/helpdesk.service sebagai /etc/systemd/system/helpdesk.service, sesuaikan path dan akun, lalu:

~~~bash
sudo systemctl daemon-reload
sudo systemctl enable --now helpdesk
sudo systemctl status helpdesk
~~~

Akun layanan harus bisa menulis checkout, node_modules, .next, serta direktori upload/backup agar update web dapat bekerja. Jangan menjalankan app sebagai root. Restart=always diperlukan agar aplikasi kembali hidup setelah updater keluar dengan sukses.

6. Gunakan reverse proxy/Tunnel yang mengarahkan domain utama ke 127.0.0.1:3000. Jika Tunnel lama sudah menuju Nginx, pertahankan Nginx dan arahkan proxy aplikasi ke port tersebut. Teruskan Host, X-Forwarded-Host, dan X-Forwarded-Proto dengan benar. Nonaktifkan buffering untuk SSE/chat dan log update. Tidak perlu hostname API/CDN tambahan.

## Memeriksa pemasangan

~~~bash
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS http://127.0.0.1:3000/api/health
sudo journalctl -u helpdesk -n 100 --no-pager
~~~

/healthz melaporkan service monolith. /api/health juga menguji database. Uji login, dashboard, tiket, chat realtime, foto/lampiran, peta, unduhan APK, dan menu update lewat domain utama.

## Android dan printer

APK 3.7.1 (kode 19) kembali menggunakan domain utama untuk API, login, aset, dan update. Sertifikat penandatanganan harus sama agar bisa dipasang menimpa versi sebelumnya tanpa menghapus data/draf. APK 3.7.0 lama mengarah ke domain terpisah; gunakan APK baru ini. Perubahan source Android harus dibuild ulang sebelum menjalankan scripts/android-release-manifest.ts; jangan mengubah metadata/hash seolah APK sudah dibuild.

Printer USB tersambung ke komputer pengguna yang membuka Chrome/Edge melalui HTTPS/localhost, bukan ke server hosting. Lihat NIIMBOT-USB.md.

## Batas validasi

Validasi lokal pada 8 November 2026: seluruh 123 pengujian lulus, build produksi berhasil, dan satu proses aplikasi berhasil melayani halaman login, autentikasi, aset, peta, serta APK 3.7.1. Pemeriksaan HTTP juga memastikan API terlindungi dan update tanpa login ditolak. APK dibuild ulang dan sertifikatnya cocok dengan rilis sebelumnya.

Tes updater memakai simulasi Git, instalasi, migrasi dan restart. Tidak ada pull/reset, perubahan database, restart atau deploy pada server produksi selama pengujian lokal. Build dan smoke test lokal dilaporkan terpisah dari verifikasi server fisik.
