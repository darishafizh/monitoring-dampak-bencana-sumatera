document.addEventListener('DOMContentLoaded', () => {
    if (typeof matriksBappenasData === 'undefined') {
        document.getElementById('detail-content').innerHTML = `<div style="padding: 3rem; text-align: center; color: red;">Data tidak ditemukan!</div>`;
        return;
    }

    // Parse Rupiah string to Number
    const parseRupiah = (str) => {
        if (!str) return 0;
        let cleanStr = str.replace(/[Rp\s,.]/g, '');
        let val = parseInt(cleanStr, 10);
        return isNaN(val) ? 0 : val;
    };

    // Format Number to Rupiah
    const formatRupiah = (num) => {
        if (!num || num === 0) return '-';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    };

    // Format Bullet List separated by commas
    const formatBulletList = (str) => {
        if (!str || str === '-' || str.trim() === '') return '-';
        const items = str.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (items.length === 0) return '-';
        if (items.length === 1 && !str.includes(',')) return str;
        return `<ul class="bullet-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    };

    // Clean data identically to script.js
    const cleanData = matriksBappenasData.filter(item => {
        const noClean = (item.no || '').toLowerCase();
        const isHeader = noClean.includes('jumlah') || 
                         noClean === 'no' || 
                         noClean.includes('rencana aksi');
        
        const isShifted = (item.sumberDana || '').toLowerCase() === 'unit' || 
                          (item.anggaran2026 || '').toLowerCase() === 'unit';
                          
        const isColumnHeader = (item.isu || '').toLowerCase().includes('isu dan dampak') ||
                               (item.rencanaAksi || '').toLowerCase() === 'rencana aksi';

        return item.provinsi && item.provinsi.trim() !== '' && 
               item.rencanaAksi && item.rencanaAksi.trim() !== '' &&
               !isHeader && !isShifted && !isColumnHeader;
    }).map((item, index) => {
        return {
            ...item,
            id: index,
            numAnggaran2026: parseRupiah(item.anggaran2026),
            numAnggaran2027: parseRupiah(item.anggaran2027),
            numAnggaran2028: parseRupiah(item.anggaran2028),
            numTotalAnggaran: parseRupiah(item.totalAnggaran)
        };
    });

    // Get URL Parameter
    const urlParams = new URLSearchParams(window.location.search);
    const recId = parseInt(urlParams.get('id'), 10);

    const record = cleanData.find(item => item.id === recId);

    if (!record) {
        document.getElementById('detail-content').innerHTML = `<div style="padding: 4rem; text-align: center;"><h3>Record data tidak ditemukan</h3><p style="color: #64748b; margin-top: 0.5rem;">ID record tidak valid atau data telah diperbarui.</p></div>`;
        return;
    }

    // Render detail view
    const html = `
        <div class="detail-header">
            <span class="badge badge-green" style="background: rgba(255,255,255,0.25); color: white; margin-bottom: 0.75rem; display: inline-block; font-size: 0.85rem; padding: 4px 12px;">${record.sektor || 'Sektor Pemulihan'}</span>
            <h1>${record.rencanaAksi || '-'}</h1>
            <p>${record.program || '-'}</p>
        </div>

        <div class="detail-body">
            <div class="section-title">📍 Lokasi & Sasaran Terdampak</div>
            <div class="info-group">
                <div class="info-label">Provinsi</div>
                <div class="info-value" style="font-weight: 700; color: var(--primary); font-size: 1.05rem;">${record.provinsi || '-'}</div>
            </div>
            <div class="info-group">
                <div class="info-label">Kabupaten / Kota</div>
                <div class="info-value" style="font-weight: 600;">${record.kabKota || '-'}</div>
            </div>
            <div class="info-group">
                <div class="info-label">Kecamatan</div>
                <div class="info-value">${formatBulletList(record.kecamatan)}</div>
            </div>
            <div class="info-group">
                <div class="info-label">Desa / Kelurahan</div>
                <div class="info-value">${formatBulletList(record.desa)}</div>
            </div>
            <div class="info-group" style="grid-column: span 2;">
                <div class="info-label">Sasaran Penerima Manfaat</div>
                <div class="info-value" style="background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0;">${record.sasaran || '-'}</div>
            </div>

            <div class="section-title" style="margin-top: 1rem;">🎯 Konteks & Rincian Output</div>
            <div class="info-group">
                <div class="info-label">Isu Pascabencana</div>
                <div class="info-value">${record.isu || '-'}</div>
            </div>
            <div class="info-group">
                <div class="info-label">RO (Rincian Output)</div>
                <div class="info-value">${record.ro || '-'}</div>
            </div>

            <div class="section-title" style="margin-top: 1rem;">💰 Phasing Output & Alokasi Anggaran (2026 - 2028)</div>
            <div class="budget-grid">
                <div class="budget-box">
                    <div class="budget-year">Tahun 2026</div>
                    <div class="budget-amount">${record.numAnggaran2026 ? formatRupiah(record.numAnggaran2026) : '-'}</div>
                    <div class="budget-output">Target Output:<br><strong>${record.output2026 || '-'}</strong></div>
                </div>
                <div class="budget-box">
                    <div class="budget-year">Tahun 2027</div>
                    <div class="budget-amount">${record.numAnggaran2027 ? formatRupiah(record.numAnggaran2027) : '-'}</div>
                    <div class="budget-output">Target Output:<br><strong>${record.output2027 || '-'}</strong></div>
                </div>
                <div class="budget-box">
                    <div class="budget-year">Tahun 2028</div>
                    <div class="budget-amount">${record.numAnggaran2028 ? formatRupiah(record.numAnggaran2028) : '-'}</div>
                    <div class="budget-output">Target Output:<br><strong>${record.output2028 || '-'}</strong></div>
                </div>
            </div>
            <div class="total-box">
                <div class="total-label">Total Anggaran Alokasi</div>
                <div class="total-val">${record.numTotalAnggaran ? formatRupiah(record.numTotalAnggaran) : '-'}</div>
            </div>

            <div class="section-title" style="margin-top: 1rem;">🤝 Skema & Pelaksanaan</div>
            <div class="info-group">
                <div class="info-label">Sumber Dana</div>
                <div class="info-value"><span class="badge badge-blue" style="font-size: 0.85rem; padding: 4px 10px;">${record.sumberDana || '-'}</span></div>
            </div>
            <div class="info-group">
                <div class="info-label">Skema Pelaksanaan</div>
                <div class="info-value">${record.skema || '-'}</div>
            </div>
            <div class="info-group" style="grid-column: span 2;">
                <div class="info-label">Mitra Daerah / Non-Pemerintahan</div>
                <div class="info-value" style="font-weight: 600;">${record.mitra || '-'}</div>
            </div>
        </div>
    `;

    document.getElementById('detail-content').innerHTML = html;
});
