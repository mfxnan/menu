# Menu Rocket Chicken KS Tubun (Statis)

Website **daftar menu dan harga online** yang 100% statis untuk Rocket Chicken outlet KS Tubun, Rejasari, Purwokerto. Data menu, harga, dan link kontak (WhatsApp, Google Maps, dan media sosial) disimpan di satu file JSON ([`data/menus.json`](data/menus.json)), sehingga dapat di-hosting gratis tanpa backend dan tanpa risiko database auto-pause di **Cloudflare Pages** maupun **GitHub Pages**.

## Fitur

### Katalog Publik (`index.html`)
- Memuat daftar menu aktif dan info outlet langsung dari `data/menus.json`.
- Navigasi kategori dengan carousel responsif (Splide) dan urutan kategori yang diatur dari JSON.
- **Pencarian lintas semua kategori** berdasarkan nama, deskripsi, kategori, dan kata pencarian tambahan.
- Tombol cepat ke **WhatsApp**, **Google Maps**, serta **Instagram / TikTok / Facebook** (tombol medsos yang dikosongkan otomatis tersembunyi).
- Seluruh foto produk, logo, dan gambar hero disimpan lokal dalam format **WebP** yang ringan (~1,5 MB untuk seluruh 35 gambar).

### Panel Editor Harga (`admin.html`)
- Berjalan 100% di browser tanpa login server/database.
- **Update harga cepat** langsung di kolom tabel tanpa harus membuka form satu per satu.
- Tambah, edit, aktif/nonaktifkan, atau hapus menu lengkap dengan pratinjau gambar lokal/URL.
- Edit **Info Outlet & Link Tombol Kontak** (WhatsApp, Google Maps, Instagram, TikTok, Facebook, alamat, jam buka).
- Draft perubahan otomatis tersimpan di `localStorage` browser selama belum diunduh.
- Mendukung **Unduh `menus.json`** dan **Impor JSON** (kompatibel juga dengan format backup JSON Supabase lama).

## Struktur Proyek

```text
.
├── index.html          # Halaman daftar menu & harga publik
├── admin.html          # Panel editor harga & info outlet (ekspor JSON)
├── data/
│   └── menus.json      # Database statis menu, harga, dan link outlet
├── css/
│   ├── style.css       # Gaya katalog publik
│   └── admin.css       # Gaya panel editor admin
├── js/
│   ├── app.js          # Render katalog, pencarian, dan link outlet dari JSON
│   └── admin.js        # Editor JSON lokal + impor/ekspor menus.json
└── img/                # Aset gambar lokal teroptimasi (WebP, logo.png, og-image.jpg)
```

## Cara Update Harga / Menu

1. Buka halaman `admin.html` (bisa dari URL situs publik seperti `/admin.html`, atau secara lokal).
2. Ubah harga langsung di kolom **Harga cepat (Rp)**, tambah/edit menu, atau perbarui link WhatsApp / Maps / medsos di bagian **Info Outlet**.
3. Klik tombol **Unduh menus.json**.
4. Buka repositori GitHub kamu → masuk ke folder `data/` → klik **Add file → Upload files** → unggah file `menus.json` yang baru diunduh → klik **Commit changes**.
5. GitHub Pages atau Cloudflare Pages akan otomatis men-deploy perubahan dalam ±30 detik.

## Cara Deploy Gratis

### Cloudflare Pages (Disarankan)
1. Masuk ke dashboard Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pilih repositori GitHub ini.
3. Pengaturan build:
   - **Framework preset**: `None`
   - **Build command**: *(kosongkan)*
   - **Build output directory**: `/` *(atau `.`)*
4. Klik **Save and Deploy**.

### GitHub Pages
1. Buka **Settings → Pages** di repositori GitHub ini.
2. Pada **Source**, pilih **Deploy from a branch** → branch `gh-pages`, folder `/ (root)`.
3. Simpan; situs aktif di `https://<username>.github.io/menu/`.

> Jika memakai domain khusus atau URL Cloudflare Pages, perbarui tag `og:image` dan `og:url` di `index.html` agar pratinjau link WhatsApp sesuai domain kamu.

## Uji Coba Lokal

Tidak butuh build tools atau instalasi paket. Jalankan server statis dari folder proyek:

```bash
python3 -m http.server 8000
```

Lalu buka:
- Katalog publik: `http://localhost:8000/`
- Panel editor harga: `http://localhost:8000/admin.html`

## Lisensi

Lihat [LICENSE](LICENSE). Aset, logo, dan merek Rocket Chicken tetap tunduk pada hak dan ketentuan pemiliknya.
