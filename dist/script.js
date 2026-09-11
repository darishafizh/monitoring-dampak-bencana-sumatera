/**
 * Dashboard Rehabilitasi Pascabencana Sumatera - KKP
 *
 * ATURAN DATA: satu menu = satu sheet. Tidak ada data yang dicampur antar menu,
 * dan menu yang sheet-nya belum berisi data tidak ditampilkan sama sekali.
 *
 *   Lokasi Terdampak    <- sheet 'Lokasi Terdampak'
 *   Rencana Aksi        <- sheet 'Rencana Aksi'
 *   Progres             <- sheet 'Progres'
 *   Anggaran            <- sheet 'Anggaran'
 *   Dokumentasi         <- sheet 'Dokumentasi'
 *   Berita              <- sheet 'Berita'
 *
 * Sumber data live = Google Spreadsheet (lihat config.js). Bila tidak dapat diakses,
 * tiap menu jatuh ke snapshot sheet-nya sendiri di data-snapshot.js - tetap tidak dicampur.
 */
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // Helper umum
    // =========================================================================

    // Palet grafik memakai gradasi biru saja, supaya hijau/merah/oranye tetap
    // terbaca sebagai penanda status dan bukan sekadar variasi warna.
    const colors = {
        primary: '#2563eb',
        primaryDark: '#1e40af',
        primaryLight: '#93c5fd',
        neutral: '#cbd5e1',
        success: '#16a34a',
        warning: '#ea580c',
        danger: '#dc2626'
    };

    const chartPalette = [
        '#1e3a8a', '#1e40af', '#2563eb', '#3b82f6', '#60a5fa',
        '#93c5fd', '#bfdbfe', '#64748b', '#94a3b8', '#cbd5e1'
    ];

    /** Kelas status dari persentase capaian - dipakai bar & badge. */
    const kelasCapaian = (pct) => {
        if (pct >= 100) return 'is-success';
        if (pct >= 50) return '';
        if (pct > 0) return 'is-warning';
        return 'is-danger';
    };

    const badgeCapaian = (pct) => {
        if (pct >= 100) return 'badge-success';
        if (pct >= 50) return 'badge-primary';
        if (pct > 0) return 'badge-warning';
        return 'badge-danger';
    };

    /** Bar capaian: lebih cepat dibaca daripada deretan angka persen. */
    const barCapaian = (pct) => {
        const lebar = Math.max(0, Math.min(pct, 100));
        return '<div class="progress">' +
            '<span class="progress-track"><span class="progress-fill ' + kelasCapaian(pct) + '" ' +
                'style="width:' + lebar.toFixed(1) + '%"></span></span>' +
            '<span class="progress-value">' + pct.toFixed(1) + '%</span>' +
        '</div>';
    };

    /** Render ulang ikon Lucide setelah konten dinamis dimasukkan ke DOM. */
    const gambarIkon = () => {
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    };

    /** "Rp13.900.000.000" / "13,900,000,000" -> 13900000000 */
    const parseRupiah = (str) => {
        if (typeof str === 'number') return str;
        if (!str) return 0;
        const val = parseInt(String(str).replace(/[^0-9-]/g, ''), 10);
        return isNaN(val) ? 0 : val;
    };

    /** Angka bebas format ("2.007", "400,00", "2007") -> number */
    const parseAngka = (str) => {
        if (typeof str === 'number') return str;
        if (!str) return 0;
        const clean = String(str).trim().replace(/\.(?=\d{3}\b)/g, '').replace(/,/g, '.');
        const val = parseFloat(clean.replace(/[^0-9.-]/g, ''));
        return isNaN(val) ? 0 : val;
    };

    const formatRupiah = (num) => {
        if (!num) return '-';
        if (num >= 1e12) return `Rp ${(num / 1e12).toFixed(2)} Triliun`;
        if (num >= 1e9) return `Rp ${(num / 1e9).toFixed(2)} Miliar`;
        if (num >= 1e6) return `Rp ${(num / 1e6).toFixed(2)} Juta`;
        return new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR',
            minimumFractionDigits: 0, maximumFractionDigits: 0
        }).format(num);
    };

    const formatAngka = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(num || 0);

    const chartNumberFormat = (val) => {
        if (val >= 1e12) return (val / 1e12).toFixed(1) + 'T';
        if (val >= 1e9) return (val / 1e9).toFixed(1) + 'M';
        if (val >= 1e6) return (val / 1e6).toFixed(1) + 'Jt';
        return val;
    };

    /** Cegah HTML injection saat menulis nilai spreadsheet ke dalam halaman. */
    const esc = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    /** Sel berisi placeholder kosong (en dash, em dash, "-") dianggap kosong. */
    const cleanCell = (value) => {
        const v = String(value ?? '').trim();
        return ['–', '—', '�', '-'].includes(v) ? '' : v;
    };

    /** Ambil file id dari URL Google Drive (/file/d/<id>/... atau ?id=<id>). */
    const driveFileId = (url) => {
        const s = String(url || '');
        const m = s.match(/\/file\/d\/([^/?#]+)/) || s.match(/[?&]id=([^&#]+)/);
        return m ? m[1] : '';
    };

    const dash = (str) => {
        const v = String(str ?? '').trim();
        return v === '' ? '-' : esc(v);
    };

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const populateSelect = (elementId, values, placeholder) => {
        const select = document.getElementById(elementId);
        if (!select) return;
        select.innerHTML = `<option value="">${placeholder}</option>`;
        values.forEach(val => {
            const option = document.createElement('option');
            option.value = val;
            option.textContent = val.length > 80 ? val.substring(0, 80) + '...' : val;
            select.appendChild(option);
        });
    };

    /** Pagination generik untuk semua tabel. */
    const renderPagination = (containerId, totalItems, page, perPage, onChange) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const totalPages = Math.ceil(totalItems / perPage);
        if (totalPages <= 1) return;

        const info = document.createElement('div');
        info.className = 'page-info';
        const startIdx = (page - 1) * perPage + 1;
        const endIdx = Math.min(startIdx + perPage - 1, totalItems);
        info.textContent = `Menampilkan ${startIdx}-${endIdx} dari ${totalItems} baris data`;
        container.appendChild(info);

        const mkBtn = (label, targetPage, disabled) => {
            const btn = document.createElement('button');
            btn.className = 'page-btn';
            btn.textContent = label;
            btn.disabled = disabled;
            btn.addEventListener('click', () => onChange(targetPage));
            container.appendChild(btn);
        };

        mkBtn('Sebelumnya', page - 1, page === 1);
        mkBtn('Selanjutnya', page + 1, page === totalPages);
        gambarIkon();
    };

    // =========================================================================
    // Penyimpanan data - satu properti per sheet, tidak pernah saling mengisi
    // =========================================================================

    const store = {
        terdampak: [],      // sheet 'Lokasi Terdampak'
        aksi: [],           // sheet 'Rencana Aksi'
        progres: [],        // sheet 'Progres'
        anggaran: null,     // sheet 'Anggaran'            (blok laporan)
        realisasi: null,    // sheet 'Realisasi Anggaran'  (digabung ke menu Anggaran)
        dokumentasiRows: [], // sheet 'Dokumentasi'        (baris mentah: Before | After)
        dokumentasi: [],    // hasil normalisasi pasangan before/after
        berita: [],         // sheet 'Berita'
        liveSheets: [],
        sheetKosong: []
    };

    // =========================================================================
    // Navigasi - menu hanya muncul bila sheet-nya berisi data
    // =========================================================================

    /** Judul & deskripsi tiap menu, ditampilkan di kepala halaman. */
    const INFO_MENU = {
        terdampak:   ['Lokasi Terdampak', 'Sebaran pelaku usaha, sarana, dan lahan yang terdampak bencana'],
        aksi:        ['Rencana Aksi', 'Program dan alokasi anggaran pemulihan tahun 2026 - 2028'],
        progres:     ['Progres Pelaksanaan', 'Capaian kegiatan pemulihan per kabupaten/kota'],
        anggaran:    ['Anggaran & Realisasi', 'Usulan, alokasi, dan serapan anggaran pemulihan'],
        dokumentasi: ['Dokumentasi', 'Perbandingan kondisi sebelum dan sesudah penanganan'],
        penerima:    ['Penerima Bantuan', 'Sebaran titik penerima bantuan hasil survei lapangan'],
        berita:      ['Berita & Publikasi', 'Liputan media atas pelaksanaan pemulihan']
    };

    const MENUS = [
        { page: 'terdampak', ada: () => store.terdampak.length > 0 },
        { page: 'aksi',      ada: () => store.aksi.length > 0 },
        { page: 'progres',   ada: () => store.progres.length > 0 },
        // Menu 'Anggaran' menggabungkan sheet 'Anggaran' dan 'Realisasi Anggaran'.
        { page: 'anggaran',  ada: () => store.anggaran !== null || store.realisasi !== null },
        { page: 'dokumentasi', ada: () => store.dokumentasi.length > 0 },
        { page: 'penerima',  ada: () => penerimaState.semua.length > 0 },
        { page: 'berita',    ada: () => store.berita.length > 0 }
    ];

    const menuAktif = () => MENUS.filter(m => m.ada()).map(m => m.page);

    /**
     * Grafik ulang halaman aktif. Diisi di bagian bawah berkas, setelah fungsi
     * render tiap menu terdefinisi.
     */
    const RENDER_HALAMAN = {};

    /** Lupakan seluruh instance grafik supaya render berikutnya membuat ulang. */
    const lupakanGrafik = () => {
        terdampakState.charts = { jenis: null, kategori: null };
        aksiState.charts = { tahun: null, provinsi: null };
        chartAnggaran = null;
        realisasiState.charts = { kelompok: null, sumber: null };
        penerimaState.charts = { kerusakan: null, kab: null };
    };

    /**
     * Siapkan grafik pada halaman yang baru ditampilkan.
     *
     * Grafik dibuat saat halamannya masih display:none, sehingga Chart.js
     * mencatat ukuran kanvas 0x0 - dan sekali terkunci begitu, ukurannya TIDAK
     * bisa dipulihkan: resize(), resize(w,h), maupun update() sama-sama tidak
     * berpengaruh karena gaya inline kanvasnya sudah 0px. Satu-satunya jalan
     * adalah membuang instance yang terlanjur nol lalu membiarkan fungsi render
     * halaman itu membuatnya kembali saat kontainernya sudah punya lebar.
     */
    const resizeGrafik = (pageEl, nama) => {
        if (!pageEl || !window.Chart) return;

        let adaYangNol = false;
        pageEl.querySelectorAll('canvas').forEach(cv => {
            const ch = Chart.getChart(cv);
            if (!ch) return;
            const lebarKotak = cv.parentElement.getBoundingClientRect().width;
            if (cv.width === 0 && lebarKotak > 0) {
                ch.destroy();
                adaYangNol = true;
            } else {
                ch.resize();
            }
        });

        if (adaYangNol) {
            lupakanGrafik();
            const render = RENDER_HALAMAN[nama];
            if (render) render();
        }
    };

    const showPage = (name) => {
        const tersedia = menuAktif();
        if (!tersedia.length) return;
        if (!tersedia.includes(name)) name = tersedia[0];

        document.querySelectorAll('.nav-link').forEach(link => {
            const isActive = link.dataset.page === name;
            link.classList.toggle('active', isActive);
            if (isActive) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });

        MENUS.forEach(m => {
            const el = document.getElementById(`page-${m.page}`);
            if (el) el.classList.toggle('active', m.page === name);
        });

        const info = INFO_MENU[name];
        if (info) {
            setText('page-title', info[0]);
            setText('page-desc', info[1]);
        }

        if (history.replaceState) history.replaceState(null, '', `#${name}`);

        // Grafik dibuat saat halamannya masih display:none, sehingga canvas-nya
        // berukuran 0x0. Event resize global tidak selalu memicu Chart.js
        // mengukur ulang, jadi tiap grafik di halaman aktif di-resize eksplisit
        // setelah layout selesai dihitung.
        const pageEl = document.getElementById(`page-${name}`);
        resizeGrafik(pageEl, name);
        resizePeta(pageEl, name);
    };

    /** Sembunyikan tombol & halaman milik sheet yang kosong. */
    const syncMenuVisibility = () => {
        const tersedia = menuAktif();

        MENUS.forEach(m => {
            const punya = tersedia.includes(m.page);
            const btn = document.querySelector(`.nav-link[data-page="${m.page}"]`);
            const page = document.getElementById(`page-${m.page}`);
            if (btn) btn.hidden = !punya;
            if (!punya && page) page.classList.remove('active');
        });

        const navBar = document.querySelector('.nav-menu');
        if (navBar) navBar.hidden = tersedia.length === 0;

        const kosong = document.getElementById('no-data');
        if (kosong) kosong.hidden = tersedia.length > 0;

        const aktifSekarang = (location.hash || '').replace('#', '');
        showPage(tersedia.includes(aktifSekarang) ? aktifSekarang : tersedia[0]);
    };

    const setupNav = () => {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => showPage(link.dataset.page));
        });

        // Dukung tombol back/forward dan deep link (#terdampak, #aksi, dst)
        window.addEventListener('hashchange', () => {
            showPage((location.hash || '').replace('#', ''));
        });
    };

    // =========================================================================
    // Pemetaan kolom per sheet
    // =========================================================================

    const MAPPING_TERDAMPAK = {
        no: ['No'],
        provinsi: ['Provinsi'],
        kabKota: ['Kabupaten/Kota', 'Kab/Kota'],
        // Sheet memakai "Kategori" (tingkat 1) + "Besaran" (tingkat 2);
        // sebagian versi memakai "Jenis" + "Kategori". Urutan alias menjaga keduanya cocok.
        jenis: ['Jenis', 'Kategori'],
        kategori: ['Besaran', 'Kategori'],
        jumlah: ['Jumlah'],
        satuan: ['Satuan']
    };

    const MAPPING_AKSI = {
        no: ['No'],
        provinsi: ['Provinsi'],
        program: ['Program'],
        kegiatan: ['Kegiatan'],
        lokasi: ['Lokasi (Kab/Kota)', 'Lokasi', 'Kab/Kota'],
        sumber: ['Sumber Pembiayaan - Kewenangan/Urusan', 'Sumber Pembiayaan', 'Sumber Dana'],
        output2026: ['Output 2026'],
        anggaran2026: ['Anggaran 2026'],
        output2027: ['Output 2027'],
        anggaran2027: ['Anggaran 2027'],
        output2028: ['Output 2028'],
        anggaran2028: ['Anggaran 2028'],
        totalAnggaran: ['Total Anggaran']
    };

    const MAPPING_PROGRES = {
        no: ['No'],
        unitEselon: ['Unit Eselon I', 'Unit Eselon'],
        kabKota: ['Kab/Kota', 'Kabupaten/Kota'],
        kegiatan: ['Kegiatan'],
        desa: ['Desa', 'Lokasi (Desa/Kec)', 'Lokasi'],
        targetVolume: ['Target Volume'],
        targetSatuan: ['Target Satuan'],
        targetAnggaran: ['Target Anggaran'],
        realisasiVolume: ['Realisasi Volume'],
        realisasiSatuan: ['Realisasi Satuan'],
        realisasiAnggaran: ['Realisasi Anggaran'],
        persentase: ['Persentase Realisasi'],
        targetPenyelesaian: ['Target Penyelesaian'],
        penerima: ['Jumlah Penerima (Dinas/Kelompok/Orang)', 'Jumlah Penerima'],
        keterangan: ['Keterangan (Sumber Anggaran)', 'Keterangan'],
        statusBantuan: ['Status Bantuan', 'Status']
    };

    const MAPPING_BERITA = {
        no: ['No'],
        media: ['Media'],
        tanggal: ['Tanggal Terbit', 'Tanggal'],
        judul: ['Judul Artikel', 'Judul'],
        link: ['Link berita', 'Link'],
        linkDokumentasi: ['link dokumentasi', 'Link Dokumentasi']
    };

    // =========================================================================
    // Pemuatan data
    // =========================================================================

    const updateDataSourceBadge = () => {
        const box = document.getElementById('data-source');
        const btn = document.getElementById('btn-refresh');
        if (!box) return;

        box.classList.remove('is-live', 'is-snapshot');

        if (!SheetsLoader.isEnabled()) {
            box.classList.add('is-snapshot');
            setText('data-source-text',
                'Sumber data: snapshot lokal (isi SPREADSHEET_ID di config.js untuk data live)');
            if (btn) btn.disabled = true;
            return;
        }

        if (btn) btn.disabled = false;
        const total = Object.keys(DASHBOARD_CONFIG.SHEETS).length;

        if (store.liveSheets.length === 0) {
            box.classList.add('is-snapshot');
            setText('data-source-text',
                'Spreadsheet tidak dapat diakses - memakai snapshot lokal. Pastikan sheet dishare "Anyone with the link".');
            return;
        }

        box.classList.add('is-live');
        setText('data-source-text',
            `Live dari Google Spreadsheet - ${store.liveSheets.length}/${total} sheet berisi data` +
            (store.sheetKosong.length ? ` (kosong: ${store.sheetKosong.join(', ')})` : '') +
            ` - ${new Date().toLocaleTimeString('id-ID')}`);
    };

    const loadData = async () => {
        const S = DASHBOARD_CONFIG.SHEETS;
        store.liveSheets = [];
        store.sheetKosong = [];

        const [terdampak, aksi, progres, anggaranLive, realisasiLive, dokumentasiRows, berita] =
            await Promise.all([
                SheetsLoader.fetchSheet(S.lokasiTerdampak, MAPPING_TERDAMPAK),
                SheetsLoader.fetchSheet(S.rencanaAksi, MAPPING_AKSI),
                SheetsLoader.fetchSheet(S.progres, MAPPING_PROGRES),
                SheetsLoader.fetchRows(S.anggaran),
                SheetsLoader.fetchRows(S.realisasiAnggaran),
                SheetsLoader.fetchRows(S.dokumentasi),
                SheetsLoader.fetchSheet(S.berita, MAPPING_BERITA)
            ]);

        const catat = (data, nama) => {
            if (data && data.length) store.liveSheets.push(nama);
            else store.sheetKosong.push(nama);
        };

        catat(terdampak, S.lokasiTerdampak.name);
        catat(aksi, S.rencanaAksi.name);
        catat(progres, S.progres.name);
        catat(anggaranLive, S.anggaran.name);
        catat(realisasiLive, S.realisasiAnggaran.name);
        catat(dokumentasiRows, S.dokumentasi.name);
        catat(berita, S.berita.name);

        // Fallback selalu ke snapshot SHEET YANG SAMA, tidak pernah ke sheet lain.
        // Dicek dengan `typeof` karena data-snapshot.js mendeklarasikan `const`,
        // yang tidak menjadi properti `window`.
        const snapTerdampak = typeof lokasiTerdampakData !== 'undefined' ? lokasiTerdampakData : [];
        const snapAksi = typeof rencanaAksiData !== 'undefined' ? rencanaAksiData : [];
        const snapProgres = typeof progresData !== 'undefined' ? progresData : [];
        const snapAnggaran = typeof anggaranRows !== 'undefined' ? anggaranRows : null;
        const snapRealisasi = typeof realisasiAnggaranRows !== 'undefined' ? realisasiAnggaranRows : null;
        const snapDokumentasi = typeof dokumentasiRows_snapshot !== 'undefined' ? dokumentasiRows_snapshot : [];
        const snapBerita = typeof beritaData !== 'undefined' ? beritaData : [];

        store.terdampak = normalizeTerdampak(terdampak || snapTerdampak);
        store.aksi = normalizeAksi(aksi || snapAksi);
        store.progres = normalizeProgres(progres || snapProgres);
        store.anggaran = parseAnggaran(anggaranLive || snapAnggaran);
        store.realisasi = parseRealisasi(realisasiLive || snapRealisasi);
        store.dokumentasiRows = dokumentasiRows || snapDokumentasi;
        store.dokumentasi = normalizeDokumentasi(store.dokumentasiRows);
        store.berita = normalizeBerita(berita || snapBerita);

        updateDataSourceBadge();
    };

    // =========================================================================
    // MENU 1 - LOKASI TERDAMPAK
    // =========================================================================

    const normalizeTerdampak = (rows) => rows
        .map((item, index) => ({
            id: index,
            no: cleanCell(item.no) || String(index + 1),
            provinsi: cleanCell(item.provinsi),
            kabKota: cleanCell(item.kabKota),
            jenis: cleanCell(item.jenis),
            kategori: cleanCell(item.kategori),
            jumlah: parseAngka(item.jumlah),
            satuan: cleanCell(item.satuan)
        }))
        .filter(item => item.provinsi && item.provinsi.toLowerCase() !== 'provinsi');

    const terdampakState = {
        filtered: [],
        page: 1,
        perPage: 15,
        filters: { provinsi: '', search: '' },
        charts: { jenis: null, kategori: null }
    };

    /** { label: { total, bySatuan: { satuan: nilai } } } */
    const groupTerdampak = (rows, key) => {
        const acc = {};
        rows.forEach(item => {
            const label = item[key] || 'Lainnya';
            if (!acc[label]) acc[label] = { total: 0, bySatuan: {} };
            acc[label].total += item.jumlah;
            const sat = item.satuan || 'Tanpa satuan';
            acc[label].bySatuan[sat] = (acc[label].bySatuan[sat] || 0) + item.jumlah;
        });
        return acc;
    };

    const donutOptions = (grouped) => ({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
            legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const entry = grouped[ctx.label];
                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0.0';
                        const lines = [` Total: ${formatAngka(ctx.raw)} (${pct}%)`];
                        if (entry) {
                            Object.entries(entry.bySatuan)
                                .sort((a, b) => b[1] - a[1])
                                .forEach(([sat, val]) => lines.push(`   - ${formatAngka(val)} ${sat}`));
                        }
                        return lines;
                    }
                }
            }
        }
    });

    const renderTerdampakDonut = (canvasId, chartKey, grouped) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const entries = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);
        const labels = entries.map(e => e[0]);
        const values = entries.map(e => e[1].total);
        const warna = labels.map((_, i) => chartPalette[i % chartPalette.length]);

        const existing = terdampakState.charts[chartKey];
        if (existing) {
            existing.data.labels = labels;
            existing.data.datasets[0].data = values;
            existing.data.datasets[0].backgroundColor = warna;
            existing.options = donutOptions(grouped);
            existing.update();
            return;
        }

        terdampakState.charts[chartKey] = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: values, backgroundColor: warna, borderWidth: 2, borderColor: '#ffffff' }]
            },
            options: donutOptions(grouped)
        });
    };

    /**
     * Ringkasan harus dihitung per JENIS lalu per SATUAN, bukan per satuan saja.
     * Kalau hanya per satuan, "Unit Pengolah Ikan" (jenis Pelaku Usaha, satuan Unit)
     * ikut terhitung sebagai sarana/prasarana - padahal itu pelaku usaha.
     */
    const renderTerdampakSummary = () => {
        const rows = terdampakState.filtered;

        const satuanNorm = (s) => (s || '').toLowerCase().replace(/\s+/g, '');
        // Nama jenis pernah berubah (Infrastruktur -> Sarana Prasarana), jadi
        // pembedanya dicek lewat kata "pelaku", bukan pencocokan persis.
        const isPelakuUsaha = (item) => /pelaku/i.test(item.jenis);
        const total = (pred) => rows.filter(pred).reduce((s, i) => s + i.jumlah, 0);

        const orangPelaku = total(i => isPelakuUsaha(i) && satuanNorm(i.satuan) === 'orang');
        const unitSarana = total(i => !isPelakuUsaha(i) && satuanNorm(i.satuan) === 'unit');
        const luasHa = total(i => satuanNorm(i.satuan) === 'ha');

        // Kab/kota: pakai kolom "Kabupaten/Kota" bila terisi; bila kolom itu masih
        // kosong, pakai baris yang satuannya memang "Kab/Kota".
        const kabKotaUnik = new Set(rows.map(r => r.kabKota).filter(Boolean));
        const kabKotaDariSatuan = total(i => satuanNorm(i.satuan) === 'kab/kota');
        const kabKota = kabKotaUnik.size || kabKotaDariSatuan;

        setText('td-stat-orang', formatAngka(orangPelaku));
        setText('td-stat-unit', formatAngka(unitSarana));
        setText('td-stat-ha', formatAngka(luasHa));
        setText('td-stat-kabkota', formatAngka(kabKota));
    };

    const renderTerdampakTable = () => {
        const tbody = document.getElementById('td-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const rows = terdampakState.filtered;
        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="table-empty">
                <strong>Tidak ada data yang ditemukan.</strong>
                Coba ubah filter provinsi atau kata kunci pencarian.
            </td></tr>`;
            renderPagination('td-pagination', 0, 1, terdampakState.perPage, () => {});
            return;
        }

        const start = (terdampakState.page - 1) * terdampakState.perPage;
        rows.slice(start, start + terdampakState.perPage).forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dash(item.no)}</td>
                <td>${dash(item.provinsi)}</td>
                <td>${dash(item.kabKota)}</td>
                <td><span class="badge badge-primary">${dash(item.jenis)}</span></td>
                <td class="cell-truncate" title="${esc(item.kategori)}">${dash(item.kategori)}</td>
                <td class="num cell-strong">${formatAngka(item.jumlah)}</td>
                <td>${dash(item.satuan)}</td>
            `;
            tbody.appendChild(tr);
        });

        renderPagination('td-pagination', rows.length, terdampakState.page, terdampakState.perPage, (p) => {
            terdampakState.page = p;
            renderTerdampakTable();
        });
    };

    const renderTerdampak = () => {
        renderTerdampakSummary();
        renderTerdampakDonut('chart-jenis', 'jenis', groupTerdampak(terdampakState.filtered, 'jenis'));
        renderTerdampakDonut('chart-kategori', 'kategori', groupTerdampak(terdampakState.filtered, 'kategori'));
        renderTerdampakTable();
    };

    const applyTerdampakFilters = () => {
        const { provinsi, search } = terdampakState.filters;
        terdampakState.filtered = store.terdampak.filter(item => {
            const matchProvinsi = !provinsi || item.provinsi === provinsi;
            const matchSearch = !search || [item.provinsi, item.kabKota, item.jenis, item.kategori, item.satuan]
                .some(v => (v || '').toLowerCase().includes(search));
            return matchProvinsi && matchSearch;
        });
        terdampakState.page = 1;
        renderTerdampak();
    };

    const setupTerdampak = () => {
        populateSelect('td-filter-provinsi',
            [...new Set(store.terdampak.map(i => i.provinsi).filter(Boolean))].sort(), 'Semua Provinsi');

        document.getElementById('td-filter-provinsi')?.addEventListener('change', (e) => {
            terdampakState.filters.provinsi = e.target.value;
            applyTerdampakFilters();
        });
        document.getElementById('td-search')?.addEventListener('input', (e) => {
            terdampakState.filters.search = e.target.value.toLowerCase();
            applyTerdampakFilters();
        });
        document.getElementById('td-btn-reset')?.addEventListener('click', () => {
            ['td-filter-provinsi', 'td-search'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            terdampakState.filters = { provinsi: '', search: '' };
            applyTerdampakFilters();
        });

        applyTerdampakFilters();
    };

    // =========================================================================
    // MENU 2 - RENCANA AKSI
    // =========================================================================

    const normalizeAksi = (rows) => rows
        .map((item, index) => {
            const a2026 = parseRupiah(item.anggaran2026);
            const a2027 = parseRupiah(item.anggaran2027);
            const a2028 = parseRupiah(item.anggaran2028);
            const totalKolom = parseRupiah(item.totalAnggaran);

            return {
                id: index,
                no: cleanCell(item.no) || String(index + 1),
                provinsi: cleanCell(item.provinsi),
                program: cleanCell(item.program),
                kegiatan: cleanCell(item.kegiatan),
                lokasi: cleanCell(item.lokasi).replace(/\s*\n\s*/g, ' '),
                sumber: cleanCell(item.sumber),
                output2026: cleanCell(item.output2026),
                output2027: cleanCell(item.output2027),
                output2028: cleanCell(item.output2028),
                anggaran2026: a2026,
                anggaran2027: a2027,
                anggaran2028: a2028,
                // Pakai kolom Total bila terisi; bila kosong, jumlahkan per tahun.
                totalAnggaran: totalKolom || (a2026 + a2027 + a2028)
            };
        })
        .filter(item => item.provinsi && item.provinsi.toLowerCase() !== 'provinsi');

    /**
     * Kolom lokasi berisi beberapa kab/kota dipisah ";", kadang berawalan nomor
     * urut ("1 Aceh Utara; 2 Aceh Selatan"). Nomor itu dibuang supaya nama
     * wilayah yang sama tidak terhitung sebagai dua wilayah berbeda.
     */
    const pecahLokasi = (lokasi) => (lokasi || '')
        .split(/[;\n]/)
        .map(x => x.replace(/^\s*\d+[.)]?\s*/, '').trim())
        .filter(x => x.length > 2);

    const aksiState = {
        filtered: [],
        page: 1,
        perPage: 15,
        filters: { provinsi: '', kegiatan: '', sumber: '', search: '' },
        charts: { tahun: null, provinsi: null }
    };

    const renderAksiSummary = () => {
        const rows = aksiState.filtered;
        const totalAnggaran = rows.reduce((s, r) => s + r.totalAnggaran, 0);
        const kegiatanSet = new Set(rows.map(r => r.kegiatan).filter(Boolean));
        const kabKotaSet = new Set();
        rows.forEach(r => pecahLokasi(r.lokasi).forEach(k => kabKotaSet.add(k)));

        setText('ra-stat-anggaran', totalAnggaran ? formatRupiah(totalAnggaran) : 'Rp 0');
        setText('ra-stat-aksi', rows.length);
        setText('ra-stat-kegiatan', kegiatanSet.size);
        setText('ra-stat-kabkota', kabKotaSet.size);
    };

    const renderAksiCharts = () => {
        const rows = aksiState.filtered;

        // 1. Anggaran per tahun
        const perTahun = [
            rows.reduce((s, r) => s + r.anggaran2026, 0),
            rows.reduce((s, r) => s + r.anggaran2027, 0),
            rows.reduce((s, r) => s + r.anggaran2028, 0)
        ];
        const cvTahun = document.getElementById('chart-ra-tahun');
        if (cvTahun) {
            if (aksiState.charts.tahun) {
                aksiState.charts.tahun.data.datasets[0].data = perTahun;
                aksiState.charts.tahun.update();
            } else {
                aksiState.charts.tahun = new Chart(cvTahun.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: ['2026', '2027', '2028'],
                        datasets: [{
                            label: 'Alokasi Anggaran', data: perTahun,
                            backgroundColor: colors.primary, borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: (ctx) => ' ' + formatRupiah(ctx.raw) } }
                        },
                        scales: { y: { beginAtZero: true, ticks: { callback: (v) => chartNumberFormat(v) } } }
                    }
                });
            }
        }

        // 2. Proporsi per provinsi
        const perProvinsi = {};
        rows.forEach(r => {
            if (!r.provinsi) return;
            perProvinsi[r.provinsi] = (perProvinsi[r.provinsi] || 0) + r.totalAnggaran;
        });
        const labels = Object.keys(perProvinsi);
        const values = Object.values(perProvinsi);
        const warna = labels.map((_, i) => chartPalette[i % chartPalette.length]);

        const cvProv = document.getElementById('chart-ra-provinsi');
        if (cvProv) {
            if (aksiState.charts.provinsi) {
                aksiState.charts.provinsi.data.labels = labels;
                aksiState.charts.provinsi.data.datasets[0].data = values;
                aksiState.charts.provinsi.data.datasets[0].backgroundColor = warna;
                aksiState.charts.provinsi.update();
            } else {
                aksiState.charts.provinsi = new Chart(cvProv.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels,
                        datasets: [{ data: values, backgroundColor: warna, borderWidth: 2, borderColor: '#ffffff' }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '62%',
                        plugins: {
                            legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const tot = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                        const pct = tot > 0 ? ((ctx.raw / tot) * 100).toFixed(1) : '0.0';
                                        return ' ' + formatRupiah(ctx.raw) + ' (' + pct + '%)';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    };

    const renderAksiTable = () => {
        const tbody = document.getElementById('ra-table-body');
        if (!tbody) return;

        const rows = aksiState.filtered;
        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="13" class="table-empty">' +
                '<strong>Tidak ada data yang ditemukan.</strong> ' +
                'Coba ubah kombinasi filter atau kata kunci pencarian.</td></tr>';
            renderPagination('ra-pagination', 0, 1, aksiState.perPage, () => {});
            return;
        }

        const rp = (n) => n ? formatRupiah(n) : '-';
        const start = (aksiState.page - 1) * aksiState.perPage;

        tbody.innerHTML = rows.slice(start, start + aksiState.perPage).map(r => `
            <tr>
                <td>${dash(r.no)}</td>
                <td>${dash(r.provinsi)}</td>
                <td class="cell-truncate" title="${esc(r.program)}">${dash(r.program)}</td>
                <td class="cell-truncate cell-strong" title="${esc(r.kegiatan)}">${dash(r.kegiatan)}</td>
                <td class="cell-truncate" title="${esc(r.lokasi)}">${dash(r.lokasi)}</td>
                <td><span class="badge badge-neutral">${dash(r.sumber)}</span></td>
                <td class="cell-truncate" title="${esc(r.output2026)}">${dash(r.output2026)}</td>
                <td class="num">${rp(r.anggaran2026)}</td>
                <td class="cell-truncate" title="${esc(r.output2027)}">${dash(r.output2027)}</td>
                <td class="num">${rp(r.anggaran2027)}</td>
                <td class="cell-truncate" title="${esc(r.output2028)}">${dash(r.output2028)}</td>
                <td class="num">${rp(r.anggaran2028)}</td>
                <td class="num cell-primary">${rp(r.totalAnggaran)}</td>
            </tr>`).join('');

        renderPagination('ra-pagination', rows.length, aksiState.page, aksiState.perPage, (p) => {
            aksiState.page = p;
            renderAksiTable();
        });
    };

    const renderAksi = () => {
        renderAksiSummary();
        renderAksiCharts();
        renderAksiTable();
    };

    const applyAksiFilters = () => {
        const f = aksiState.filters;
        aksiState.filtered = store.aksi.filter(r => {
            const cocokProvinsi = !f.provinsi || r.provinsi === f.provinsi;
            const cocokKegiatan = !f.kegiatan || r.kegiatan === f.kegiatan;
            const cocokSumber = !f.sumber || r.sumber === f.sumber;
            const cocokCari = !f.search || [r.program, r.kegiatan, r.lokasi, r.output2026]
                .some(v => (v || '').toLowerCase().includes(f.search));
            return cocokProvinsi && cocokKegiatan && cocokSumber && cocokCari;
        });
        aksiState.page = 1;
        renderAksi();
    };

    const setupAksi = () => {
        const uniq = (key) => [...new Set(store.aksi.map(r => r[key]).filter(Boolean))].sort();
        populateSelect('ra-filter-provinsi', uniq('provinsi'), 'Semua Provinsi');
        populateSelect('ra-filter-kegiatan', uniq('kegiatan'), 'Semua Kegiatan');
        populateSelect('ra-filter-sumber', uniq('sumber'), 'Semua Sumber');

        const bind = (id, key) => document.getElementById(id)?.addEventListener('change', (e) => {
            aksiState.filters[key] = e.target.value;
            applyAksiFilters();
        });
        bind('ra-filter-provinsi', 'provinsi');
        bind('ra-filter-kegiatan', 'kegiatan');
        bind('ra-filter-sumber', 'sumber');

        document.getElementById('ra-search')?.addEventListener('input', (e) => {
            aksiState.filters.search = e.target.value.toLowerCase();
            applyAksiFilters();
        });
        document.getElementById('ra-btn-reset')?.addEventListener('click', () => {
            ['ra-filter-provinsi', 'ra-filter-kegiatan', 'ra-filter-sumber', 'ra-search'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            aksiState.filters = { provinsi: '', kegiatan: '', sumber: '', search: '' };
            applyAksiFilters();
        });

        applyAksiFilters();
    };

    // =========================================================================
    // MENU 3 - PROGRES
    // =========================================================================

    const normalizeProgres = (rows) => rows
        .map((item, index) => {
            const targetAnggaran = parseRupiah(item.targetAnggaran);
            const realisasiAnggaran = parseRupiah(item.realisasiAnggaran);

            // Persentase bisa "50%", "0,5", "22,28", atau kosong -> hitung sendiri bila perlu.
            let persen = parseAngka(item.persentase);
            if (String(item.persentase ?? '').includes('%')) {
                // sudah dalam persen
            } else if (persen > 0 && persen <= 1) {
                persen = persen * 100;
            }
            if (!persen && targetAnggaran > 0) {
                persen = (realisasiAnggaran / targetAnggaran) * 100;
            }

            return {
                id: index,
                no: cleanCell(item.no) || String(index + 1),
                unitEselon: cleanCell(item.unitEselon),
                kabKota: cleanCell(item.kabKota),
                kegiatan: cleanCell(item.kegiatan),
                desa: cleanCell(item.desa),
                targetVolume: cleanCell(item.targetVolume),
                targetSatuan: cleanCell(item.targetSatuan),
                targetAnggaran,
                realisasiVolume: cleanCell(item.realisasiVolume),
                realisasiSatuan: cleanCell(item.realisasiSatuan),
                realisasiAnggaran,
                persentase: persen,
                targetPenyelesaian: cleanCell(item.targetPenyelesaian),
                penerima: cleanCell(item.penerima),
                keterangan: cleanCell(item.keterangan),
                statusBantuan: cleanCell(item.statusBantuan)
            };
        })
        // Baris subtotal per Unit Eselon I (tanpa No/Kegiatan/Kab-Kota) dibuang
        // supaya anggarannya tidak terhitung dua kali.
        .filter(item => item.kegiatan || item.kabKota);

    const progresState = {
        filtered: [],
        page: 1,
        perPage: 15,
        filters: { kabKota: '', search: '' }
    };

    const renderProgresSummary = () => {
        const rows = progresState.filtered;
        const target = rows.reduce((s, r) => s + r.targetAnggaran, 0);
        const realisasi = rows.reduce((s, r) => s + r.realisasiAnggaran, 0);
        const persen = target > 0 ? (realisasi / target) * 100 : 0;

        setText('pg-stat-target', target ? formatRupiah(target) : 'Rp 0');
        setText('pg-stat-realisasi', realisasi ? formatRupiah(realisasi) : 'Rp 0');
        setText('pg-stat-persen', `${persen.toFixed(1)}%`);
        setText('pg-stat-kegiatan', rows.length);
    };

    const renderProgresTable = () => {
        const tbody = document.getElementById('pg-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const rows = progresState.filtered;
        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="15" class="table-empty">
                <strong>Tidak ada data yang ditemukan.</strong>
                Coba ubah filter kab/kota atau kata kunci pencarian.
            </td></tr>`;
            renderPagination('pg-pagination', 0, 1, progresState.perPage, () => {});
            return;
        }

        const start = (progresState.page - 1) * progresState.perPage;
        rows.slice(start, start + progresState.perPage).forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dash(item.no)}</td>
                <td>${dash(item.unitEselon)}</td>
                <td>${dash(item.kabKota)}</td>
                <td class="cell-truncate cell-strong" title="${esc(item.kegiatan)}">${dash(item.kegiatan)}</td>
                <td class="cell-truncate" title="${esc(item.desa)}">${dash(item.desa)}</td>
                <td class="num">${dash(item.targetVolume)}</td>
                <td>${dash(item.targetSatuan || item.realisasiSatuan)}</td>
                <td class="num">${item.targetAnggaran ? formatRupiah(item.targetAnggaran) : '-'}</td>
                <td class="num">${dash(item.realisasiVolume)}</td>
                <td class="num">${item.realisasiAnggaran ? formatRupiah(item.realisasiAnggaran) : '-'}</td>
                <td>${barCapaian(item.persentase)}</td>
                <td>${dash(item.targetPenyelesaian)}</td>
                <td class="cell-truncate" title="${esc(item.penerima)}">${dash(item.penerima)}</td>
                <td class="cell-truncate" title="${esc(item.keterangan)}">${dash(item.keterangan)}</td>
                <td>${item.statusBantuan ? `<span class="badge badge-neutral">${esc(item.statusBantuan)}</span>` : '-'}</td>
            `;
            tbody.appendChild(tr);
        });

        renderPagination('pg-pagination', rows.length, progresState.page, progresState.perPage, (p) => {
            progresState.page = p;
            renderProgresTable();
        });
    };

    const renderProgres = () => {
        renderProgresSummary();
        renderProgresTable();
    };

    const applyProgresFilters = () => {
        const { kabKota, search } = progresState.filters;
        progresState.filtered = store.progres.filter(item => {
            const matchKab = !kabKota || item.kabKota === kabKota;
            const matchSearch = !search ||
                [item.kabKota, item.unitEselon, item.kegiatan, item.desa, item.penerima, item.keterangan]
                    .some(v => (v || '').toLowerCase().includes(search));
            return matchKab && matchSearch;
        });
        progresState.page = 1;
        renderProgres();
    };

    const setupProgres = () => {
        populateSelect('pg-filter-kabkota',
            [...new Set(store.progres.map(i => i.kabKota).filter(Boolean))].sort(), 'Semua Kab/Kota');

        document.getElementById('pg-filter-kabkota')?.addEventListener('change', (e) => {
            progresState.filters.kabKota = e.target.value;
            applyProgresFilters();
        });
        document.getElementById('pg-search')?.addEventListener('input', (e) => {
            progresState.filters.search = e.target.value.toLowerCase();
            applyProgresFilters();
        });
        document.getElementById('pg-btn-reset')?.addEventListener('click', () => {
            ['pg-filter-kabkota', 'pg-search'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            progresState.filters = { kabKota: '', search: '' };
            applyProgresFilters();
        });

        applyProgresFilters();
    };

    // =========================================================================
    // MENU 4 - ANGGARAN
    //
    // Sheet 'Anggaran' bukan tabel, melainkan blok laporan:
    //
    //   Usulan Anggaran 2026 |            | ABT 2026 |
    //   DJPB                 | 104.637... | DJPB     | 52.831...
    //   Total                | 521.108... | Total    | 113.876...
    //
    //   Alokasi Anggaran sumber Renduk Bappenas
    //                        | 2026 |  | 2027 |  | 2028 | Total
    //                        | <angka total>
    //                        | Pusat
    //                        | <angka>
    //
    // Jadi dibaca berdasarkan posisi label, bukan baris header.
    // =========================================================================

    const parseAnggaran = (rows) => {
        if (!rows || !rows.length) return null;

        const cell = (r, i) => cleanCell(r && r[i]);
        const isAngka = (s) => s !== '' && !/[A-Za-z]/.test(s) && /\d/.test(s);
        const findRow = (pred, from = 0) => {
            for (let i = from; i < rows.length; i++) if (pred(rows[i], i)) return i;
            return -1;
        };

        // --- Blok 1: Usulan vs ABT per Unit Eselon I ---
        const startUsulan = findRow(r => /usulan anggaran/i.test(cell(r, 0)));
        const usulan = { judul: 'Usulan Anggaran', items: [], total: 0 };
        const abt = { judul: 'ABT', items: [], total: 0 };

        if (startUsulan !== -1) {
            usulan.judul = cell(rows[startUsulan], 0) || usulan.judul;
            abt.judul = cell(rows[startUsulan], 2) || abt.judul;

            for (let i = startUsulan + 1; i < rows.length; i++) {
                const r = rows[i];
                const l1 = cell(r, 0), v1 = cell(r, 1);
                const l2 = cell(r, 2), v2 = cell(r, 3);
                if (!l1 && !l2) continue;

                if (/^total$/i.test(l1) || /^total$/i.test(l2)) {
                    usulan.total = parseRupiah(v1);
                    abt.total = parseRupiah(v2);
                    break;
                }
                if (l1 && isAngka(v1)) usulan.items.push({ unit: l1, nilai: parseRupiah(v1) });
                if (l2 && isAngka(v2)) abt.items.push({ unit: l2, nilai: parseRupiah(v2) });
            }
        }

        if (!usulan.total) usulan.total = usulan.items.reduce((s, i) => s + i.nilai, 0);
        if (!abt.total) abt.total = abt.items.reduce((s, i) => s + i.nilai, 0);

        // --- Catatan (nomor surat Kemenkeu) ---
        const iSurat = findRow(r => /surat kemenkeu/i.test(cell(r, 0)));
        const catatan = iSurat === -1 ? '' :
            [cell(rows[iSurat], 0), cell(rows[iSurat + 1], 0)].filter(Boolean).join(' ');

        // --- Blok 2: Alokasi Anggaran per tahun ---
        const iAlokasi = findRow(r => /alokasi anggaran sumber/i.test(cell(r, 0)));
        const alokasi = { judul: '', tahun: [], baris: [] };

        if (iAlokasi !== -1) {
            alokasi.judul = cell(rows[iAlokasi], 0);

            const iTahun = findRow(r => /^(19|20)\d{2}$/.test(cell(r, 1)), iAlokasi);
            if (iTahun !== -1) {
                const rowTahun = rows[iTahun];
                const kolom = [];
                rowTahun.forEach((c, idx) => {
                    if (/^(19|20)\d{2}$/.test(cleanCell(c))) {
                        alokasi.tahun.push(cleanCell(c));
                        kolom.push(idx);
                    }
                });
                const kolomTotal = rowTahun.findIndex(c => /^total$/i.test(cleanCell(c)));

                // Setelah baris tahun: baris angka pertama = total keseluruhan (tanpa label),
                // lalu berpasangan  <baris label> / <baris angka>.
                let label = 'Total Alokasi';
                for (let i = iTahun + 1; i < rows.length; i++) {
                    const r = rows[i];
                    const c1 = cell(r, 1);
                    if (!c1) continue;

                    if (isAngka(c1)) {
                        const nilai = kolom.map(idx => parseRupiah(cell(r, idx)));
                        const total = kolomTotal !== -1 ? parseRupiah(cell(r, kolomTotal)) : 0;
                        alokasi.baris.push({
                            label,
                            nilai,
                            total: total || nilai.reduce((a, b) => a + b, 0)
                        });
                        label = '';
                    } else {
                        label = c1;
                    }
                }
            }
        }

        const adaIsi = usulan.items.length || abt.items.length || alokasi.baris.length;
        return adaIsi ? { usulan, abt, catatan, alokasi } : null;
    };

    let chartAnggaran = null;

    const renderAnggaran = () => {
        const a = store.anggaran;
        if (!a) return;

        setText('ang-judul-usulan', a.usulan.judul);
        setText('ang-judul-abt', a.abt.judul);
        setText('ang-total-usulan', formatRupiah(a.usulan.total));
        setText('ang-total-abt', formatRupiah(a.abt.total));

        const catatanEl = document.getElementById('ang-catatan');
        if (catatanEl) {
            catatanEl.textContent = a.catatan || '';
            catatanEl.hidden = !a.catatan;
        }

        // Bar chart: Usulan vs ABT per Unit Eselon I
        const units = [...new Set([...a.usulan.items, ...a.abt.items].map(i => i.unit))];
        const nilaiDari = (items, unit) => (items.find(i => i.unit === unit) || {}).nilai || 0;
        const canvas = document.getElementById('chart-anggaran');
        const chartWrap = document.getElementById('ang-chart-wrap');

        if (chartWrap) chartWrap.hidden = units.length === 0;

        if (canvas && units.length) {
            const data = {
                labels: units,
                datasets: [
                    { label: a.usulan.judul, data: units.map(u => nilaiDari(a.usulan.items, u)),
                      backgroundColor: colors.primaryLight, borderRadius: 4 },
                    { label: a.abt.judul, data: units.map(u => nilaiDari(a.abt.items, u)),
                      backgroundColor: colors.primary, borderRadius: 4 }
                ]
            };
            if (chartAnggaran) {
                chartAnggaran.data = data;
                chartAnggaran.update();
            } else {
                chartAnggaran = new Chart(canvas.getContext('2d'), {
                    type: 'bar',
                    data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
                            tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatRupiah(ctx.raw)}` } }
                        },
                        scales: { y: { beginAtZero: true, ticks: { callback: (v) => chartNumberFormat(v) } } }
                    }
                });
            }
        }

        // Tabel alokasi per tahun
        const thead = document.getElementById('ang-alokasi-head');
        const tbody = document.getElementById('ang-alokasi-body');
        const wrap = document.getElementById('ang-alokasi-wrap');
        if (!thead || !tbody) return;

        if (!a.alokasi.baris.length) {
            if (wrap) wrap.hidden = true;
            return;
        }
        if (wrap) wrap.hidden = false;

        setText('ang-alokasi-judul', a.alokasi.judul || 'Alokasi Anggaran');
        thead.innerHTML = `<tr><th>Komponen</th>${
            a.alokasi.tahun.map(t => `<th class="num">${esc(t)}</th>`).join('')
        }<th class="num">Total</th></tr>`;

        tbody.innerHTML = a.alokasi.baris.map(b => {
            const utama = /^(total|pusat|daerah)/i.test(b.label);
            return `<tr class="${utama ? 'row-group' : ''}">
                <td>${dash(b.label)}</td>
                ${b.nilai.map(v => `<td class="num">${v ? formatRupiah(v) : '-'}</td>`).join('')}
                <td class="num cell-primary">${b.total ? formatRupiah(b.total) : '-'}</td>
            </tr>`;
        }).join('');
    };

    /**
     * Sheet 'Realisasi Anggaran' berisi TIGA blok tabel bertumpuk:
     *
     *   (tanpa label)  <- gabungan, isinya persis ABT + Reguler
     *   ABT
     *   Reguler
     *
     * Tiap blok berformat sama:
     *
     *   No        | Kegiatan | Taget  |                | Realisasi |           | %
     *             |          | Volume | Anggaran (000) | Volume    | Anggaran  |     <- header 2 baris
     *   Kelompok  |          | 5.800  | 70.419.096     | 950       | 18.635.795| 26,46
     *             | - Rincian| 10     | 292.950        | 0         | 0         | 0
     *   Total     |          |        | 155.316.812    |           | 24.503.035| 15,78
     *
     * Karena blok pertama hanyalah penjumlahan dua blok lainnya, ketiganya tidak
     * ditampilkan bertumpuk (itu yang membuat sheet sulit dibaca) melainkan
     * dijadikan satu tabel dengan pilihan sumber dana.
     *
     * Nilai anggaran ditulis dalam RIBUAN rupiah (judul kolom "(000)").
     */
    const parseRealisasi = (rows) => {
        if (!rows || rows.length < 3) return null;

        const cell = (r, i) => cleanCell(r && r[i]);
        const isHeaderVolume = (r) => /^volume$/i.test(cell(r, 2));

        const blok = [];
        let labelBerikut = '';

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];

            // Baris label blok: hanya kolom pertama terisi, teks pendek, bukan "Total".
            const hanyaKolom0 = cell(r, 0) && r.slice(1).every(c => cleanCell(c) === '');
            if (hanyaKolom0 && !/^total$/i.test(cell(r, 0)) && cell(r, 0).length < 30) {
                labelBerikut = cell(r, 0);
                continue;
            }

            if (!isHeaderVolume(r)) continue;

            // Baris di atasnya memuat "Anggaran (000)" -> nilai dalam ribuan.
            const ribuan = /\(0{3}\)/.test(cell(r, 3)) ? 1000 : 1;
            const rp = (v) => parseRupiah(v) * ribuan;

            const baris = [];
            let target = 0, realisasi = 0;

            let j = i + 1;
            for (; j < rows.length; j++) {
                const d = rows[j];
                const kelompok = cell(d, 0);
                const rincian = cell(d, 1);

                if (/^total$/i.test(kelompok)) { j++; break; }
                if (isHeaderVolume(d)) { j--; break; }
                if (!kelompok && !rincian) continue;

                const tRp = rp(cell(d, 3));
                const rRp = rp(cell(d, 5));
                const isKelompok = Boolean(kelompok);

                // Hanya baris kelompok yang dijumlahkan; rincian sudah tercakup
                // di dalamnya, kalau ikut dijumlah totalnya jadi dua kali lipat.
                if (isKelompok) { target += tRp; realisasi += rRp; }

                baris.push({
                    level: isKelompok ? 'kelompok' : 'rincian',
                    nama: (isKelompok ? kelompok : rincian).replace(/^-\s*/, ''),
                    targetVolume: cell(d, 2),
                    realisasiVolume: cell(d, 4),
                    targetAnggaran: tRp,
                    realisasiAnggaran: rRp,
                    persentase: tRp > 0 ? (rRp / tRp) * 100 : 0
                });
            }

            if (baris.length) {
                blok.push({
                    nama: labelBerikut || 'Semua Sumber Dana',
                    baris, target, realisasi,
                    persentase: target > 0 ? (realisasi / target) * 100 : 0
                });
            }
            labelBerikut = '';
            i = j - 1;
        }

        return blok.length ? { blok } : null;
    };

    const realisasiState = { blokAktif: 0, charts: { kelompok: null, sumber: null } };

    const renderRealisasi = () => {
        const section = document.getElementById('real-section');
        if (!section) return;

        const d = store.realisasi;
        if (!d) { section.hidden = true; return; }
        section.hidden = false;

        const blok = d.blok[realisasiState.blokAktif] || d.blok[0];
        const sisa = Math.max(blok.target - blok.realisasi, 0);

        setText('real-stat-target', blok.target ? formatRupiah(blok.target) : 'Rp 0');
        setText('real-stat-realisasi', blok.realisasi ? formatRupiah(blok.realisasi) : 'Rp 0');
        setText('real-stat-persen', blok.persentase.toFixed(2) + '%');
        setText('real-stat-sisa', sisa ? formatRupiah(sisa) : 'Rp 0');

        renderRealisasiCharts(blok, d.blok);
        renderRealisasiTabel(blok);
    };

    const renderRealisasiCharts = (blok, semuaBlok) => {
        // 1. Target vs Realisasi per kelompok kegiatan
        const kelompok = blok.baris.filter(b => b.level === 'kelompok');
        const labelPendek = (t) => (t.length > 34 ? t.slice(0, 32) + '...' : t);
        const cv1 = document.getElementById('chart-real-kelompok');

        if (cv1) {
            const data = {
                labels: kelompok.map(k => labelPendek(k.nama)),
                datasets: [
                    { label: 'Target', data: kelompok.map(k => k.targetAnggaran),
                      backgroundColor: colors.neutral, borderRadius: 4 },
                    { label: 'Realisasi', data: kelompok.map(k => k.realisasiAnggaran),
                      backgroundColor: colors.primary, borderRadius: 4 }
                ]
            };
            if (realisasiState.charts.kelompok) {
                realisasiState.charts.kelompok.data = data;
                realisasiState.charts.kelompok.update();
            } else {
                realisasiState.charts.kelompok = new Chart(cv1.getContext('2d'), {
                    type: 'bar',
                    data,
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
                            tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + formatRupiah(c.raw) } }
                        },
                        scales: { x: { beginAtZero: true, ticks: { callback: (v) => chartNumberFormat(v) } } }
                    }
                });
            }
        }

        // 2. Perbandingan antar sumber dana (blok gabungan dilewati)
        const sumber = semuaBlok.filter(b => !/semua/i.test(b.nama));
        const cv2 = document.getElementById('chart-real-sumber');

        if (cv2 && sumber.length) {
            const data = {
                labels: sumber.map(b => b.nama + ' (' + b.persentase.toFixed(1) + '%)'),
                datasets: [
                    { label: 'Target', data: sumber.map(b => b.target),
                      backgroundColor: colors.neutral, borderRadius: 4 },
                    { label: 'Realisasi', data: sumber.map(b => b.realisasi),
                      backgroundColor: colors.primary, borderRadius: 4 }
                ]
            };
            if (realisasiState.charts.sumber) {
                realisasiState.charts.sumber.data = data;
                realisasiState.charts.sumber.update();
            } else {
                realisasiState.charts.sumber = new Chart(cv2.getContext('2d'), {
                    type: 'bar',
                    data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
                            tooltip: { callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + formatRupiah(c.raw) } }
                        },
                        scales: { y: { beginAtZero: true, ticks: { callback: (v) => chartNumberFormat(v) } } }
                    }
                });
            }
        }
    };

    const renderRealisasiTabel = (blok) => {
        const tbody = document.getElementById('real-body');
        if (!tbody) return;

        const rp = (n) => n ? formatRupiah(n) : '-';

        tbody.innerHTML = blok.baris.map(b => {
            const kelompok = b.level === 'kelompok';
            return '<tr class="' + (kelompok ? 'row-group' : 'row-child') + '">' +
                '<td class="cell-truncate" title="' + esc(b.nama) + '">' + dash(b.nama) + '</td>' +
                '<td class="num">' + dash(b.targetVolume) + '</td>' +
                '<td class="num">' + rp(b.targetAnggaran) + '</td>' +
                '<td class="num">' + dash(b.realisasiVolume) + '</td>' +
                '<td class="num">' + rp(b.realisasiAnggaran) + '</td>' +
                '<td>' + barCapaian(b.persentase) + '</td>' +
            '</tr>';
        }).join('');
    };

    const setupRealisasi = () => {
        const d = store.realisasi;
        const sel = document.getElementById('real-filter-sumber');
        if (!d || !sel) return;

        sel.innerHTML = '';
        d.blok.forEach((b, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = b.nama;
            sel.appendChild(o);
        });

        sel.addEventListener('change', (e) => {
            realisasiState.blokAktif = parseInt(e.target.value, 10) || 0;
            renderRealisasi();
        });
    };

    // =========================================================================
    // PETA SPASIAL (Leaflet) - dasar bersama
    //
    // Hanya menu Penerima Bantuan yang punya peta, karena hanya berkas survei
    // di assets/geo yang memuat lintang/bujur asli. Menu Lokasi Terdampak dan
    // Rencana Aksi sempat punya peta, tetapi titiknya terpaksa ditebak dari
    // koordinat pusat wilayah - bukan posisi sebenarnya - sehingga dilepas.
    // =========================================================================

    const PETA_TENGAH = [2.5, 98.5];   // kira-kira tengah ketiga provinsi
    const PETA_ZOOM = 6;

    /**
     * Penyedia peta dasar. Tile OpenStreetMap resmi menolak permintaan dengan
     * HTTP 403 pada sebagian jaringan karena kebijakan pemakaiannya, jadi yang
     * dipakai adalah CARTO (mengizinkan penyematan, dan tampilannya netral
     * sehingga penanda biru tetap menonjol). Bila tile-nya tetap gagal, peta
     * berpindah sendiri ke penyedia cadangan.
     */
    const PENYEDIA_PETA = [
        {
            // Mirror OSM Jerman: bebas API key dan tanpa watermark.
            // Tile openstreetmap.org resmi menolak dengan HTTP 403 pada sebagian
            // jaringan, sedangkan CARTO kini mengembalikan tile bertuliskan
            // "API KEY REQUIRED" - keduanya sengaja tidak dipakai.
            nama: 'OSM DE',
            url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
            opsi: {
                maxZoom: 18,
                attribution: '&copy; Kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        },
        {
            nama: 'Wikimedia',
            url: 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png',
            opsi: {
                maxZoom: 18,
                attribution: '&copy; Kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Wikimedia'
            }
        }
    ];

    /** Pasang lapisan peta dasar, pindah ke cadangan bila tile-nya ditolak. */
    const pasangBasemap = (map, indeks = 0) => {
        const p = PENYEDIA_PETA[indeks];
        if (!p) return null;

        const layer = L.tileLayer(p.url, p.opsi).addTo(map);
        let gagal = 0;

        layer.on('tileerror', () => {
            // Beberapa tile gagal masih wajar; kegagalan beruntun berarti
            // penyedianya menolak (mis. 403) sehingga perlu diganti.
            if (++gagal < 4 || !PENYEDIA_PETA[indeks + 1]) return;
            console.warn(`[Peta] Tile ${p.nama} ditolak, beralih ke ${PENYEDIA_PETA[indeks + 1].nama}.`);
            map.removeLayer(layer);
            pasangBasemap(map, indeks + 1);
        });

        return layer;
    };

    const petaTersedia = () => typeof L !== 'undefined';

    /**
     * Leaflet menghitung ukuran peta saat dibuat. Karena halaman awalnya
     * display:none, ukurannya 0 dan peta tampil kosong sampai diberi tahu untuk
     * mengukur ulang - sama seperti kasus canvas Chart.js.
     */
    const resizePeta = (pageEl, nama) => {
        if (!pageEl || !petaTersedia() || nama !== 'penerima') return;
        if (!penerimaState.peta) renderPetaPenerima();
        else penerimaState.peta.invalidateSize();
    };

    // =========================================================================
    // MENU 5 - DOKUMENTASI
    //
    // Sheet 'Dokumentasi' berisi dua kolom tautan Google Drive:
    //   Dokumentasi Before | Dokumentasi After
    // Tautannya tidak ditampilkan mentah - tiap berkas dirender sebagai
    // pratinjau gambar lewat endpoint thumbnail Drive.
    // =========================================================================

    const normalizeDokumentasi = (rows) => {
        if (!rows || rows.length < 2) return [];

        const header = (rows[0] || []).map(h => cleanCell(h).toLowerCase());
        const cariKolom = (kata, fallback) => {
            const i = header.findIndex(h => h.includes(kata));
            return i === -1 ? fallback : i;
        };
        const iBefore = cariKolom('before', 0);
        const iAfter = cariKolom('after', 1);

        const sisi = (url) => {
            const u = cleanCell(url);
            const fid = driveFileId(u);
            return {
                url: u,
                gambar: fid ? `https://drive.google.com/thumbnail?id=${fid}&sz=w1000` : ''
            };
        };

        return rows.slice(1)
            .map((r, index) => ({
                id: index,
                no: index + 1,
                before: sisi(r[iBefore]),
                after: sisi(r[iAfter])
            }))
            .filter(d => d.before.url || d.after.url);
    };

    const renderDokumentasi = () => {
        const list = document.getElementById('dok-list');
        if (!list) return;

        const items = store.dokumentasi;
        setText('dok-count', `${items.length} dokumentasi`);

        if (!items.length) {
            list.innerHTML = `<li class="table-empty"><strong>Belum ada dokumentasi pada sheet.</strong></li>`;
            return;
        }

        // Gambar yang gagal dimuat (berkas Drive belum dishare publik) diganti
        // pesan agar tidak menyisakan kotak kosong tanpa penjelasan.
        const sisi = (d, label, kelas, ikon) => {
            const tag = `<span class="doc-tag ${kelas}"><i data-lucide="${ikon}" class="icon"></i>${label}</span>`;
            if (!d.url) return `<div class="doc-side is-empty">${tag}
                <div class="doc-fallback">Belum diisi</div></div>`;
            if (!d.gambar) return `<div class="doc-side is-empty">${tag}
                <div class="doc-fallback">Tautan bukan berkas Google Drive</div></div>`;
            return `<div class="doc-side">
                ${tag}
                <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" title="Buka berkas asli di Google Drive">
                    <img src="${esc(d.gambar)}" alt="Dokumentasi ${label}" loading="lazy"
                         onerror="this.closest('.doc-side').classList.add('is-failed')">
                </a>
                <div class="doc-fallback">Gambar tidak dapat dimuat - berkas Drive belum dishare publik</div>
            </div>`;
        };

        list.innerHTML = items.map(d => `
            <li class="doc-item">
                <span class="doc-no">${d.no}</span>
                <div class="doc-pair">
                    ${sisi(d.before, 'Before', 'is-before', 'circle-alert')}
                    ${sisi(d.after, 'After', 'is-after', 'circle-check')}
                </div>
            </li>`).join('');
        gambarIkon();
    };

    // =========================================================================
    // MENU PENERIMA BANTUAN
    //
    // Berbeda dari menu lain, sumbernya BUKAN spreadsheet melainkan berkas
    // statis di assets/geo/penerima/ - satu berkas per provinsi, hasil olahan
    // GeoJSON survei oleh tools/build-penerima.py. Jalankan skrip itu lagi
    // bila berkas GeoJSON sumbernya diperbarui.
    //
    // Isinya belasan ribu titik, jadi berkasnya dipadatkan dengan encoding
    // kamus: tiap kolom teks disimpan sekali lalu barisnya menyimpan indeks.
    // =========================================================================

    const DIR_PENERIMA = 'assets/geo/penerima/';

    const penerimaState = {
        semua: [],
        tersaring: [],
        filters: { prov: '', kab: '', kerusakan: '', status: '', search: '' },
        peta: null,
        cluster: null,
        charts: { kerusakan: null, kab: null },
        dimuat: false,
        gagal: []
    };

    /** Bongkar format kamus menjadi array objek biasa. */
    const bongkarPenerima = (paket) => {
        if (!paket || !Array.isArray(paket.data)) return [];
        const kolom = paket.kolom || [];
        const kamus = paket.kamus || {};

        return paket.data.map((baris, i) => {
            const o = { id: i };
            kolom.forEach((k, idx) => {
                const kode = baris[idx];
                o[k] = kode === -1 || kode === undefined ? '' : (kamus[k] || [])[kode] || '';
            });
            o.lat = baris[kolom.length];
            o.lng = baris[kolom.length + 1];
            return o;
        });
    };

    const ambilJson = async (jalur) => {
        const res = await fetch(jalur, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    };

    /**
     * Baca indeks provinsi lalu ambil berkas-berkasnya paralel.
     *
     * Indeks dibaca lebih dulu supaya menambah provinsi baru cukup menaruh
     * berkasnya di assets/geo/penerima/ dan mendaftarkannya di index.json -
     * tanpa menyentuh kode ini sama sekali.
     */
    const muatPenerima = async () => {
        penerimaState.semua = [];
        penerimaState.gagal = [];

        let daftar = [];
        try {
            daftar = (await ambilJson(DIR_PENERIMA + 'index.json')).provinsi || [];
        } catch (err) {
            // Berkasnya statis; kalau indeksnya tidak ada, menunya disembunyikan.
            console.warn('[Penerima] Gagal memuat index.json', err);
            penerimaState.dimuat = true;
            return;
        }

        // Satu provinsi yang gagal tidak boleh menggugurkan provinsi lain.
        const hasil = await Promise.all(daftar.map(async (d) => {
            try {
                return bongkarPenerima(await ambilJson(DIR_PENERIMA + d.berkas));
            } catch (err) {
                console.warn(`[Penerima] Gagal memuat ${d.berkas}`, err);
                penerimaState.gagal.push(d.provinsi || d.berkas);
                return [];
            }
        }));

        // id dibuat ulang lintas provinsi supaya tetap unik setelah digabung.
        hasil.flat().forEach((d, i) => {
            d.id = i;
            penerimaState.semua.push(d);
        });
        penerimaState.dimuat = true;
    };

    // ---------------------------------------------------------------- filter

    const terapkanFilterPenerima = () => {
        const f = penerimaState.filters;
        penerimaState.tersaring = penerimaState.semua.filter(d => {
            if (f.prov && d.prov !== f.prov) return false;
            if (f.kab && d.kab !== f.kab) return false;
            if (f.kerusakan && d.kerusakan !== f.kerusakan) return false;
            if (f.status && d.status !== f.status) return false;
            if (f.search) {
                const teks = [d.nama, d.desa, d.kec, d.kab, d.jenis, d.fasilitas, d.alamat]
                    .join(' ').toLowerCase();
                if (!teks.includes(f.search)) return false;
            }
            return true;
        });
        renderPenerima();
    };

    // ------------------------------------------------------------ offcanvas

    const BARIS_RINCIAN = [
        ['Provinsi', 'prov'],
        ['Kabupaten/Kota', 'kab'],
        ['Kecamatan', 'kec'],
        ['Desa/Kelurahan', 'desa'],
        ['Alamat', 'alamat'],
        ['Fasilitas Perikanan', 'fasilitas'],
        ['Jenis Sarana/Prasarana', 'jenis'],
        ['Tingkat Kewenangan', 'wewenang']
    ];

    const kelasKerusakan = (v) => {
        const s = (v || '').toLowerCase();
        if (s === 'berat') return 'badge-danger';
        if (s === 'sedang') return 'badge-warning';
        if (s === 'ringan') return 'badge-success';
        return 'badge-neutral';
    };

    const tutupOffcanvas = () => {
        const oc = document.getElementById('pn-offcanvas');
        const bd = document.getElementById('pn-backdrop');
        if (oc) { oc.classList.remove('is-open'); oc.hidden = true; }
        if (bd) bd.hidden = true;
    };

    const bukaOffcanvas = (d) => {
        const oc = document.getElementById('pn-offcanvas');
        const bd = document.getElementById('pn-backdrop');
        const body = document.getElementById('pn-oc-body');
        if (!oc || !body) return;

        setText('pn-oc-nama', d.nama || 'Tanpa nama');

        const jumlah = [d.jumlah, d.satuan].filter(Boolean).join(' ');
        const rincian = BARIS_RINCIAN
            .filter(([, k]) => d[k])
            .map(([label, k]) => `<div class="oc-row">
                    <dt>${esc(label)}</dt>
                    <dd>${esc(d[k])}</dd>
                </div>`).join('');

        body.innerHTML = `
            <div class="oc-badges">
                ${d.kerusakan ? `<span class="badge ${kelasKerusakan(d.kerusakan)}">Kerusakan ${esc(d.kerusakan)}</span>` : ''}
                ${d.status ? `<span class="badge ${/belum/i.test(d.status) ? 'badge-warning' : 'badge-success'}">${esc(d.status)}</span>` : ''}
            </div>

            ${jumlah ? `<div class="oc-highlight">
                <span class="oc-highlight-label">Kerusakan tercatat</span>
                <span class="oc-highlight-value">${esc(jumlah)}</span>
            </div>` : ''}

            <dl class="oc-list">${rincian}</dl>

            <div class="oc-foot">
                <span class="oc-coord">
                    <i data-lucide="map-pin" class="icon"></i>${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}
                </span>
                ${d.foto ? `<a class="btn btn-ghost" href="${esc(d.foto)}" target="_blank" rel="noopener noreferrer">
                    <i data-lucide="image" class="icon"></i>Foto pascabencana
                </a>` : ''}
            </div>`;

        oc.hidden = false;
        if (bd) bd.hidden = false;
        // Paksa perhitungan layout agar transisinya berjalan, bukan langsung jadi.
        void oc.offsetWidth;
        oc.classList.add('is-open');

        if (window.lucide) lucide.createIcons({ nameAttr: 'data-lucide' });
    };

    // ----------------------------------------------------------------- peta

    const warnaKerusakan = (v) => {
        const s = (v || '').toLowerCase();
        if (s === 'berat') return '#dc2626';
        if (s === 'sedang') return '#ea580c';
        if (s === 'ringan') return '#16a34a';
        return '#64748b';
    };

    const renderPetaPenerima = () => {
        if (!petaTersedia()) return;

        const el = document.getElementById('map-penerima');
        if (!el || !el.getBoundingClientRect().width) return;

        if (!penerimaState.peta) {
            const map = L.map(el, { scrollWheelZoom: false }).setView(PETA_TENGAH, PETA_ZOOM);
            pasangBasemap(map);
            map.on('click', () => map.scrollWheelZoom.enable());
            map.on('mouseout', () => map.scrollWheelZoom.disable());

            // Belasan ribu penanda tidak bisa digambar satu per satu tanpa
            // membuat peta macet; markercluster menggabungkannya per zoom.
            const cluster = L.markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 55,
                // Lepas gabungan cukup dini supaya titik bisa segera diklik
                // tanpa pengguna harus memperbesar peta berkali-kali.
                disableClusteringAtZoom: 14,
                // Banyak baris berbagi koordinat yang sama persis (satu orang,
                // beberapa jenis bantuan); ini yang memisahkannya jadi kipas.
                spiderfyOnMaxZoom: true
            });
            map.addLayer(cluster);
            penerimaState.peta = map;
            penerimaState.cluster = cluster;
        }

        const { cluster, peta } = { cluster: penerimaState.cluster, peta: penerimaState.peta };
        cluster.clearLayers();

        const titik = penerimaState.tersaring;
        const penanda = titik.map(d => {
            const m = L.circleMarker([d.lat, d.lng], {
                radius: 6,
                color: '#ffffff',
                weight: 1.5,
                fillColor: warnaKerusakan(d.kerusakan),
                fillOpacity: 0.9
            });
            m.bindTooltip(d.nama || d.desa || '(tanpa nama)', { direction: 'top', offset: [0, -4] });
            m.on('click', () => bukaOffcanvas(d));
            return m;
        });

        cluster.addLayers(penanda);

        if (titik.length) {
            const b = L.latLngBounds(titik.map(d => [d.lat, d.lng]));
            peta.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
        }

        setText('pn-peta-info', `${formatAngka(titik.length)} titik`);
    };

    // --------------------------------------------------------------- grafik

    const renderGrafikPenerima = () => {
        const rows = penerimaState.tersaring;

        // 1. Tingkat kerusakan - warnanya mengikuti makna status, bukan variasi
        const urutan = ['Berat', 'Sedang', 'Ringan'];
        const hitung = {};
        rows.forEach(d => {
            const k = urutan.includes(d.kerusakan) ? d.kerusakan : 'Lainnya';
            hitung[k] = (hitung[k] || 0) + 1;
        });
        const labelK = [...urutan, 'Lainnya'].filter(k => hitung[k]);
        const cv1 = document.getElementById('chart-pn-kerusakan');

        if (cv1) {
            const data = {
                labels: labelK,
                datasets: [{
                    data: labelK.map(k => hitung[k]),
                    backgroundColor: labelK.map(k => warnaKerusakan(k)),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            };
            if (penerimaState.charts.kerusakan) {
                penerimaState.charts.kerusakan.data = data;
                penerimaState.charts.kerusakan.update();
            } else {
                penerimaState.charts.kerusakan = new Chart(cv1.getContext('2d'), {
                    type: 'doughnut',
                    data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '62%',
                        plugins: {
                            legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } },
                            tooltip: {
                                callbacks: {
                                    label: (c) => {
                                        const tot = c.dataset.data.reduce((a, b) => a + b, 0);
                                        const pct = tot ? ((c.raw / tot) * 100).toFixed(1) : '0.0';
                                        return ` ${formatAngka(c.raw)} titik (${pct}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }

        // 2. Sepuluh kab/kota dengan titik terbanyak
        const perKab = {};
        rows.forEach(d => { if (d.kab) perKab[d.kab] = (perKab[d.kab] || 0) + 1; });
        const top = Object.entries(perKab).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const cv2 = document.getElementById('chart-pn-kab');

        if (cv2) {
            const data = {
                labels: top.map(t => t[0]),
                datasets: [{ label: 'Titik terdata', data: top.map(t => t[1]),
                             backgroundColor: colors.primary, borderRadius: 4 }]
            };
            if (penerimaState.charts.kab) {
                penerimaState.charts.kab.data = data;
                penerimaState.charts.kab.update();
            } else {
                penerimaState.charts.kab = new Chart(cv2.getContext('2d'), {
                    type: 'bar',
                    data,
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: { callbacks: { label: (c) => ` ${formatAngka(c.raw)} titik` } }
                        },
                        scales: { x: { beginAtZero: true } }
                    }
                });
            }
        }
    };

    // ------------------------------------------------------------- ringkasan

    const renderPenerima = () => {
        const rows = penerimaState.tersaring;
        const penerima = new Set(rows.map(d => d.nama).filter(Boolean));
        const berat = rows.filter(d => (d.kerusakan || '').toLowerCase() === 'berat').length;
        const belum = rows.filter(d => /belum/i.test(d.status || '')).length;

        setText('pn-stat-titik', formatAngka(rows.length));
        setText('pn-stat-penerima', formatAngka(penerima.size));
        setText('pn-stat-berat', formatAngka(berat));
        setText('pn-stat-belum', formatAngka(belum));

        renderPetaPenerima();
        renderGrafikPenerima();
    };

    const setupPenerima = () => {
        const uniq = (k) => [...new Set(penerimaState.semua.map(d => d[k]).filter(Boolean))].sort();
        populateSelect('pn-filter-provinsi', uniq('prov'), 'Semua Provinsi');
        populateSelect('pn-filter-kab', uniq('kab'), 'Semua Kab/Kota');
        populateSelect('pn-filter-kerusakan', uniq('kerusakan'), 'Semua Tingkat');
        populateSelect('pn-filter-status', uniq('status'), 'Semua Status');

        const bind = (id, key) => document.getElementById(id)?.addEventListener('change', (e) => {
            penerimaState.filters[key] = e.target.value;
            // Pilihan kab/kota dipersempit mengikuti provinsi yang dipilih.
            if (key === 'prov') {
                const daftar = [...new Set(penerimaState.semua
                    .filter(d => !e.target.value || d.prov === e.target.value)
                    .map(d => d.kab).filter(Boolean))].sort();
                populateSelect('pn-filter-kab', daftar, 'Semua Kab/Kota');
                penerimaState.filters.kab = '';
            }
            terapkanFilterPenerima();
        });
        bind('pn-filter-provinsi', 'prov');
        bind('pn-filter-kab', 'kab');
        bind('pn-filter-kerusakan', 'kerusakan');
        bind('pn-filter-status', 'status');

        document.getElementById('pn-search')?.addEventListener('input', (e) => {
            penerimaState.filters.search = e.target.value.toLowerCase();
            terapkanFilterPenerima();
        });

        document.getElementById('pn-btn-reset')?.addEventListener('click', () => {
            ['pn-filter-provinsi', 'pn-filter-kab', 'pn-filter-kerusakan', 'pn-filter-status', 'pn-search']
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            penerimaState.filters = { prov: '', kab: '', kerusakan: '', status: '', search: '' };
            populateSelect('pn-filter-kab', uniq('kab'), 'Semua Kab/Kota');
            terapkanFilterPenerima();
        });

        // Penutup offcanvas
        document.getElementById('pn-oc-close')?.addEventListener('click', tutupOffcanvas);
        document.getElementById('pn-backdrop')?.addEventListener('click', tutupOffcanvas);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') tutupOffcanvas();
        });

        const note = document.getElementById('pn-peta-note');
        if (note) {
            const gagal = penerimaState.gagal.length
                ? ` Data ${penerimaState.gagal.join(', ')} gagal dimuat sehingga belum tampil.`
                : '';
            note.textContent = 'Sumber: berkas GeoJSON survei, diolah jadi satu berkas per provinsi di '
                + 'assets/geo/penerima/ - bukan Google Spreadsheet. Warna titik menunjukkan tingkat '
                + 'kerusakan; titik yang berdekatan digabung menjadi satu lingkaran berangka dan '
                + 'terpisah saat peta diperbesar.' + gagal;
        }

        terapkanFilterPenerima();
    };

    // =========================================================================
    // MENU 6 - BERITA
    // Satu kartu = satu baris sheet: info publikasi + kliping dokumentasinya.
    // =========================================================================

    const normalizeBerita = (rows) => rows
        .map((item, index) => {
            let judul = cleanCell(item.judul);
            let link = cleanCell(item.link);

            // Sebagian baris tergeser: judul tertulis di kolom link, tanpa URL.
            if (!/^https?:\/\//i.test(link)) {
                if (!judul) judul = link;
                link = '';
            }

            const linkDok = cleanCell(item.linkDokumentasi);
            const fid = driveFileId(linkDok);

            return {
                id: index,
                no: cleanCell(item.no) || String(index + 1),
                media: cleanCell(item.media),
                tanggal: cleanCell(item.tanggal),
                judul,
                link,
                linkDokumentasi: linkDok,
                // Drive melayani pratinjau gambar lewat endpoint thumbnail.
                gambarDokumentasi: fid ? `https://drive.google.com/thumbnail?id=${fid}&sz=w1000` : ''
            };
        })
        .filter(item => item.judul || item.media);

    const beritaState = { filters: { media: '', search: '' } };

    const renderBerita = () => {
        const grid = document.getElementById('berita-grid');
        if (!grid) return;

        const f = beritaState.filters;
        const items = store.berita.filter(b => {
            const matchMedia = !f.media || b.media === f.media;
            const matchSearch = !f.search || [b.media, b.judul, b.tanggal]
                .some(v => (v || '').toLowerCase().includes(f.search));
            return matchMedia && matchSearch;
        });

        setText('berita-count', `${items.length} berita`);

        if (!items.length) {
            grid.innerHTML = `<li class="table-empty" style="grid-column:1/-1;">
                <strong>Tidak ada berita yang cocok dengan filter.</strong>
            </li>`;
            return;
        }

        grid.innerHTML = items.map(b => {
            const thumb = b.gambarDokumentasi
                ? `<a class="news-thumb" href="${esc(b.linkDokumentasi)}" target="_blank" rel="noopener noreferrer"
                       title="Buka kliping asli di Google Drive">
                       <img src="${esc(b.gambarDokumentasi)}" alt="Kliping: ${esc(b.judul)}" loading="lazy">
                   </a>`
                : '';
            const judul = b.link
                ? `<a href="${esc(b.link)}" target="_blank" rel="noopener noreferrer">${dash(b.judul)}</a>`
                : dash(b.judul);

            return `<li class="news-card">
                ${thumb}
                <div class="news-body">
                    <div class="news-meta">
                        <span class="badge badge-primary">${dash(b.media)}</span>
                        <span class="news-date"><i data-lucide="calendar" class="icon"></i>${dash(b.tanggal)}</span>
                    </div>
                    <p class="news-title">${judul}</p>
                    ${b.link ? '' : '<span class="news-nolink"><i data-lucide="link-2-off" class="icon"></i>Tautan artikel belum diisi</span>'}
                </div>
            </li>`;
        }).join('');
        gambarIkon();
    };

    const setupBerita = () => {
        populateSelect('berita-filter-media',
            [...new Set(store.berita.map(b => b.media).filter(Boolean))].sort(), 'Semua Media');

        document.getElementById('berita-filter-media')?.addEventListener('change', (e) => {
            beritaState.filters.media = e.target.value;
            renderBerita();
        });
        document.getElementById('berita-search')?.addEventListener('input', (e) => {
            beritaState.filters.search = e.target.value.toLowerCase();
            renderBerita();
        });
        document.getElementById('berita-btn-reset')?.addEventListener('click', () => {
            ['berita-filter-media', 'berita-search'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            beritaState.filters = { media: '', search: '' };
            renderBerita();
        });

        renderBerita();
    };

    // =========================================================================
    // Bootstrap
    // =========================================================================

    const boot = async () => {
        await loadData();

        setupTerdampak();
        setupAksi();
        setupProgres();
        setupBerita();
        await muatPenerima();
        setupPenerima();
        renderAnggaran();
        setupRealisasi();
        renderRealisasi();
        renderDokumentasi();

        syncMenuVisibility();
        gambarIkon();
    };

    // Diisi di sini karena fungsi-fungsinya baru terdefinisi setelah modul menu.
    RENDER_HALAMAN.terdampak = renderTerdampak;
    RENDER_HALAMAN.aksi = renderAksi;
    RENDER_HALAMAN.anggaran = () => { renderAnggaran(); renderRealisasi(); };
    RENDER_HALAMAN.penerima = renderPenerima;

    setupNav();
    boot();

    document.getElementById('btn-refresh')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        setText('data-source-text', 'Memuat ulang dari spreadsheet...');
        try { sessionStorage.clear(); } catch (err) { /* storage diblokir: abaikan */ }

        await loadData();

        // Isi ulang opsi dropdown tanpa menghilangkan pilihan aktif.
        const keepValue = (id, values, placeholder) => {
            const el = document.getElementById(id);
            const previous = el ? el.value : '';
            populateSelect(id, values, placeholder);
            if (el && values.includes(previous)) el.value = previous;
        };
        const uniq = (rows, key) => [...new Set(rows.map(i => (i[key] || '').trim()).filter(Boolean))].sort();

        keepValue('td-filter-provinsi', uniq(store.terdampak, 'provinsi'), 'Semua Provinsi');
        keepValue('pg-filter-kabkota', uniq(store.progres, 'kabKota'), 'Semua Kab/Kota');
        keepValue('berita-filter-media', uniq(store.berita, 'media'), 'Semua Media');

        applyTerdampakFilters();
        applyAksiFilters();
        applyProgresFilters();
        renderAnggaran();
        renderRealisasi();
        renderDokumentasi();
        renderBerita();

        syncMenuVisibility();
        btn.disabled = false;
    });
});
