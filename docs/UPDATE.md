# Pembaruan dari GitHub melalui web

Alur tetap: **push GitHub → Periksa pembaruan di web → Jalankan pembaruan → aplikasi restart**.

1. Simpan backup database dan upload melalui fasilitas backup yang sudah ada.
2. Commit dan push perubahan aplikasi, package-lock.json, APK/metadata bila berubah, dan script pendukung ke branch yang dipakai server (default main). Jangan sertakan .env.local atau file kredensial.
3. Login sebagai NOC, Owner atau Admin, lalu buka Pembaruan Sistem.
4. Periksa commit terbaru dan jalankan pembaruan. Log ditampilkan selama pengambilan kode, instalasi dependensi, migrasi skema, dan build.
5. Tunggu restart layanan helpdesk dan pemuatan ulang halaman. systemd harus memakai Restart=always; proses app keluar setelah update berhasil. PM2 juga dapat dipakai dengan nama proses helpdesk dan autorestart.
6. Periksa login, tiket, chat, lampiran, /healthz dan /api/health.

Jika instalasi dependensi, migrasi database, atau build gagal, updater mengirim status gagal dan tidak mengirim status sukses/restart. Pembaruan masih dilakukan di checkout aktif, jadi sediakan waktu pemeliharaan; ini bukan rilis atomik dengan rollback otomatis database. Jangan menjalankan dua pembaruan sekaligus.

APP_ROOT opsional menunjuk checkout sumber. Ini diperlukan jika layanan standalone dijalankan di luar struktur checkout. Akun layanan memerlukan izin Git, akses repository, dan izin menulis checkout untuk instalasi/build. GITHUB_REPO dan GITHUB_BRANCH mempertahankan dukungan repository/branch yang sebelumnya dipakai.

Tidak ada langkah publish frontend/CDN atau restart beberapa layanan. Secret/database/upload tetap memakai konfigurasi server yang sekarang. Hook reset tiket/pengguna lama tidak lagi dijalankan otomatis. Pengguna mungkin perlu login ulang satu kali setelah perubahan cookie.

Lihat [instalasi satu aplikasi](DEPLOY.md) dan [printer USB](NIIMBOT-USB.md).

File publish-split.sh dipertahankan sebagai pesan kompatibilitas untuk proses updater versi lama yang sedang berjalan ketika kode baru ditarik. File ini tidak memublikasikan aset atau mengelola layanan; updater baru tidak memanggilnya.

Penambahan kolom username dan klasifikasi kategori sekarang memakai migrasi skema idempoten, terpisah dari script reset akun/data lama. Migrasi tipe tiket/laporan yang sudah tersedia juga didaftarkan dalam journal. Penggabungan layanan tidak menghapus atau membuat ulang isi tabel.

## Pemulihan login 500 setelah pembaruan satu layanan

Pada commit 43bccdb, standalone tidak membaca .env.local di checkout: halaman login dan /healthz dapat terbuka, tetapi /api/auth/csrf, /api/auth/providers, dan /api/health gagal dengan 500. Peluncur sekarang membaca konfigurasi checkout sebelum kode login/database dimuat. Build juga memasang pemuat konfigurasi pada server.js untuk layanan systemd lama yang menjalankan berkas tersebut langsung. Berkas .env tetap berada di checkout; nilainya tidak disalin ke paket build.

Jika tidak bisa masuk untuk memakai updater web, lakukan pemulihan satu kali dari terminal server. Contoh ini memakai lokasi dan nama layanan pada panduan pemasangan; sesuaikan bila berbeda. Jalankan Git dan penyiapan build sebagai akun pemilik aplikasi. Perintah ini memakai build yang sudah ada dan tidak memerlukan migrasi atau build ulang:

~~~bash
set -e
cd /opt/helpdesk/app
git pull --ff-only origin main
node scripts/prepare-standalone.mjs
sudo systemctl restart helpdesk
curl -fsS http://127.0.0.1:3000/api/auth/csrf
curl -fsS http://127.0.0.1:3000/api/health
~~~

Jika memakai PM2, gunakan pm2 restart helpdesk sebagai pengganti perintah restart systemd. Jika git pull berhenti karena ada perubahan lokal atau branch berbeda, jangan reset paksa; periksa pesan Git terlebih dahulu. Setelah login pulih, pembaruan berikutnya tetap melalui web seperti biasa.
