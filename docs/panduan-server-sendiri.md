# Panduan Self-Hosting Penuh di Server Sendiri

Panduan ini untuk menjalankan **website, backend, autentikasi, dan database di server milik sendiri**. Rekomendasi untuk proyek ini adalah self-hosted Supabase menggunakan Docker Compose, bukan membuat backend baru dari nol.

## Stack yang direkomendasikan

- **Ubuntu Server LTS di VPS** sebagai sistem operasi server.
- **Docker Engine dan Docker Compose** untuk menjalankan layanan Supabase.
- **Supabase self-hosted** untuk PostgreSQL, API database, Auth, Studio, dan layanan Supabase lain yang digunakan aplikasi.
- **Nginx atau Caddy dengan HTTPS** untuk menyajikan halaman web dan meneruskan koneksi API ke Supabase.
- **PostgreSQL backup terjadwal** ke media penyimpanan terpisah dari VPS.

Pilihan ini paling sesuai dengan aplikasi sekarang: `js/app.js` dan `js/admin.js` sudah memakai Supabase JavaScript client, Supabase Auth, tabel database, dan fungsi RPC untuk pesanan. Dengan Supabase self-hosted, sebagian besar kode aplikasi dan migrasi database tetap dapat digunakan; URL proyek dan key harus diganti, lalu data perlu dipindahkan. Membuat API Node.js sendiri dari awal juga mungkin, tetapi berarti membangun ulang autentikasi, akses database, dan endpoint pesanan.

Panduan ini adalah jalur arsitektur dan deployment, bukan instalasi sekali klik. Supabase self-hosted terdiri dari beberapa layanan; baca [dokumentasi resmi instalasi Docker](https://supabase.com/docs/guides/self-hosting/docker) untuk konfigurasi dan langkah sesuai rilis yang dipasang.

## Kebutuhan server

Dokumentasi Supabase saat ini menyebut kebutuhan dasar untuk seluruh komponennya sebagai berikut:

| Sumber daya | Minimum | Disarankan |
| --- | ---: | ---: |
| RAM | 4 GB | 8 GB atau lebih |
| CPU | 2 core | 4 core atau lebih |
| Disk | SSD 40 GB | SSD 80 GB atau lebih |

Selain server, siapkan domain/subdomain, akses SSH, DNS, firewall, backup di luar server, dan waktu untuk memperbarui serta memantau layanan. Jika baru belajar mengelola Linux, database, dan Docker, gunakan Supabase managed terlebih dahulu atau siapkan server uji sebelum migrasi produksi.

## Rancangan domain

Pisahkan situs dan API supaya alamat publiknya jelas. Contoh:

- Website: `https://menu.domainkamu.id`
- Supabase API: `https://api.domainkamu.id`
- Supabase Studio: hanya melalui VPN, jaringan privat, atau pembatasan akses admin; jangan buka dashboard admin database untuk umum.

Atur DNS setiap subdomain ke alamat VPS. Konfigurasikan reverse proxy dan sertifikat TLS mengikuti dokumentasi Supabase serta web server pilihan. Hanya layanan web/API yang memang diperlukan yang boleh dapat diakses publik melalui HTTPS. **Jangan membuka port PostgreSQL (`5432`) atau port internal layanan Supabase ke internet.** Batasi SSH menggunakan firewall dan kunci SSH.

## Tahapan deployment

### 1. Siapkan sistem dan Docker

Pasang pembaruan keamanan Ubuntu, Git, Docker Engine, dan plugin Docker Compose mengikuti dokumentasi resmi untuk versi OS server. Gunakan akun non-root dengan akses administratif seperlunya. Pastikan server memenuhi spesifikasi di atas sebelum menjalankan seluruh stack.

### 2. Pasang Supabase self-hosted

Gunakan instruksi **Self-Hosting with Docker** resmi untuk mengambil konfigurasi Compose dan versi Supabase yang dirilis. Panduan resmi menyediakan setup Linux yang membantu membuat konfigurasi URL serta secret, atau instalasi manual bila ingin mengelola konfigurasi sendiri.

Sebelum menjalankan script instalasi yang diunduh, periksa isi script tersebut. Simpan `.env` dan semua secret yang dihasilkan dengan izin ketat; jangan commit, unggah ke website, atau membagikan `JWT_SECRET`, password database, password Studio, maupun secret lainnya. Pin versi yang dipasang dan ikuti prosedur upgrade resmi—hindari memperbarui image secara acak.

Tentukan alamat publik sesuai domain, aktifkan HTTPS pada reverse proxy, dan batasi akses Studio. Konfigurasikan SMTP jika alur Auth memerlukan email konfirmasi atau pemulihan password. Uji health/status tiap layanan melalui jaringan privat sebelum mengarahkan pelanggan ke server.

> Supabase self-hosted bukan sekadar satu container PostgreSQL. Docker Compose menjalankan sekumpulan layanan yang saling terkait; kebutuhan RAM dan tanggung jawab pemeliharaannya lebih besar daripada website statis biasa.

### 3. Terapkan skema dan konfigurasi aplikasi

1. Buat database/tabel `public.menus` beserta kolom yang dibutuhkan katalog dan admin; definisinya ada di [bagian Supabase pada README](../README.md#prasyarat-supabase).
2. Terapkan [migrasi pesanan](../supabase/migrations/20261025000000_orders.sql) pada database self-hosted. Fungsi pemesanan menggunakan skema Supabase Auth, role `anon`/`authenticated`, dan `auth.uid()`, jadi jalankan dalam stack Supabase yang sesuai, bukan PostgreSQL polos.
3. Buat pengguna admin pada Auth self-hosted, lalu masukkan UID barunya ke `public.order_admins`. Jangan menganggap UID atau password admin di proyek managed otomatis ada di server baru.
4. Buat ulang dan uji kebijakan RLS tabel `menus` untuk akses publik baca menu aktif dan akses admin mengubah menu.
5. Atur Auth Site URL dan URL redirect ke domain website produksi. Periksa SMTP dan alur login admin dari domain HTTPS.
6. Salin **project URL self-hosted** dan **publishable/anon key hasil konfigurasi server tersebut** ke `js/app.js` dan `js/admin.js`. Key dari proyek Supabase managed tidak berlaku sebagai konfigurasi server baru. Jangan pernah memakai `service_role` key di frontend.

### 4. Pindahkan data yang diperlukan

- Ekspor menu dari proyek lama (panel admin menyediakan ekspor JSON), lalu konversi/impor ke tabel `menus` baru dan cek tipe data serta status aktif.
- Uji seluruh query katalog dan operasi admin setelah impor.
- Jika memindahkan pesanan lama, gunakan prosedur ekspor/impor PostgreSQL yang cocok dengan versi dan skema; validasi relasi item pesanan, nomor antrean, dan data sensitif.
- Buat ulang akun admin pada Auth server baru. Jangan menyalin hash password atau tabel internal Auth secara manual tanpa prosedur migrasi resmi.
- Rencanakan perpindahan saat trafik dihentikan sementara, buat backup kedua sistem, dan siapkan cara kembali ke sistem lama bila uji gagal.

Sebelum DNS/QR dipindahkan, uji pemesanan dari awal hingga akhir: katalog publik, nomor antrean harian, status pelanggan setelah refresh, login admin, perubahan status, serta kebijakan akses pelanggan non-admin.

### 5. Sajikan website statis

Website tidak memerlukan proses Node.js/PHP untuk berjalan. Sajikan `index.html`, `admin.html`, `css/`, `js/`, dan `img/` dengan Nginx atau Caddy di domain website. Aktifkan HTTPS dan pastikan hanya file aplikasi publik yang tersedia. Jangan tempatkan file `.env`, dump database, backup, atau kredensial di web root.

Setelah domain dan HTTPS diuji, perbarui URL publik/metadata situs dan buat QR permanen dari URL website produksi. QR hanya perlu dibuat ulang jika URL situs berubah.

### Dependensi pihak ketiga di halaman web

Self-hosting server tidak otomatis berarti seluruh file yang dimuat browser juga berasal dari server sendiri. Saat ini halaman masih mengambil library Supabase dan Splide dari CDN, font dari Google Fonts, serta beberapa gambar menu/hero dari URL eksternal. Jika tujuanmu adalah menghilangkan ketergantungan runtime ke layanan pihak ketiga:

- Host salinan library frontend yang versinya dipin di folder aset lokal.
- Pindahkan gambar ke folder lokal atau Storage pada Supabase self-hosted, lalu perbarui URL gambar di menu.
- Hapus atau host sendiri font eksternal sesuai lisensi dan kebutuhan.
- Uji ulang CSP, URL aset, dan halaman katalog/admin setelah perubahan.

## Operasi dan keamanan berkelanjutan

Pada self-hosting, pemilik server bertanggung jawab atas patch OS, versi Docker dan Supabase, konfigurasi TLS, firewall, kapasitas, log, uptime, backup, serta pemulihan bencana. Managed backup dan beberapa fitur platform Supabase tidak otomatis tersedia saat self-hosting.

- Buat backup database otomatis ke penyimpanan **di luar VPS**; backup yang hanya tersimpan pada disk VPS tidak cukup jika server rusak.
- Uji pemulihan backup secara berkala pada lingkungan terpisah.
- Pantau ruang disk, penggunaan RAM/CPU, kesehatan container, kegagalan login, dan error pesanan.
- Lindungi Studio dan endpoint administratif; berikan akses hanya ke admin yang perlu.
- Atur pembaruan Supabase terencana setelah membaca catatan rilis; backup sebelum upgrade.
- Batasi pencatatan data pelanggan dan tetapkan jadwal retensi data yang sesuai kebutuhan outlet.
- QRIS otomatis tetap memerlukan payment gateway dan verifikasi callback yang aman; server sendiri saja tidak memverifikasi pembayaran.

Dokumentasi Supabase menjelaskan bahwa self-hosting membuatmu bertanggung jawab atas provisioning, hardening, pemeliharaan PostgreSQL, high availability, backup, pemulihan, dan monitoring. Supabase self-hosted juga berbeda dari Supabase CLI untuk development: **jangan mengekspos stack lokal CLI ke internet sebagai server produksi.**

Self-hosted Supabase merupakan proyek yang kamu operasikan sendiri dan dukungannya berbeda dari platform Supabase managed. Fitur seperti managed backup/PITR tidak otomatis tersedia.

## Batasan dan pertimbangan biaya

Software Supabase self-hosted dan Docker tersedia sebagai perangkat lunak yang dapat dijalankan sendiri, tetapi server, domain, backup eksternal, email SMTP, listrik/koneksi, dan waktu pemeliharaan dapat menimbulkan biaya. Tidak ada jaminan layanan gratis atau uptime hanya karena software-nya open source.

Untuk aplikasi outlet dengan satu server, Docker Compose lebih sederhana daripada Kubernetes. Pertimbangkan Kubernetes hanya jika tim memang membutuhkan deployment multi-server, high availability, dan siap mengelola kompleksitas tambahannya.

## Referensi resmi

- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [Self-Hosting Supabase dengan Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Instalasi Docker Engine](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/)
