# Frontend, backend, dan CDN pada server HelpDesk yang sama

Perubahan GitHub menyiapkan pemisahan. DNS, Cloudflare Tunnel, dan layanan server perlu diaktifkan melalui langkah di bawah; push GitHub saja tidak mengubah konfigurasi server.

| Domain | Layanan lokal | Isi |
| --- | --- | --- |
| `helpdesk.infinityteknik.net` | frontend, `127.0.0.1:3100` | Halaman dan antarmuka, tanpa kredensial database atau kunci penandatangan sesi |
| `kds-serviceapp.infinityteknik.net` | backend, `127.0.0.1:3101` | API, login, database, realtime, GPS, lampiran privat, dan pembaruan aplikasi |
| `cdn0.infinityteknik.net` | Nginx, gateway `127.0.0.1:8080` | JS/CSS, aset peta publik, dan unduhan APK publik |

Ketiga hostname Tunnel diarahkan ke gateway `127.0.0.1:8080`. Nginx memilih layanan berdasarkan hostname. Port internal hanya mendengarkan localhost. Ini merupakan pemisahan proses dan akun pada satu server, bukan pemisahan mesin fisik.

## Aktivasi

Gunakan checkout produksi yang sudah mempunyai `.env.local`, database, upload, dan kredensial Git yang benar. Contoh berikut memakai lokasi `/opt/helpdesk/app` dan akun layanan `helpdesk`; sesuaikan lokasi dengan instalasi yang sekarang.

```bash
cd /opt/helpdesk/app
git pull --ff-only origin main
sudo apt-get install -y nginx rsync curl sudo
npm ci --no-audit --no-fund
sudo bash deploy/split/activate.sh
```

Jalankan `git pull` dan `npm ci` menggunakan akun pemilik aplikasi. Akun backend harus sudah ada dan dapat menulis ke checkout untuk build serta pembaruan Git. Jika akun saat ini berbeda, gunakan `sudo SPLIT_BACKEND_USER=nama_akun bash deploy/split/activate.sh`. Node dan npm harus tersedia untuk layanan di `/usr/bin/node` dan PATH sistem; Node yang hanya tersedia lewat shell interaktif/nvm perlu dipasang pada lokasi sistem terlebih dahulu.

Installer menyalin kredensial yang sudah ada ke `/etc/helpdesk/backend.env`, membuat konfigurasi frontend terpisah, membangun aplikasi, memasang dua unit systemd dan gateway Nginx. Konfigurasi `/etc/helpdesk/*.env` yang sudah ada dipertahankan. File tersebut hanya terbaca oleh akun layanannya. Installer tidak membuat ulang akun pengguna, menghapus tiket, atau mengganti kunci sesi/database. Simpan konfigurasi layanan dan Tunnel yang lama untuk rollback.

Gabungkan entri di [cloudflared-ingress.example.yml](../deploy/split/cloudflared-ingress.example.yml) ke konfigurasi Tunnel yang sekarang, sebelum aturan catch-all. Pertahankan ID Tunnel dan file kredensial. Jika memakai dashboard Cloudflare, tambahkan tiga public hostname, semuanya menuju `http://127.0.0.1:8080`, dan tetapkan HTTP Host Header sesuai domain masing-masing. Pastikan DNS ketiganya menunjuk Tunnel yang sama, lalu terapkan/restart Tunnel sesuai cara pengelolaannya.

Periksa setelah perubahan Tunnel:

```bash
curl -fsS https://helpdesk.infinityteknik.net/healthz
curl -fsS https://kds-serviceapp.infinityteknik.net/healthz
curl -fsS https://cdn0.infinityteknik.net/downloads/version.json
```

Dua hasil pertama harus menunjukkan `frontend` dan `backend` dengan `ready:true`. Buka login web, dashboard, chat realtime, peta, dan lampiran dengan akun yang sudah ada. Setelah jalur publik terverifikasi, layanan monolit lama di port 3000 boleh dihentikan. Installer sengaja mempertahankan layanan lama selama perpindahan.

## Login dan kompatibilitas APK

Browser mengambil API langsung dari domain backend dengan kredensial dan CORS yang membatasi origin ke domain aplikasi. Sesi menggunakan cookie HTTPS, HttpOnly, SameSite=Lax pada `.infinityteknik.net`; pastikan seluruh subdomain dalam kendali yang sama. Frontend mempertahankan proxy kecil `/api/auth/*` untuk kompatibilitas Auth.js, tetapi login dan validasi sesi tetap dilakukan backend. Cookie host-only dari instalasi lama dibersihkan saat endpoint auth dipanggil; pengguna mungkin perlu login ulang saat migrasi.

`LEGACY_MOBILE_API_BRIDGE=true` pada frontend meneruskan API dengan Bearer token serta endpoint login native lama ke backend. Ini menjaga APK 3.6.x tetap dapat login dan menerima update. Browser tidak memakai jembatan tersebut. Matikan flag ini setelah seluruh perangkat beralih ke APK baru.

APK **3.7.0 / kode 18** memakai API baru, membuka login browser pada domain frontend, dan menyimpan identitas paket serta sertifikat penandatanganan sebelumnya. **Aktifkan ketiga domain sebelum membagikan APK 3.7.0.** Console menolak publikasi jika backend belum aktif atau metadata APK CDN belum sesuai. Halaman download pada instalasi monolit lama juga menahan tautan APK yang membutuhkan domain baru. Verifikasi APK dapat diunduh dari CDN sebelum menekan push update di console.

## Pembaruan dan cache

Setelah aktif, tombol pembaruan web menjalankan build backend dan menerbitkan standalone frontend serta aset CDN. Frontend memakai akun `helpdesk-frontend`; backend mendapat izin sudo terbatas untuk restart unit frontend saja. Backend restart melalui systemd setelah pembaruan. Chunk lama dipertahankan agar tab browser yang masih terbuka tidak kehilangan asetnya.

Variabel `NEXT_PUBLIC_*` dibakukan saat build; perubahan domain membutuhkan build dan publikasi ulang. `APP_SERVICE=monolith` tetap menjadi default untuk instalasi yang belum diaktifkan. Contoh konfigurasi ada di [backend.env.example](../deploy/split/backend.env.example) dan [frontend.env.example](../deploy/split/frontend.env.example).

Jangan aktifkan cache menyeluruh pada API, login, SSE, atau metadata update. Nginx menandai API `private,no-store,no-transform`, unduhan/metadata update wajib divalidasi ulang, dan hanya chunk dengan nama berhash yang immutable. CDN tidak melayani direktori upload, database, `.env`, backup, atau file server. Lampiran/foto privat tetap memakai endpoint backend yang memeriksa izin. Service worker tetap pada origin frontend agar cakupannya benar.

## Pemeriksaan dan pemulihan

```bash
sudo systemctl status helpdesk-backend helpdesk-frontend nginx
sudo journalctl -u helpdesk-backend -u helpdesk-frontend -n 100 --no-pager
sudo nginx -t
```

Rilis frontend berada di `/var/lib/helpdesk/frontend/releases`, dengan symlink `current`. Publisher memulihkan symlink sebelumnya jika pemeriksaan kesehatan frontend gagal; ini tidak melakukan rollback database atau seluruh backend. Untuk rollback migrasi domain, kembalikan aturan Tunnel ke layanan lama yang dipertahankan dan konfigurasi rilis sebelumnya, lalu hentikan unit baru setelah jalur lama terverifikasi. Jangan menghapus upload atau mengganti kunci autentikasi saat rollback.

Workflow `Split services and Android 11 check` memeriksa batas domain, build frontend tanpa database/kunci sesi, gateway Nginx, CORS dan aset privat. Pengujian perangkat Android dibatasi Android 11, termasuk upgrade dari APK 3.6.1 dengan sertifikat yang sama. Pemeriksaan tersebut memakai fixture, bukan data produksi.
