# 🔴 JKT48 Ticket Monitor Dashboard

Aplikasi web dashboard berbasis client-side untuk memantau kuota dan sisa stok tiket event JKT48 (Meet & Greet, 2-Shot, dan Video Call) secara otomatis, akurat, dan real-time setiap 1 menit.

Sistem ini memantau rangkaian event JKT48 berikut:
*   **JKT48 Personal Meet and Greet Festival: LOVE DREAM PASSION**
*   **Love Dream Passion - Music Video Behind the Scenes**

## ⚙️ Arsitektur Baru (Real-Time 1 Menit)

Dashboard ini menggunakan arsitektur hybrid yang efisien dan gratis penuh:
1.  **Frontend (GitHub Pages)**: `index.html` yang ringan, responsif (menggunakan TailwindCSS), dan melakukan auto-refresh tampilan setiap 15 detik.
2.  **API Backend (Cloudflare Workers)**: Script serverless `cloudflare-worker.js` yang bertindak sebagai API proxy & parser. API ini mem-fetch data dari API resmi JKT48 secara paralel, merapikan strukturnya, dan menyimpannya di cache CDN Cloudflare selama **60 detik (1 menit)** demi menghindari pembatasan limit IP (*rate limiting*) dari JKT48.

```text
[Browser User] ──(Tiap 15s)──> [Cloudflare Worker API]
                                     │
                             (Cache expired? > 1 min)
                                     │
                                     ▼
                            [API Resmi JKT48]
```

## 🚀 Fitur Utama

*   **Pembaruan Tepat Waktu (1 Menit)**: Data dijamin segar dan diperbarui setiap 60 detik melalui Cloudflare Edge network tanpa delay antrean GitHub Actions.
*   **Smart Sorting**: Tiket oshi atau kuota member yang paling sedikit (hampir *sold out*) otomatis diurutkan ke bagian paling atas untuk mempermudah pemantauan saat *war* tiket.
*   **Multi-Filter & Live Search**: Menyaring kategori dan nama event secara instan serta pencarian nama member secara real-time.
*   **Visual Badge Status**: Menampilkan penanda status kuota secara dinamis (*Tersedia*, *Menipis* `<= 5`, atau *SOLD OUT*).
*   **Bebas CORS**: Menggunakan header *Access-Control-Allow-Origin: \** di sisi Cloudflare Worker sehingga browser tidak akan memblokir request.

---

## 🛠️ Struktur Repositori

```text
├── assets/                 # Aset media lokal
├── backend/                # Backend API (Cloudflare Worker)
│   ├── cloudflare-worker.js
│   └── wrangler.toml
├── index.html              # Template Frontend (SPA Dashboard)
├── script.js               # Logika Frontend (Pembaruan & Caching)
├── security.js             # Sistem Verifikasi Pertanyaan Keamanan
├── GetDataByJSON.html      # Halaman Dump JSON Parser (Tailwind CSS)
└── README.md               # Dokumentasi Proyek
```

---

## 💻 Cara Deploy Mandiri

### 1. Deploy API (Cloudflare Workers)
Buka terminal Anda di dalam folder `backend/` proyek ini dan jalankan perintah:
```bash
# Pindah ke direktori backend
cd backend

# Login ke akun Cloudflare Anda via browser
npx wrangler login

# Unggah dan deploy API Worker ke Cloudflare
npx wrangler deploy
```
*Setelah deploy selesai, salin URL Worker yang diberikan di terminal (misal: `https://jkt48-monitor-api.username.workers.dev`).*

### 2. Hubungkan Frontend
Buka berkas `script.js` dan perbarui nilai variabel `API_URL` pada baris ke-14 dengan URL Worker Anda:
```javascript
const API_URL = 'https://jkt48-monitor-api.username.workers.dev';
```

### 3. Deploy Frontend (GitHub Pages / Vercel)
Commit dan push perubahan ke repositori baru Anda untuk mengaktifkan halaman web:
```bash
git add .
git commit -m "Deploy setup monitor JKT48"
git push origin main
```
*Aktifkan GitHub Pages di tab **Settings > Pages** repositori Anda atau hubungkan ke Vercel untuk deployment otomatis.*