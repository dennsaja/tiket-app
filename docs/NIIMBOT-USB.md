# Pencetakan tiket NIIMBOT D110 melalui USB

Implementasi ada pada alur tiket Next.js yang sudah tersedia. Pengaturan **Printer USB** tersedia pada dashboard, **Cetak Tiket** pada detail tiket, dan opsi cetak otomatis pada formulir tiket baru. Koneksi tetap hidup selama berpindah halaman dashboard; memuat ulang halaman memerlukan klik **Hubungkan USB** lagi.

Admin, NOC, dan owner melihat status USB bersama. Komputer yang tersambung memperbarui status setiap 15 detik. Komputer lain memeriksanya setiap 8 detik. Mencabut USB atau menutup tab melepas status. Jika browser berhenti mendadak, status kedaluwarsa setelah 90 detik. Antrean dan tombol kirim cetak menggunakan USB lokal.

Untuk **Label lipat dua panel**, gunakan panjang seluruh strip sebelum dilipat, centang pilihan tersebut dan simpan. Kedua panel menggunakan setengah panjang strip dengan margin masing-masing. Panel kedua diputar 180 derajat. Pilih **Otomatis sesuai ukuran** agar aplikasi memakai format ringkas jika detail lengkap tidak muat. Periksa preview sebelum mengirim.

## Menjalankan

```powershell
npm ci
npm run dev
```

Gunakan konfigurasi database dan login aplikasi yang sudah ada. Buka aplikasi melalui `http://localhost:3000` di komputer yang tersambung langsung ke printer, atau origin HTTPS aplikasi. HTTP melalui alamat IP LAN bukan secure context untuk Web Serial. Browser sasaran: Chrome/Edge desktop yang menyediakan Web Serial dan Web Locks. Tidak ada layanan cetak jaringan atau agent lokal yang dibuka.

Dependensi baru dikunci di `package.json` dan `package-lock.json`:

| Paket | Versi | Kegunaan |
| --- | --- | --- |
| `@mmote/niimbluelib` | `0.49.1` | Framing, parsing respons, encoder monokrom, perintah dan varian print task |
| `qrcode` | `1.5.4` | Matriks QR opsional, tanpa resize gambar |
| `@types/w3c-web-serial` | `1.0.8` | Tipe Web Serial saat pengembangan |
| `@types/qrcode` | `1.5.6` | Tipe QR saat pengembangan |

## Evaluasi library

Pemeriksaan dilakukan terhadap README, kode sumber, metadata paket, dan lisensi upstream. Klaim uji perangkat oleh upstream bukan hasil uji perangkat milik pengguna.

| Kandidat | Bukti dan pertimbangan |
| --- | --- |
| [MultiMote/niimbluelib](https://github.com/MultiMote/niimbluelib) | Dipilih. MIT; versi npm `0.49.1`. Memiliki `NiimbotSerialClient`, protokol USB serial 115200 baud, `rfidInfo`, `getPaperInfo`, informasi model/firmware, encoder canvas, dan task D110/D110_M. Transport USB aplikasi memakai `NiimbotAbstractClient` agar pembatalan pembacaan, penutupan port, dan penolakan port tanpa VID/PID dapat dikendalikan. |
| [MultiMote/niimblue-node](https://github.com/MultiMote/niimblue-node) | `1.4.1`; metadata paket menyatakan MIT, checkout yang diperiksa tidak memiliki berkas LICENSE terpisah. Mendokumentasikan pengujian serial USB di Windows dan D110 dalam daftar printer. Bergantung pada `niimbluelib` varian Node. Tidak diperlukan untuk browser yang menyediakan Web Serial. REST server bawaannya memiliki opsi CORS wildcard, dan tidak dipakai/dijalankan oleh aplikasi ini. |
| [AndBondStyle/niimprint](https://github.com/AndBondStyle/niimprint) | MIT, paket `0.1.0`, Python 3.11, `pyserial`. Memiliki `SerialTransport` 115200 baud dan dokumentasi D110. Memerlukan runtime tambahan dan kode pemilihan model serta algoritme cetak lebih manual; tidak memberikan integrasi browser/varian D110_M sebaik kandidat pertama. |

Commit yang diperiksa:

- niimbluelib: `30346c5a492f2fdbfed09800a95e6496a582f928`
- niimblue-node: `e7340dfad69b6aab1c05d2589ca012a7c0ed6313`
- niimprint: `35c41a705cbc25ded388f1d562f184bf8994080e`

Referensi teknis: [koneksi serial USB](https://printers.niim.blue/interfacing/connecting/), [karakteristik model](https://printers.niim.blue/hardware/models/), [task per model/protokol](https://github.com/MultiMote/niimbluelib/blob/30346c5a492f2fdbfed09800a95e6496a582f928/src/print_tasks/index.ts), [parser PaperInfo](https://github.com/MultiMote/niimbluelib/blob/30346c5a492f2fdbfed09800a95e6496a582f928/src/packets/packet_parser.ts), [persyaratan Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Serial/requestPort).

## Menghubungkan dan mencetak

1. Nyalakan printer dan pasang label. Hubungkan memakai **kabel USB data**. Tutup aplikasi NIIMBOT atau aplikasi lain yang memegang port printer.
2. Buka **Printer USB → Hubungkan USB**. Pilih port printer melalui pemilih perangkat browser. Aplikasi menolak port yang tidak menyediakan VID/PID USB, termasuk port serial yang tidak dapat dibuktikan sebagai USB.
3. Periksa identitas, firmware bila tersedia, dan versi protokol pada panel. **Siap** berarti negosiasi USB dan identitas didukung; belum berarti kertas sudah diketahui atau hasil cetak telah diuji.
4. Aplikasi membaca kertas saat tersambung. Jika ukuran belum diketahui, isi **Lebar melintang** dan **Panjang searah feed** dalam mm, pilih jenis label, lalu **Simpan ukuran dan bentuk label**. Batas profil yang diaktifkan aplikasi: lebar 5–15 mm, panjang 10–200 mm; kesesuaian roll nyata tetap harus diperiksa.
5. Tekan **Cetak Uji** untuk memilih contoh uji, periksa preview, lalu **Kirim cetak uji**. Ini sengaja dua langkah agar preview dapat diperiksa sebelum memakai kertas.
6. Pada detail tiket, tekan **Cetak Tiket**, periksa template/preview, lalu kirim. Template lengkap memuat nomor, judul, jenis tiket, PIC, telepon, prioritas yang tersedia, serta kode transaksi jika tersedia. Template ringkas hanya memuat nomor dan kode transaksi. Aplikasi ini sebelumnya tidak memiliki barcode; QR identitas tiket tersedia sebagai opsi.
7. Aktifkan cetak otomatis hanya jika diinginkan. Pemicu berada sesudah API pembuatan tiket berhasil dan proses lampiran selesai. Tidak ada pemicu cetak dari SSE, refresh detail tiket, atau pembaruan status. Jika USB belum siap, tiket tetap tersimpan dan panel menjelaskan bahwa cetak dilewati.
8. Tekan **Putuskan** untuk menutup port. Setelah kabel dicabut/printer mati, hubungkan lagi secara eksplisit. Tidak ada reconnect otomatis atau koneksi Bluetooth.

## Model, geometri, dan layout

- D110 dengan ID `2304`: task `D110`.
- D110_M dengan ID `2320`: task `B1` untuk protokol 1–3, task `D110M_V4` untuk protokol 4, mengikuti pemetaan library.
- ID `2305` diblokir: data upstream memetakannya ke D110 sekaligus HI_D110 dengan lebar kepala berbeda. Aplikasi tidak memilih salah satunya secara diam-diam.
- Model lain, protokol di luar 1–4, DPI yang berbeda, atau respons lebar kepala selain 96 piksel diblokir.
- Profil 203 DPI dan 96 piksel bersumber dari metadata model upstream. Jika printer juga melaporkan lebar 96 piksel, informasi itu ditampilkan. Jika firmware lama tidak melaporkan geometri, panel menyebut bahwa metadata model digunakan; itu bukan hasil pengukuran unit fisik.
- Konversi: `piksel = mm × DPI / 25,4`. Kepala 96 piksel pada 203 DPI ≈ 12,01 mm, sehingga roll fisik 15 mm tidak menyediakan 15 mm area cetak. Canvas hanya mencakup pita yang dapat dicetak. Lebar pita dibulatkan ke bawah ke kelipatan 8 agar padding encoder tidak melampaui kepala.
- Render landscape memiliki sumbu horizontal sepanjang feed, lalu encoder `left` memutar bitmap 90° sesuai D110. Orientasi tegak memutar konten tanpa mengubah sumbu fisik roll/kepala. Kalibrasikan posisi nyata dengan cetak uji.
- Layout menunggu font Arial selesai dimuat, mengukur glyph lewat canvas, membungkus kata/karakter panjang, dan mengecilkan font sampai minimum konfigurasi. Margin minimum 0,25 mm, font minimum 8–24 piksel (default 11). Font 8 piksel hanya diizinkan sebagai pilihan eksplisit pengguna dan perlu dinilai keterbacaannya pada perangkat nyata.
- Nomor dan kode transaksi tidak pernah dipotong. Jika isi tidak muat, pengiriman diblokir dan UI menawarkan template ringkas atau ukuran lain. Tidak ada pergantian template otomatis.
- QR memakai modul integer minimal 3 piksel dan quiet zone 4 modul pada semua sisi; jika tidak muat, cetak diblokir. Banyak kombinasi roll D110 yang sempit tidak cukup untuk QR. Kemampuan pemindaian tetap memerlukan pengujian fisik.
- Bitmap dithreshold menjadi hitam/putih sebelum preview dibuat. Canvas yang sama dikirim ke encoder; bitmap tidak diregangkan. Perubahan profil/layout menghitung preview ulang.

## Deteksi kertas dan batasnya

Pembacaan hanya memakai `rfidInfo()` dan `getPaperInfo()` melalui port USB. Tidak ada operasi tulis RFID.

| Sumber ukuran pada UI | Arti |
| --- | --- |
| **Terdeteksi dari printer** | Respons PaperInfo valid menyediakan lebar dan panjang eksplisit yang lolos batas profil. Parser upstream membedakan respons 18 byte yang diketahui dengan respons pendek yang dimensinya belum dipahami. Aplikasi menggunakan ukuran dalam mm atau mengonversi ukuran piksel pada 203 DPI, termasuk perlakuan gap sesuai model. Keberadaan kertas ditampilkan terpisah dari ukurannya. |
| **Pemetaan kode roll** | Kode produk cocok dengan `ROLL_CATALOG` di `src/lib/printing/profiles.ts`. Setiap entri harus mencantumkan URL spesifikasi produsen atau rujukan pengukuran yang dapat diperiksa. Katalog mencakup SKU label persegi panjang dan transparan yang terdaftar pada halaman D110_M NIIMBOT USA. |
| **Diatur manual** | Ukuran dimasukkan/dikonfirmasi pengguna atau dipulihkan dari profil manual dengan identitas roll atau kode produk yang sama. Sumber ini tidak dipromosikan menjadi hasil deteksi printer. |

UUID RFID/serial roll dipakai sebagai identitas profil jika benar-benar dilaporkan untuk tag yang hadir. Barcode hanya diperlakukan sebagai kode produk; format seperti `15x30` tidak otomatis diparse menjadi ukuran. Label tanpa identitas menampilkan ukuran terakhir sebagai saran yang perlu dikonfirmasi setelah tersambung atau menekan **Periksa Kertas**. Dalam sesi yang sama, pilihan manual yang sudah dikonfirmasi boleh dipakai untuk pembacaan sebelum cetak selama informasi roll tidak berubah. Jenis label `Invalid`/0 diperlakukan sebagai tidak diketahui, sehingga pilihan jenis manual tetap dapat digunakan; bila hanya dimensi yang diketahui saat tersambung, jenis label harus dikonfirmasi.

Pembacaan diulang saat tersambung, sebelum setiap job, dan lewat **Periksa Kertas**. Jika identitas/kode/ukuran/jenis berubah dari preview, job gagal sebelum data cetak dikirim. Tidak ada klaim deteksi pergantian roll otomatis. Tanpa identitas maupun dimensi dari printer, pergantian roll yang tidak dilaporkan memang tidak dapat diketahui: pengguna wajib menekan **Periksa Kertas** dan mengonfirmasi ukuran setelah mengganti roll.

## Antrean, konfirmasi, dan pemulihan

Antrean menjalankan satu job dalam satu waktu. Web Locks menahan kepemilikan printer selama koneksi pada satu origin browser; port OS juga tidak dapat dipakai bersamaan oleh aplikasi lain. Ledger job disimpan sebelum pengiriman melalui `localStorage`, dengan UUID job dan kunci idempoten `ticket:<id>`. Riwayat tidak dipangkas otomatis agar replay event lama tetap tidak mencetak ganda. Kegagalan penyimpanan menghentikan pengiriman. Ledger menyimpan ID/nomor tiket/status, tanpa bitmap, judul, nomor telepon, atau isi tiket.

Status yang ditampilkan: **Antre**, **Mengirim**, **Menunggu konfirmasi**, **Selesai terkonfirmasi**, **Gagal**, **Belum terkonfirmasi**. Tindakan manual **Tandai sudah tercetak** diberi penanda pengguna, dibedakan dari konfirmasi printer. **Cetak ulang** memuat kembali tiket melalui API yang sudah terautentikasi, menampilkan preview, dan meminta konfirmasi sebelum membuat job baru. Klik berulang untuk konfirmasi cetak ulang yang sama memakai satu kunci permintaan.

`printPage()` pada library menunggu respons paket; `printEnd()`/event `printend` bukan bukti fisik kertas tercetak. Polling bawaan library dapat terus menunggu bila page tetap 0. Adapter aplikasi memakai polling serial berurutan dengan tenggat keseluruhan 20 detik, respons paket terbatas waktu, dan hanya mengonfirmasi ketika page 1 dari 1 serta progres cetak/feed masing-masing 100%. Firmware yang tidak memberikan ketiga nilai itu akan menghasilkan **Belum terkonfirmasi** meskipun kertas mungkin sudah keluar; pengguna harus memeriksa kertas. Perintah akhir tetap dikirim untuk menutup sesi, tanpa mengubah status gagal konfirmasi menjadi sukses.

Koneksi terputus/timeout setelah dispatch diperlakukan sebagai hasil tidak diketahui secara konservatif. Job itu tidak diulang otomatis dan menahan job berikutnya sampai pengguna memeriksa hasil. Saat halaman dimuat ulang, job `sending`/`awaiting_confirmation` dipulihkan sebagai `unknown`; job yang baru `queued` dibatalkan sebelum pengiriman. Otorisasi cetak ulang mempertahankan status asli yang tidak diketahui beserta alasan pengguna memilih cetak ulang.

Ledger dan penguncian ini berlaku pada **satu profil browser dan origin**. Menghapus data browser, berpindah profil/origin/komputer, atau memakai aplikasi cetak lain menghilangkan jaminan deduplikasi lintas lingkungan tersebut. Tidak ada klaim exactly-once fisik karena protokol tidak menyediakan transaksi job yang dapat dipulihkan secara pasti.

## Diagnostik jika USB tidak bekerja

Panel **Diagnostik USB** menampilkan secure context, browser, VID/PID port terpilih, model/protokol/firmware yang berhasil dibaca, error negosiasi, dan respons kertas. Ini adalah bukti yang dikumpulkan pada upaya koneksi nyata pengguna, bukan perangkat USB simulasi.

- Tidak muncul port: periksa Device Manager → Ports (COM & LPT), kabel data lain, port USB lain, printer menyala, dan driver USB serial yang sesuai identitas perangkat. Jangan memasang driver acak berdasarkan nama printer saja.
- Muncul COM tetapi gagal dibuka: tutup aplikasi/tab yang memakai port lalu hubungkan secara eksplisit lagi.
- Port terbuka tetapi negosiasi tidak merespons: catat VID/PID dan error yang ditampilkan. Periksa model/firmware serta apakah antarmuka USB unit benar-benar meneruskan protokol cetak.
- Browser tidak menyediakan Web Serial: gunakan browser desktop sasaran. Agent lokal belum diperlukan pada jalur USB serial ini dan belum diimplementasikan. USB nonserial memerlukan investigasi transport tambahan; tidak diasumsikan dapat diatasi oleh agent.
- Jika setelah kabel data dan driver benar unit tidak mengekspos antarmuka data/serial, aplikasi menyatakan USB belum tersedia untuk cetak. Tidak ada pengalihan transport. Ketidakmunculan port atau timeout saja belum cukup untuk membuktikan secara pasti bahwa USB unit hanya untuk pengisian daya; bukti hardware/firmware tambahan diperlukan.

## Struktur modul

- `src/lib/printing/usb-connection.ts`: pemilihan identitas USB, pembacaan stream, write timeout, pelepasan port.
- `src/lib/printing/adapter.ts`: validasi model, pemilihan task, pemeriksaan kesiapan, pengiriman dan konfirmasi penyelesaian.
- `src/lib/printing/paper.ts`: normalisasi respons kertas yang benar-benar dilaporkan.
- `src/lib/printing/profiles.ts`: katalog bersumber, profil roll, konfirmasi manual, fingerprint kertas.
- `src/lib/printing/layout.ts`: metrik font, konversi/geometri, pembungkusan, QR, render monokrom untuk preview/cetak.
- `src/lib/printing/queue.ts`: ledger, idempotensi, urutan job, hasil tidak diketahui, pemulihan.
- `src/components/printing/printer-provider.tsx`: UI, koneksi per dashboard, konfigurasi, integrasi cetak sesudah penyimpanan.

## Pengujian

Hasil pemeriksaan pada sesi implementasi, 8 November 2026:

- Pengujian fitur cetak: **37/37 lulus** dengan mock/simulasi.
- Pengujian batas berkas build: **2/2 lulus**, memakai plugin/matcher Next terpasang dengan contoh path Windows/POSIX; emulator, unggahan, dan berkas lingkungan dikecualikan dari penelusuran NFT, sedangkan aset runtime SQL.js tetap diizinkan.
- Pemeriksaan tipe seluruh project: **lulus** (`npm run type-check`).
- Build produksi: **lulus** (`npm run build`), termasuk kompilasi, pemeriksaan tipe, 46 halaman, dan hasil standalone. Masih ada peringatan dependensi Next/Auth pada Edge Runtime dan konvensi middleware yang sudah tersedia sebelumnya.
- Audit hasil build: **77 berkas trace NFT diperiksa**, tanpa entri emulator Android, proyek motion, unggahan, Git, atau `.env`. Hasil standalone memuat `server.js` dan aset runtime `sql-wasm.wasm`, tanpa direktori Android/motion. Kedua image emulator asli tetap tersedia. Audit `.env` ini berlaku pada trace NFT; pengelolaan environment runtime tetap mengikuti Next.js yang sudah ada.
- Seluruh suite pada pemeriksaan awal (sebelum tambahan kasus RFID dan pengemasan), satu worker: **108 lulus, 2 gagal**. Kegagalan berada pada bagian yang tidak diubah: ekspektasi validasi email login (`src/__tests__/unit.test.ts:54`) dan timeout 5 detik pengujian APK (`src/__tests__/mobile-production.test.ts:56`). Timeout pengujian split-network pada percobaan paralel lulus saat dijalankan ulang dengan satu worker.
- Pemeriksaan whitespace diff: lulus. ESLint project tidak dapat dimuat karena konfigurasi yang sudah tersedia mengimpor `eslint-config-next/core-web-vitals` tanpa modul yang dapat diresolusikan oleh versi terpasang; konfigurasi lint tidak diubah dalam pekerjaan printer.
- Browser: belum dapat diverifikasi karena webview pemeriksaan tidak tersambung. Perangkat fisik: belum diuji.

Pemeriksaan build menemukan masalah konfigurasi lama di Windows: pemisah path pada pengecualian terakhir tidak cocok dengan matcher, sehingga berkas emulator Android ikut disalin dan menghabiskan disk. Salinan hasil build dibersihkan; berkas sumber/emulator asli tidak diubah. `next.config.ts` kini menerapkan pengecualian yang sama sebelum penelusuran Webpack dan mencakup trace `next-server`, mengikuti tujuan pengecualian yang sebelumnya sudah tersedia. Penyesuaian plugin ini diverifikasi terhadap Next 16.3.6; bila API plugin berubah, build dihentikan dengan pesan jelas. Alur pengembangan Turbopack tetap tersedia. Untuk produksi gunakan `npm run build` yang sudah mengaktifkan Webpack.

```powershell
npm test -- src/__tests__/printing.test.ts
npm run type-check
npm run build
```

Pengujian otomatis memakai metrik font simulasi untuk batas layout, penyimpanan memori, respons status mock, serta stream/port USB simulasi. Cakupan: beberapa ukuran label dan teks panjang, nomor/kode transaksi wajib, font minimum/orientasi/offset, QR, ukuran tidak diketahui, profil manual per roll, pemisahan sumber ukuran, varian tidak didukung, port tanpa VID/PID, pencabutan port dengan read tertunda, timeout dengan penghitung 0 dari 1, antrean berurutan, klik/event berulang, reload saat dispatch, kegagalan penyimpanan, dan cetak ulang eksplisit.

**Belum diuji pada printer fisik:** negosiasi USB unit pengguna, dukungan RFID/PaperInfo pada firmware unit tersebut, makna dimensi/gap/arah roll pada respons nyata, kalibrasi feed/offset, kepekatan, keterbacaan teks/QR, dan konfirmasi penyelesaian printer. Pemeriksaan bitmap di Chrome membandingkan setiap piksel kedua panel pada orientasi mendatar dan tegak. Pengujian ini belum mencakup hasil cetak fisik.

### Checklist uji fisik sebelum operasional

1. Catat model pada casing, VID/PID di Device Manager, model ID dan firmware dari panel. Pastikan D110 dan D110_M tidak dianggap sama.
2. Hubungkan via USB, catat negosiasi, putuskan, lalu hubungkan lagi. Uji port sedang dipakai, izin dibatalkan/ditolak, printer mati, dan perangkat lain. Pastikan tidak ada upaya reconnect tanpa klik pengguna.
3. Catat respons kertas dengan roll asli dan roll tanpa RFID bila tersedia. Bandingkan ukuran yang dilaporkan dengan pengukuran manual. Ganti roll, tekan **Periksa Kertas**, pastikan sumber dan konfirmasi sesuai. Uji roll tanpa identitas sesudah reload.
4. Cetak uji pada minimal dua panjang roll yang benar-benar tersedia. Ukur area cetak 96 titik, orientasi feed, margin, serta offset. Uji judul panjang, kode transaksi panjang, template ringkas, dan QR jika cukup ruang; pindai dengan perangkat pembaca yang akan dipakai.
5. Buat tiket dengan cetak otomatis mati/aktif. Klik cetak berulang cepat dan segarkan detail/SSE; harus tetap satu job. Coba dua tab menghubungkan printer bersamaan.
6. Cabut USB saat mengirim dan saat menunggu konfirmasi. Pastikan status **Belum terkonfirmasi**, tidak ada pengulangan otomatis, dan job berikut tertahan.
7. Uji keadaan penghitung halaman tetap 0 dari 1 meskipun label keluar/perintah akhir dikirim. Tunggu tenggat, periksa kertas, coba **Tandai sudah tercetak** lalu **Cetak ulang** dengan konfirmasi. Catat apakah firmware nyata memberi page/progres/feed seperti syarat adapter.
8. Muat ulang halaman setelah dispatch. Pastikan job terdahulu tidak dicetak ulang. Dokumentasikan hasil aktual dan respons diagnostik sebelum mengaktifkan penggunaan rutin.
