/**
 * Tabel koordinat wilayah.
 *
 * Spreadsheet tidak memuat kolom lintang/bujur, sehingga peta memerlukan
 * rujukan koordinat terpisah. Nilai di bawah adalah titik pusat administratif
 * (ibu kota kabupaten/kota) dari ketiga provinsi terdampak.
 *
 * Menambah wilayah baru: cukup tambahkan satu baris pada KOORDINAT_WILAYAH.
 * Kunci ditulis dalam huruf kecil tanpa awalan "Kab."/"Kota" - pencocokan
 * nama dari sheet dinormalisasi lebih dulu oleh cariKoordinat().
 */

const KOORDINAT_PROVINSI = {
    'aceh':           { lat: 4.6951,  lng: 96.7494 },
    'sumatera utara': { lat: 2.1154,  lng: 99.5451 },
    'sumatera barat': { lat: -0.7399, lng: 100.8000 }
};

const KOORDINAT_WILAYAH = {
    // --- Aceh ---
    'aceh barat':        { lat: 4.1436,  lng: 96.1268, provinsi: 'Aceh' },
    'aceh besar':        { lat: 5.2946,  lng: 95.6142, provinsi: 'Aceh' },
    'aceh selatan':      { lat: 3.2667,  lng: 97.1833, provinsi: 'Aceh' },
    'aceh singkil':      { lat: 2.2833,  lng: 97.7833, provinsi: 'Aceh' },
    'aceh tamiang':      { lat: 4.2833,  lng: 98.0167, provinsi: 'Aceh' },
    'aceh tengah':       { lat: 4.6167,  lng: 96.8500, provinsi: 'Aceh' },
    'aceh tenggara':     { lat: 3.4833,  lng: 97.8000, provinsi: 'Aceh' },
    'aceh timur':        { lat: 4.9333,  lng: 97.8000, provinsi: 'Aceh' },
    'aceh utara':        { lat: 5.0500,  lng: 97.3167, provinsi: 'Aceh' },
    'bener meriah':      { lat: 4.7500,  lng: 96.8500, provinsi: 'Aceh' },
    'bireuen':           { lat: 5.2000,  lng: 96.7000, provinsi: 'Aceh' },
    'gayo lues':         { lat: 3.9833,  lng: 97.3167, provinsi: 'Aceh' },
    'langsa':            { lat: 4.4683,  lng: 97.9683, provinsi: 'Aceh' },
    'lhokseumawe':       { lat: 5.1801,  lng: 97.1507, provinsi: 'Aceh' },
    'nagan raya':        { lat: 4.1667,  lng: 96.3833, provinsi: 'Aceh' },
    'pidie':             { lat: 5.3833,  lng: 95.9667, provinsi: 'Aceh' },
    'pidie jaya':        { lat: 5.2167,  lng: 96.1833, provinsi: 'Aceh' },

    // --- Sumatera Utara ---
    'asahan':            { lat: 2.9833,  lng: 99.6167, provinsi: 'Sumatera Utara' },
    'batu bara':         { lat: 3.2000,  lng: 99.4667, provinsi: 'Sumatera Utara' },
    'deli serdang':      { lat: 3.5500,  lng: 98.8667, provinsi: 'Sumatera Utara' },
    'humbang hasundutan':{ lat: 2.2667,  lng: 98.7833, provinsi: 'Sumatera Utara' },
    'langkat':           { lat: 3.7667,  lng: 98.4500, provinsi: 'Sumatera Utara' },
    'medan':             { lat: 3.5952,  lng: 98.6722, provinsi: 'Sumatera Utara' },
    'padang sidempuan':  { lat: 1.3735,  lng: 99.2681, provinsi: 'Sumatera Utara' },
    'sibolga':           { lat: 1.7427,  lng: 98.7792, provinsi: 'Sumatera Utara' },
    'tapanuli selatan':  { lat: 1.4667,  lng: 99.2667, provinsi: 'Sumatera Utara' },
    'tapanuli tengah':   { lat: 1.6833,  lng: 98.8500, provinsi: 'Sumatera Utara' },
    'tapanuli utara':    { lat: 2.0167,  lng: 98.9667, provinsi: 'Sumatera Utara' },

    // --- Sumatera Barat ---
    'agam':              { lat: -0.3000, lng: 100.0167, provinsi: 'Sumatera Barat' },
    'kepulauan mentawai':{ lat: -2.0833, lng: 99.6167,  provinsi: 'Sumatera Barat' },
    'limapuluh kota':    { lat: -0.1667, lng: 100.6333, provinsi: 'Sumatera Barat' },
    'padang':            { lat: -0.9471, lng: 100.4172, provinsi: 'Sumatera Barat' },
    'padang pariaman':   { lat: -0.5500, lng: 100.2833, provinsi: 'Sumatera Barat' },
    'pariaman':          { lat: -0.6269, lng: 100.1206, provinsi: 'Sumatera Barat' },
    'pasaman':           { lat: 0.1333,  lng: 100.1667, provinsi: 'Sumatera Barat' },
    'pesisir selatan':   { lat: -1.3500, lng: 100.5833, provinsi: 'Sumatera Barat' },
    'solok':             { lat: -0.7893, lng: 100.6551, provinsi: 'Sumatera Barat' },
    'tanah datar':       { lat: -0.4500, lng: 100.5833, provinsi: 'Sumatera Barat' }
};

/**
 * Ejaan yang berbeda-beda di spreadsheet untuk wilayah yang sama.
 * Kiri = tulisan pada sheet (sudah dinormalisasi), kanan = kunci resmi.
 */
const ALIAS_WILAYAH = {
    'lhoukseumawe': 'lhokseumawe',
    'batubara': 'batu bara',
    'lima puluh kota': 'limapuluh kota',
    'mentawai': 'kepulauan mentawai',
    'padangsidempuan': 'padang sidempuan',
    'padang sidimpuan': 'padang sidempuan'
};

/**
 * Cari koordinat dari nama wilayah apa adanya di sheet.
 * Mengembalikan null bila wilayah belum ada di tabel - pemanggil menghitungnya
 * sebagai "belum terpetakan" alih-alih menaruh penanda di titik yang salah.
 */
function cariKoordinat(nama) {
    let k = String(nama || '')
        .toLowerCase()
        .replace(/^\s*\d+[.)]?\s*/, '')          // nomor urut: "1 Aceh Utara"
        // Awalan saja, bukan setiap kemunculan - kalau "kota" dibuang di mana pun,
        // "Kab. Limapuluh Kota" ikut terpotong jadi "limapuluh" dan tak dikenali.
        .replace(/^(kabupaten|kab\.?|kota)\s+/, '')
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (ALIAS_WILAYAH[k]) k = ALIAS_WILAYAH[k];
    return KOORDINAT_WILAYAH[k] || null;
}

/**
 * Sebagian sel berisi dua wilayah yang tertulis menyatu tanpa pemisah,
 * mis. "Aceh Tamiang Aceh Timur". Bila nama utuhnya tidak dikenali, coba
 * belah di tiap spasi; kalau kedua potongannya dikenali, keduanya dipakai.
 * Selain kasus itu nama dikembalikan apa adanya.
 */
function pecahNamaGanda(nama) {
    const teks = String(nama || '').trim();
    if (!teks || cariKoordinat(teks)) return [teks];

    const kata = teks.split(/\s+/);
    for (let i = 1; i < kata.length; i++) {
        const kiri = kata.slice(0, i).join(' ');
        const kanan = kata.slice(i).join(' ');
        if (cariKoordinat(kiri) && cariKoordinat(kanan)) return [kiri, kanan];
    }
    return [teks];
}

function cariKoordinatProvinsi(nama) {
    const k = String(nama || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return KOORDINAT_PROVINSI[k] || null;
}
