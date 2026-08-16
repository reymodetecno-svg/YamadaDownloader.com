# YamadaDownloader

Template website downloader dengan desain putih + biru muda, splash/loading, banner, credits, notifikasi WhatsApp 5 detik, bottom navigation, PWA/install app, dan Netlify Function.

## Struktur

- `index.html` — tampilan utama
- `style.css` — desain
- `app.js` — navigasi, UI downloader, PWA
- `api/download.mjs` — proxy aman ke API downloader
- `assets/banner-placeholder.svg` — ganti dengan banner sendiri
- `assets/logo.svg` — ganti dengan logo sendiri
- `manifest.webmanifest` + `sw.js` — supaya bisa di-install sebagai PWA
- `netlify.toml` — konfigurasi Netlify

## Jalankan di VS Code

1. Install Node.js LTS.
2. Buka folder ini di VS Code.
3. Untuk preview cepat, pakai Live Server atau jalankan server lokal.
4. Untuk mengetes Netlify Function secara lokal, install Netlify CLI lalu jalankan `netlify dev`.

## Konfigurasi yang perlu kamu ubah

Buka `app.js` dan ubah:

- `whatsappChannel`
- `customerService`

Untuk banner/logo, ganti:

- `assets/banner-placeholder.svg`
- `assets/logo.svg`

Kalau ingin pakai PNG/JPG, ubah path `src` di `index.html`.

## Downloader API

Frontend tidak bisa mengubah link TikTok/Instagram/YouTube menjadi file hanya dengan HTML/CSS/JS. Proyek ini memakai Netlify Function sebagai server-side proxy.

Set environment variable di Netlify:

`DOWNLOADER_API_URL=https://alamat-api-downloader-kamu/`

Jangan menaruh API key rahasia di JavaScript frontend. Netlify mendukung environment variable untuk Functions.

Untuk implementasi open-source yang kompatibel dengan request function ini, kamu bisa menjalankan instance Cobalt sendiri. Dokumentasi API Cobalt menjelaskan endpoint `POST /` dan response `redirect`, `tunnel`, atau `picker`.

Catatan: gunakan hanya konten yang memang boleh kamu unduh dan ikuti Terms of Service platform terkait.

## Deploy ke Netlify

### Cara paling mudah

1. Login ke Netlify.
2. Add new project / import project.
3. Upload folder project atau hubungkan repository Git.
4. Publish directory: `.`
5. Functions directory sudah diatur oleh `netlify.toml` menjadi `netlify/functions`.
6. Tambahkan `DOWNLOADER_API_URL` di Project configuration > Environment variables.
7. Deploy ulang setelah mengubah environment variable.

## Install sebagai aplikasi

Karena sudah PWA, browser yang mendukung akan menampilkan tombol `Install App` atau opsi "Install YamadaDownloader". Ini membuat versi aplikasi yang terasa seperti app tanpa perlu Play Store.

Kalau target akhirnya APK Android, project ini bisa dibungkus lagi menggunakan Capacitor setelah website sudah stabil.

## Penting

API downloader adalah bagian terpisah dari hosting frontend Netlify. Netlify cocok untuk website dan Function, tetapi mesin downloader yang memproses media sebaiknya dijalankan di server/container yang memang mendukung proses tersebut.
