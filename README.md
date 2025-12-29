# Dashboard Monitoring Dampak Bencana Sumatera

Dashboard untuk monitoring dan visualisasi data dampak bencana pada infrastruktur perikanan budidaya di Sumatera.

## 🚀 Deploy ke Vercel

### Langkah Deploy:

1. **Push ke GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/USERNAME/REPO-NAME.git
   git push -u origin main
   ```

2. **Deploy via Vercel**
   - Kunjungi [vercel.com](https://vercel.com)
   - Login dengan akun GitHub
   - Klik **"Add New Project"**
   - Import repository dari GitHub
   - Klik **Deploy**

### Atau gunakan Vercel CLI:
```bash
npm i -g vercel
vercel login
vercel --prod
```

## 📁 Struktur File

```
├── index.html          # Halaman utama
├── style.css           # Styling
├── script.js           # Logika aplikasi
├── seed-data.js        # Data (TIDAK DI-COMMIT)
├── seed-data.example.js # Template data
├── export-functions.js  # Fungsi export PDF/PPT
├── vercel.json         # Konfigurasi Vercel
└── assets/             # Gambar dan icon
```

## 🔒 Keamanan Data

- File `seed-data.js` berisi data sensitif dan **tidak di-commit** ke repository
- Untuk setup lokal, copy `seed-data.example.js` menjadi `seed-data.js`
- Isi data sesuai kebutuhan

## 📋 Fitur

- ✅ Visualisasi peta interaktif (Leaflet.js)
- ✅ Grafik distribusi kerusakan (Chart.js)
- ✅ Tabel data dengan filter
- ✅ Export ke PDF dan PowerPoint
- ✅ Responsive design

## ⚠️ Catatan Penting

Jika Anda meng-clone repository ini:
1. Copy `seed-data.example.js` menjadi `seed-data.js`
2. Isi dengan data yang sesuai
3. File `seed-data.js` tidak akan ter-commit karena ada di `.gitignore`

---
© 2024 Kementerian Kelautan dan Perikanan RI
