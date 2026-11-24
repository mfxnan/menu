# Gambar Menu & Aset Lokal

Folder ini menyimpan seluruh foto menu, logo, hero banner, dan gambar pratinjau link (`og-image.jpg`) secara lokal.

- Gunakan format **WebP** (lebar maks ±800px) dan nama file **huruf kecil tanpa spasi**, misalnya `paket-rocket-1.webp`.
- Di `admin.html` atau `data/menus.json`, isi kolom `image_url` menggunakan **path relatif**:

```text
img/nama-gambar.webp
```

Dengan path relatif, semua gambar otomatis berjalan di GitHub Pages, Cloudflare Pages, domain kustom, maupun localhost tanpa perlu mengubah URL.
