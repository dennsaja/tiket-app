# HelpDesk

Aplikasi kembali memakai satu layanan: halaman, login, API, realtime, aset, dan unduhan APK pada origin yang sama. Update tetap melalui push GitHub lalu menu Pembaruan Sistem di web.

- [Instalasi satu aplikasi](docs/DEPLOY.md)
- [Update GitHub melalui web](docs/UPDATE.md)
- [Printer NIIMBOT USB](docs/NIIMBOT-USB.md)

~~~bash
npm ci
npm run dev
~~~

Untuk produksi: npm run build lalu npm start, dengan .env.local dan database yang sudah dikonfigurasi. Contoh systemd: deploy/helpdesk.service. Panduan split lama sudah dibatalkan.
