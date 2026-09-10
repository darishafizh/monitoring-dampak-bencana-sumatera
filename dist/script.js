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
 *   Realisasi Anggaran  <- sheet 'Realisasi Anggaran'
 *   Berita              <- sheet 'Berita'
 *
 * Sumber data live = Google Spreadsheet (lihat config.js). Bila tidak dapat diakses,
 * tiap menu jatuh ke snapshot sheet-nya sendiri di data-snapshot.js - tetap tidak dicampur.
 */
document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // Helper umum
    // =========================================================================

    const colors = {
        primary: '#03255C',
        accent: '#03545C'
    };

    const chartPalette = [
        '#03255C', '#03545C', '#043685', '#0284c7', '#1c4e99',
        '#4a7ec9', '#0e7490', '#64748b', '#94a3b8', '#7dd3fc'
    ];

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
    };

    // =========================================================================
    // Penyimpanan data - satu properti per sheet, tidak pernah saling mengisi
    // =========================================================================

    const store = {
        terdampak: [],      // sheet 'Lokasi Terdampak'
        aksiRows: [],       // sheet 'Rencana Aksi'        (baris mentah)
        progres: [],        // sheet 'Progres'
        anggaran: null,     // sheet 'Anggaran'            (blok laporan)
        realisasiRows: [],  // sheet 'Realisasi Anggaran'  (baris mentah)
        berita: [],         // sheet 'Berita'
        liveSheets: [],
        sheetKosong: []
    };

    // =========================================================================
    // Navigasi - menu hanya muncul bila sheet-nya berisi data
    // =========================================================================

    const MENUS = [
        { page: 'terdampak', ada: () => store.terdampak.length > 0 },
        { page: 'aksi',      ada: () => store.aksiRows.length > 1 },
        { page: 'progres',   ada: () => store.progres.length > 0 },
        { page: 'anggaran',  ada: () => store.anggaran !== null },
        { page: 'realisasi', ada: () => store.realisasiRows.length > 1 },
        { page: 'berita',    ada: () => store.berita.length > 0 }
    ];

    const menuAktif = () => MENUS.filter(m => m.ada()).map(m => m.page);

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

        if (history.replaceState) history.replaceState(null, '', `#${name}`);

        // Chart.js perlu di-resize setelah canvas keluar dari display:none
        window.dispatchEvent(new Event('resize'));
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

        const [terdampak, aksiRows, progres, anggaranLive, realisasiRows, berita] =
            await Promise.all([
                SheetsLoader.fetchSheet(S.lokasiTerdampak, MAPPING_TERDAMPAK),
                SheetsLoader.fetchRows(S.rencanaAksi),
                SheetsLoader.fetchSheet(S.progres, MAPPING_PROGRES),
                SheetsLoader.fetchRows(S.anggaran),
                SheetsLoader.fetchRows(S.realisasiAnggaran),
                SheetsLoader.fetchSheet(S.berita, MAPPING_BERITA)
            ]);

        const catat = (data, nama) => {
            if (data && data.length) store.liveSheets.push(nama);
            else store.sheetKosong.push(nama);
        };

        catat(terdampak, S.lokasiTerdampak.name);
        catat(aksiRows, S.rencanaAksi.name);
        catat(progres, S.progres.name);
        catat(anggaranLive, S.anggaran.name);
        catat(realisasiRows, S.realisasiAnggaran.name);
        catat(berita, S.berita.name);

        // Fallback selalu ke snapshot SHEET YANG SAMA, tidak pernah ke sheet lain.
        // Dicek dengan `typeof` karena data-snapshot.js mendeklarasikan `const`,
        // yang tidak menjadi properti `window`.
        const snapTerdampak = typeof lokasiTerdampakData !== 'undefined' ? lokasiTerdampakData : [];
        const snapAksi = typeof rencanaAksiRows !== 'undefined' ? rencanaAksiRows : [];
        const snapProgres = typeof progresData !== 'undefined' ? progresData : [];
        const snapAnggaran = typeof anggaranRows !== 'undefined' ? anggaranRows : null;
        const snapRealisasi = typeof realisasiAnggaranRows !== 'undefined' ? realisasiAnggaranRows : [];
        const snapBerita = typeof beritaData !== 'undefined' ? beritaData : [];

        store.terdampak = normalizeTerdampak(terdampak || snapTerdampak);
        store.aksiRows = aksiRows || snapAksi;
        store.progres = normalizeProgres(progres || snapProgres);
        store.anggaran = parseAnggaran(anggaranLive || snapAnggaran);
        store.realisasiRows = realisasiRows || snapRealisasi;
        store.berita = normalizeBerita(berita || snapBerita);

        updateDataSourceBadge();
    };

    // =========================================================================
    // Tabel generik - merender sheet apa adanya sesuai header aslinya.
    // Dipakai menu 'Rencana Aksi' dan 'Realisasi Anggaran', yang strukturnya
    // ditentukan sepenuhnya oleh isi sheet-nya masing-masing.
    // =========================================================================

    const buatTabelGenerik = ({ headId, bodyId, paginationId, searchId }) => {
        const state = { rows: [], page: 1, perPage: 15, search: '' };

        const render = () => {
            const head = document.getElementById(headId);
            const body = document.getElementById(bodyId);
            if (!head || !body) return;

            if (state.rows.length < 2) { head.innerHTML = ''; body.innerHTML = ''; return; }

            const header = state.rows[0];
            // Buang kolom yang seluruh selnya kosong agar tabel tidak melebar percuma.
            const kolom = header.map((_, i) => i)
                .filter(i => state.rows.some(r => cleanCell(r[i]) !== ''));

            head.innerHTML = `<tr>${kolom.map(i => `<th>${dash(header[i])}</th>`).join('')}</tr>`;

            const data = state.rows.slice(1).filter(r =>
                !state.search || r.some(c => String(c || '').toLowerCase().includes(state.search)));

            if (!data.length) {
                body.innerHTML = `<tr><td colspan="${kolom.length}" class="table-empty">
                    <strong>Tidak ada baris yang cocok dengan pencarian.</strong>
                </td></tr>`;
                renderPagination(paginationId, 0, 1, state.perPage, () => {});
                return;
            }

            const start = (state.page - 1) * state.perPage;
            body.innerHTML = data.slice(start, start + state.perPage).map(r =>
                `<tr>${kolom.map(i => {
                    const v = cleanCell(r[i]);
                    return `<td class="cell-truncate" title="${esc(v)}">${dash(v)}</td>`;
                }).join('')}</tr>`).join('');

            renderPagination(paginationId, data.length, state.page, state.perPage, (p) => {
                state.page = p;
                render();
            });
        };

        document.getElementById(searchId)?.addEventListener('input', (e) => {
            state.search = e.target.value.toLowerCase();
            state.page = 1;
            render();
        });

        return {
            render,
            setRows: (rows) => { state.rows = rows || []; state.page = 1; render(); }
        };
    };

    let tabelAksi = null;
    let tabelRealisasi = null;

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
                <td><span class="badge badge-blue">${dash(item.jenis)}</span></td>
                <td class="cell-truncate" title="${esc(item.kategori)}">${dash(item.kategori)}</td>
                <td class="num" style="font-weight:600;">${formatAngka(item.jumlah)}</td>
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

    const progresBadge = (pct) => {
        if (pct >= 100) return 'badge-green';
        if (pct > 0) return 'badge-blue';
        return 'badge-gray';
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
            tbody.innerHTML = `<tr><td colspan="16" class="table-empty">
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
                <td class="cell-truncate" title="${esc(item.kegiatan)}" style="font-weight:500;">${dash(item.kegiatan)}</td>
                <td class="cell-truncate" title="${esc(item.desa)}">${dash(item.desa)}</td>
                <td class="num">${dash(item.targetVolume)}</td>
                <td>${dash(item.targetSatuan)}</td>
                <td class="num">${item.targetAnggaran ? formatRupiah(item.targetAnggaran) : '-'}</td>
                <td class="num">${dash(item.realisasiVolume)}</td>
                <td>${dash(item.realisasiSatuan)}</td>
                <td class="num">${item.realisasiAnggaran ? formatRupiah(item.realisasiAnggaran) : '-'}</td>
                <td class="num"><span class="badge ${progresBadge(item.persentase)}">${item.persentase.toFixed(1)}%</span></td>
                <td>${dash(item.targetPenyelesaian)}</td>
                <td class="cell-truncate" title="${esc(item.penerima)}">${dash(item.penerima)}</td>
                <td class="cell-truncate" title="${esc(item.keterangan)}">${dash(item.keterangan)}</td>
                <td>${item.statusBantuan ? `<span class="badge badge-gray">${esc(item.statusBantuan)}</span>` : '-'}</td>
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
                      backgroundColor: colors.primary, borderRadius: 4 },
                    { label: a.abt.judul, data: units.map(u => nilaiDari(a.abt.items, u)),
                      backgroundColor: colors.accent, borderRadius: 4 }
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
            return `<tr${utama ? ' style="font-weight:600;"' : ''}>
                <td>${dash(b.label)}</td>
                ${b.nilai.map(v => `<td class="num">${v ? formatRupiah(v) : '-'}</td>`).join('')}
                <td class="num" style="color:#03255C;font-weight:600;">${b.total ? formatRupiah(b.total) : '-'}</td>
            </tr>`;
        }).join('');
    };

    // =========================================================================
    // MENU 6 - BERITA
    // Satu kartu = satu baris sheet: info publikasi + kliping dokumentasinya.
    // =========================================================================

    /** Ambil file id dari URL Google Drive (/file/d/<id>/... atau ?id=<id>). */
    const driveFileId = (url) => {
        const s = String(url || '');
        const m = s.match(/\/file\/d\/([^/?#]+)/) || s.match(/[?&]id=([^&#]+)/);
        return m ? m[1] : '';
    };

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
                ? `<a class="berita-thumb" href="${esc(b.linkDokumentasi)}" target="_blank" rel="noopener noreferrer"
                       title="Buka kliping asli di Google Drive">
                       <img src="${esc(b.gambarDokumentasi)}" alt="Kliping: ${esc(b.judul)}" loading="lazy">
                   </a>`
                : '';
            const judul = b.link
                ? `<a href="${esc(b.link)}" target="_blank" rel="noopener noreferrer">${dash(b.judul)}</a>`
                : dash(b.judul);

            return `<li class="berita-card">
                ${thumb}
                <div class="berita-body">
                    <div class="berita-meta">
                        <span class="badge badge-blue">${dash(b.media)}</span>
                        <span class="berita-tanggal">${dash(b.tanggal)}</span>
                    </div>
                    <p class="berita-judul">${judul}</p>
                    ${b.link ? '' : '<span class="berita-dok berita-dok--mati">Tautan artikel belum diisi</span>'}
                </div>
            </li>`;
        }).join('');
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
        setupProgres();
        setupBerita();
        renderAnggaran();

        tabelAksi = buatTabelGenerik({
            headId: 'aksi-head', bodyId: 'aksi-body',
            paginationId: 'aksi-pagination', searchId: 'aksi-search'
        });
        tabelRealisasi = buatTabelGenerik({
            headId: 'real-head', bodyId: 'real-body',
            paginationId: 'real-pagination', searchId: 'real-search'
        });
        tabelAksi.setRows(store.aksiRows);
        tabelRealisasi.setRows(store.realisasiRows);

        syncMenuVisibility();
    };

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
        applyProgresFilters();
        renderAnggaran();
        renderBerita();
        if (tabelAksi) tabelAksi.setRows(store.aksiRows);
        if (tabelRealisasi) tabelRealisasi.setRows(store.realisasiRows);

        syncMenuVisibility();
        btn.disabled = false;
    });
});
