// Template Seed Data untuk Dashboard Monitoring Dampak Bencana Sumatera
// COPY file ini menjadi 'seed-data.js' dan isi dengan data yang sesuai

const seedData = [
    // Contoh format data:
    {
        id: "contoh_1",
        provinsi: "Nama Provinsi",
        kabupaten: "Kab. Nama Kabupaten",
        tambakRusak: 0,          // Luas dalam Ha
        biayaTambak: 0,          // Biaya dalam Rupiah
        kolamRusak: 0,           // Luas dalam Ha
        biayaKolam: 0,           // Biaya dalam Rupiah
        kjaRusak: 0,             // Jumlah unit
        biayaKja: 0,             // Biaya dalam Rupiah
        saluran: 0,              // Volume dalam m³
        biayaSaluran: 0,         // Biaya dalam Rupiah
        pintuAir: 0,             // Luas dalam m²
        biayaPintuAir: 0,        // Biaya dalam Rupiah
        jalanProduksi: 0,        // Panjang dalam meter
        biayaJalan: 0,           // Biaya dalam Rupiah
        rehabBBI: 0,             // Luas dalam m²
        biayaBBI: 0,             // Biaya dalam Rupiah
        createdAt: new Date().toISOString()
    }
    // Tambahkan data lainnya di bawah ini...
];

// Load data ke localStorage
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        const existingData = localStorage.getItem('budidayaData');
        if (!existingData || JSON.parse(existingData).length === 0) {
            localStorage.setItem('budidayaData', JSON.stringify(seedData));
            console.log('✅ Seed data berhasil dimuat!');
        }
        
        if (typeof refreshAll === 'function') {
            refreshAll();
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { seedData };
}
