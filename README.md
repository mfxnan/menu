# Menu Rocket Chicken KS Tubun

Website katalog menu dan pemesanan Rocket Chicken outlet KS Tubun, Rejasari, Purwokerto. Pelanggan memilih menu, mengirim pesanan untuk mendapatkan nomor antrean, dan melihat status pesanan. Data menu, pesanan, dan autentikasi admin menggunakan Supabase.

## Fitur

### Katalog publik

- Memuat menu aktif dari tabel `menus` di Supabase.
- Mengelompokkan menu berdasarkan kategori, dengan urutan kategori yang ditentukan di aplikasi.
- Mendukung pencarian pada nama, deskripsi, kategori, dan kata pencarian tambahan.
- Menampilkan harga rupiah, foto menu, jumlah item, dan subtotal keranjang.
- Menyediakan tombol muat ulang untuk mengambil data terbaru.
- Menyediakan tampilan responsif untuk ponsel dan desktop.
- QR outlet dapat mengarah ke URL publik yang sama; pelanggan tidak perlu login.

### Keranjang dan pemesanan

- Jumlah setiap menu dapat ditambah atau dikurangi.
- Formulir checkout meminta nama, nomor HP opsional dengan keyboard angka di ponsel, catatan opsional, dan metode pembayaran tunai atau QRIS.
- Database menghitung ulang harga berdasarkan menu aktif dan memberi nomor antrean harian dalam format `001-251026` (nomor urut-hari/bulan/tahun). Hitungan kembali ke `001` setiap hari pukul 00.00 WIB.
- Pelanggan dapat melihat status pesanan menggunakan token pelacakan yang disimpan di browser.
- QRIS versi MVP dibayar manual menggunakan QR outlet di kasir; admin mengonfirmasi pembayaran.

### Admin (`admin.html`)

- Login dan logout menggunakan Supabase Authentication.
- Melihat hingga 100 pesanan terbaru, detail item, antrean, pembayaran, dan status.
- Menerima/menolak pesanan, memperbarui proses hingga selesai, dan mengonfirmasi pembayaran.
- Menambah dan mengubah nama, kategori, deskripsi, URL gambar, harga, serta kata pencarian menu.
- Mencari data menu, memuat ulang daftar, mengaktifkan atau menonaktifkan menu, dan mengekspor daftar yang dimuat sebagai JSON.
- Perubahan harga dan menu baru tampil pada katalog setelah berhasil disimpan ke Supabase.

## Struktur proyek

```text
.
|-- index.html       # Katalog dan checkout
|-- admin.html       # Panel pengelolaan menu
|-- css/
|   |-- style.css    # Gaya katalog
|   `-- admin.css    # Gaya panel admin
|-- js/
|   |-- app.js       # Katalog, keranjang, pemesanan, dan status antrean
|   |-- admin.js     # Autentikasi, pengelolaan menu, dan pesanan
|   `-- zoom-lock.js # Mencegah pinch zoom pada perangkat sentuh
|-- supabase/
|   `-- migrations/  # Skema dan fungsi pemesanan
`-- img/             # Aset gambar lokal
```

## Prasyarat Supabase

Aplikasi menggunakan Supabase JavaScript v2 yang dimuat dari CDN. Siapkan proyek Supabase dengan tabel `public.menus` dan kolom yang digunakan oleh aplikasi:

| Kolom              | Kegunaan                                                       |
| ------------------ | -------------------------------------------------------------- |
| `id`               | ID unik menu; digunakan untuk mengurutkan dan memperbarui item |
| `name`             | Nama menu                                                      |
| `price`            | Harga dalam rupiah, berupa angka bulat                         |
| `category`         | Kategori sumber                                                |
| `display_category` | Kategori yang ditampilkan pada katalog dan admin               |
| `description`      | Deskripsi menu                                                 |
| `image_url`        | URL publik gambar menu, opsional                               |
| `search_terms`     | Kata tambahan untuk pencarian                                  |
| `active`           | Status menu; hanya baris aktif ditampilkan pada katalog        |
| `sort_order`       | Urutan menu dalam kategori                                     |
| `updated_at`       | Waktu perubahan terakhir                                       |

Pastikan tabel dan tipe kolom sesuai data yang disimpan: `id` harus unik, `price` numerik, `active` boolean, `sort_order` numerik, dan kolom teks menyimpan nilai teks atau `NULL` bila sesuai. Admin menulis `name`, `price`, `category`, `display_category`, `description`, `image_url`, `search_terms`, `active`, dan `updated_at`.

### Autentikasi dan kebijakan akses

1. Buat pengguna admin di Supabase Authentication.
2. Aktifkan Row Level Security (RLS) pada `public.menus`.
3. Buat kebijakan `SELECT` untuk katalog publik yang hanya mengizinkan baris `active = true`.
4. Berikan `SELECT` semua baris serta `INSERT` dan `UPDATE` hanya kepada akun admin yang diizinkan. Batasi kebijakan berdasarkan `auth.uid()`/UID admin, bukan hanya karena pengguna berhasil login.
5. Uji akses menggunakan sesi anonim dan akun non-admin. Pastikan keduanya tidak dapat mengubah data atau membaca menu nonaktif.

Frontend memakai Supabase publishable key; key tersebut memang terlihat oleh browser dan bukan pengganti RLS. Jangan pernah menaruh `service_role` key atau kredensial rahasia di file frontend. Panel admin hanyalah antarmuka, sedangkan kebijakan RLS di database adalah batas keamanan yang sebenarnya.

### Menyiapkan pemesanan dan admin

1. Di Supabase SQL Editor, jalankan [migrasi pemesanan](supabase/migrations/20261025000000_orders.sql). Migrasi menambah tabel pesanan dan fungsi database untuk memeriksa menu aktif, menghitung total, membuat nomor antrean, melihat status dengan token, dan membatasi operasi admin. Jika migrasi pemesanan versi sebelumnya sudah pernah dijalankan, jalankan kembali skrip SQL yang sudah diperbarui ini agar format nomor antrean baru berlaku; skrip menggunakan `create or replace` dan tidak menghapus data pesanan.
2. Buat atau gunakan akun admin di Supabase Authentication, lalu salin UID akun tersebut.
3. Daftarkan UID sebagai admin pesanan di SQL Editor:

   ```sql
   insert into public.order_admins (user_id)
   values ('GANTI_DENGAN_UID_ADMIN');
   ```

4. Pastikan URL dan publishable key di `js/app.js` dan `js/admin.js` cocok dengan proyek Supabase. Jangan gunakan `service_role` key pada website.
5. Uji satu pesanan pelanggan beserta perubahan status di `/admin.html`. QRIS versi awal memakai QR statis di kasir; admin harus memastikan pembayaran sebelum menandainya lunas.
6. Buat QR outlet permanen dari URL GitHub Pages `https://mfxnan.github.io/menu/`. Uji URL tersebut dari ponsel sebelum mencetak QR; QR tetap sama selama URL situs tidak berubah.

Fungsi database dapat dipanggil dari browser, tetapi akses langsung ke tabel pesanan ditutup. Akun harus terdaftar pada `order_admins`. Tabel `menus` tetap memerlukan kebijakan RLS publik/admin tersendiri.

## Konfigurasi

Pengaturan koneksi dan nomor WhatsApp outlet berada di kode frontend:

- URL Supabase, publishable key katalog, dan nomor WhatsApp untuk pertanyaan outlet: `js/app.js`, pada objek `CONFIG`.
- URL Supabase dan publishable key panel admin: `js/admin.js`, pada konstanta di awal file.

Gunakan URL dan publishable key dari proyek Supabase yang sama pada kedua file. Nomor WhatsApp harus berupa nomor internasional tanpa tanda `+` atau pemisah, misalnya `62...`. Nomor yang saat ini tertanam adalah nomor outlet yang sudah dikonfigurasi di `app.js`.

Kategori tampilan di panel admin merupakan daftar opsi tetap yang didefinisikan pada `admin.html`. Kategori lain yang dimasukkan langsung ke database masih dapat muncul di katalog, tetapi tidak tersedia sebagai pilihan admin sampai opsi ditambahkan ke HTML.

## Menjalankan dan menerbitkan

Tidak ada langkah build atau instalasi paket: ini adalah aplikasi HTML, CSS, dan JavaScript statis.

Untuk uji lokal, jalankan server statis dari folder proyek, misalnya:

```powershell
py -m http.server 8000
```

Buka `http://localhost:8000/` untuk katalog dan `http://localhost:8000/admin.html` untuk panel admin. Koneksi internet dibutuhkan untuk Supabase, Google Fonts, Splide, serta gambar yang di-host secara eksternal.

Proyek dapat diterbitkan pada hosting statis seperti GitHub Pages. Atur URL Supabase dan kebijakan RLS sebelum digunakan. Setelah perubahan data menu, muat ulang katalog untuk memastikan harga yang tampil sesuai dengan database.

## Batasan MVP

- Pesanan berstatus menunggu konfirmasi sebelum diproses. Nomor antrean diberikan saat pesanan dikirim, dimulai kembali setiap hari pukul 00.00 WIB, dan ditampilkan dengan format `001-251026`.
- Pesanan tersimpan di database dan tidak hilang ketika pelanggan me-refresh halaman. Token untuk membuka status pesanan terakhir disimpan di browser; status dapat dipulihkan selama penyimpanan lokal tidak dihapus.
- QRIS belum terhubung ke payment gateway. Pembayaran tidak diverifikasi otomatis; admin harus memastikan pembayaran sebelum menandainya lunas.
- Nomor telepon opsional; nomor antrean yang muncul setelah pemesanan perlu dicatat pelanggan.
- Keranjang berada di memori halaman. Isinya hilang ketika halaman dimuat ulang atau ditutup.
- Tidak ada ketersediaan stok per item. Katalog hanya menampilkan baris aktif dan memberi label “Tersedia”.
- Menyimpan perubahan pada item yang sebelumnya nonaktif akan mengirim `active: true`, sehingga item tersebut aktif kembali.
- Ekspor JSON mengunduh data menu yang sedang dimuat di panel admin, termasuk baris nonaktif bila RLS mengizinkannya. Simpan file ekspor dengan akses yang sesuai.
- Halaman admin dan katalog memuat library dari CDN, sehingga fitur terkait memerlukan jaringan. Bila Supabase gagal diakses, katalog tidak dapat menampilkan data lokal sebagai fallback.
- Supabase Free memiliki kuota dan proyek dapat dijeda setelah tidak aktif. Periksa [harga dan batas Supabase](https://supabase.com/pricing) sebelum dipakai untuk operasional rutin.

## Dependensi eksternal

- Supabase JavaScript v2 untuk database dan autentikasi.
- Splide 4.1.4 untuk carousel kategori.
- Google Fonts (DM Sans dan Oswald).
- Gambar menu dan gambar hero dari URL yang disimpan/didefinisikan di aplikasi.

## Lisensi

Lihat [LICENSE](LICENSE). Aset, logo, dan merek Rocket Chicken tetap tunduk pada hak dan ketentuan pemiliknya.
