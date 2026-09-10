/**
 * Loader live data dari Google Spreadsheet.
 *
 * Memakai endpoint export CSV per-tab:
 *   https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>
 * Endpoint ini mengembalikan isi sheet apa adanya (termasuk baris label pada sheet
 * yang tata letaknya bukan tabel) dan mengirim header CORS, sehingga bisa dipanggil
 * langsung dari browser selama spreadsheet dishare "Anyone with the link".
 *
 * Bila gagal (ID kosong, sheet tidak publik, offline), pemanggil memakai snapshot lokal.
 */
const SheetsLoader = (() => {

    const csvUrl = (gid) => {
        const id = (DASHBOARD_CONFIG.SPREADSHEET_ID || '').trim();
        if (!id || gid === undefined || gid === null || gid === '') return null;
        return `https://docs.google.com/spreadsheets/d/${id}/export` +
               `?format=csv&gid=${encodeURIComponent(gid)}&t=${Date.now()}`;
    };

    /** Parser CSV yang menghormati tanda kutip, koma, dan newline di dalam sel. */
    const parseCSV = (text) => {
        const rows = [];
        let row = [], field = '', inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else { inQuotes = false; }
                } else {
                    field += ch;
                }
                continue;
            }

            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
            else if (ch !== '\r') { field += ch; }
        }
        if (field !== '' || row.length) { row.push(field); rows.push(row); }

        // Buang zero-width space & sejenisnya yang sering ikut saat paste dari web.
        return rows.map(r => r.map(c => c.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()));
    };

    /** Normalisasi nama kolom agar cocok walau beda spasi/kapital/tanda baca. */
    const normKey = (s) => (s || '')
        .toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    /**
     * Ubah baris CSV jadi array of object.
     * `mapping` = { propertiTujuan: ['nama kolom', 'alias kolom', ...] }
     */
    const toObjects = (rows, mapping, headerRowIndex = 0) => {
        if (!rows.length) return [];

        const headers = (rows[headerRowIndex] || []).map(normKey);
        const colOf = (aliases) => {
            for (const alias of aliases) {
                const idx = headers.indexOf(normKey(alias));
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const cols = {};
        Object.entries(mapping).forEach(([prop, aliases]) => {
            cols[prop] = colOf(Array.isArray(aliases) ? aliases : [aliases]);
        });

        return rows.slice(headerRowIndex + 1).map(r => {
            const obj = {};
            Object.entries(cols).forEach(([prop, idx]) => {
                obj[prop] = idx === -1 ? '' : (r[idx] || '');
            });
            return obj;
        }).filter(obj => Object.values(obj).some(v => v !== ''));
    };

    const cacheKey = (gid) => `sheet-cache::${DASHBOARD_CONFIG.SPREADSHEET_ID}::${gid}`;

    const readCache = (gid) => {
        const ttl = (DASHBOARD_CONFIG.CACHE_MINUTES || 0) * 60 * 1000;
        if (ttl <= 0) return null;
        try {
            const raw = sessionStorage.getItem(cacheKey(gid));
            if (!raw) return null;
            const { at, text } = JSON.parse(raw);
            return (Date.now() - at) < ttl ? text : null;
        } catch (e) { return null; }
    };

    const writeCache = (gid, text) => {
        if ((DASHBOARD_CONFIG.CACHE_MINUTES || 0) <= 0) return;
        try {
            sessionStorage.setItem(cacheKey(gid), JSON.stringify({ at: Date.now(), text }));
        } catch (e) { /* kuota penuh / storage diblokir: abaikan saja */ }
    };

    /**
     * Ambil satu sheet sebagai array baris mentah (array of array).
     * Dipakai untuk sheet yang tata letaknya bukan tabel, mis. "Anggaran".
     * Return null bila live data tidak tersedia.
     */
    const fetchRows = async (sheet) => {
        const def = typeof sheet === 'object' ? sheet : { name: String(sheet), gid: sheet };
        const url = csvUrl(def.gid);
        if (!url) return null;

        try {
            let text = readCache(def.gid);
            if (text === null) {
                const res = await fetch(url, { credentials: 'omit' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                text = await res.text();
                writeCache(def.gid, text);
            }
            const rows = parseCSV(text).filter(r => r.some(c => c !== ''));
            return rows.length ? rows : null;
        } catch (err) {
            console.warn(`[SheetsLoader] Gagal memuat sheet "${def.name}", memakai snapshot lokal.`, err);
            return null;
        }
    };

    /**
     * Ambil satu sheet sebagai array of object berdasarkan baris header.
     * Return null bila live data tidak tersedia -> pemanggil pakai snapshot.
     */
    const fetchSheet = async (sheet, mapping, headerRowIndex = 0) => {
        const rows = await fetchRows(sheet);
        if (!rows) return null;
        const data = toObjects(rows, mapping, headerRowIndex);
        return data.length ? data : null;
    };

    const isEnabled = () => Boolean((DASHBOARD_CONFIG.SPREADSHEET_ID || '').trim());

    return { fetchSheet, fetchRows, parseCSV, toObjects, isEnabled };
})();
