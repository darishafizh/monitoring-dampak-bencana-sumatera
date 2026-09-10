/**
 * Konfigurasi sumber data dashboard.
 *
 * Sumber data = Google Spreadsheet "Dashboard Rehabilitasi Bencana Sumatera".
 * File .xlsx di repo ini hanyalah salinan/arsip, bukan sumber yang dibaca web.
 *
 * SYARAT AKSES:
 *   Spreadsheet harus dishare  Share -> General access -> "Anyone with the link" (Viewer).
 *   Bila akses dicabut, dashboard otomatis memakai snapshot lokal (data-snapshot.js / data.js).
 *
 * CATATAN TEKNIS - kenapa memakai gid, bukan nama sheet:
 *   Endpoint gviz (?sheet=NamaSheet) DIAM-DIAM MEMBUANG baris teks pada kolom yang
 *   dianggapnya numerik. Pada sheet "Anggaran" itu menghilangkan seluruh baris label
 *   ("Pusat", "Daerah", "Aceh (pusat)", ...) sehingga angkanya jadi tanpa keterangan.
 *   Endpoint export?format=csv&gid=... mengembalikan isi sheet apa adanya, jadi itulah
 *   yang dipakai. Konsekuensinya tiap sheet perlu gid-nya masing-masing.
 *
 * CARA MENDAPATKAN gid:
 *   Buka tab sheet-nya di browser, lihat angka di akhir URL:
 *     https://docs.google.com/spreadsheets/d/<ID>/edit#gid=149281903
 *                                                            ^^^^^^^^^ ini gid-nya
 */
const DASHBOARD_CONFIG = {
    // https://docs.google.com/spreadsheets/d/17f55nIKhSuqzMFh6S5-gDW6UP7Ka-hA2Emr89OKpI98/edit
    SPREADSHEET_ID: '17f55nIKhSuqzMFh6S5-gDW6UP7Ka-hA2Emr89OKpI98',

    // Ketujuh tab pada spreadsheet. `name` hanya untuk keterbacaan & pesan error;
    // yang dipakai untuk mengambil data adalah `gid`.
    SHEETS: {
        lokasiTerdampak:   { name: 'Lokasi Terdampak',   gid: '0' },
        progres:           { name: 'Progres',            gid: '149281903' },
        anggaran:          { name: 'Anggaran',           gid: '1677136347' },
        realisasiAnggaran: { name: 'Realisasi Anggaran', gid: '1541017401' },
        berita:            { name: 'Berita',             gid: '1481312824' },
        rencanaAksi:       { name: 'Rencana Aksi',       gid: '1961242337' }
        // 'Sheet4' (gid 269284746) sengaja tidak dipakai: isinya 1 baris draft/contoh.
    },

    // Berapa lama hasil fetch di-cache di browser (menit). 0 = selalu ambil baru.
    CACHE_MINUTES: 5
};
