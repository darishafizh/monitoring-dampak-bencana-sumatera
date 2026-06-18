let map;
let programChart;
let provinsiChart;
let markers = [];

const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
};

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initFilters();
    initDashboard();

    document.getElementById('tahunFilter').addEventListener('change', applyFilters);
    document.getElementById('provinsiFilter').addEventListener('change', applyFilters);
    document.getElementById('kabupatenFilter').addEventListener('change', applyFilters);
    document.getElementById('sektorFilter').addEventListener('change', applyFilters);
});

function initMap() {
    map = L.map('map').setView([1.5, 98.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function initFilters() {
    const kabs = new Set();
    const sektors = new Set();

    comprehensiveData.forEach(item => {
        if (item.lokasi.kabupaten && item.lokasi.kabupaten !== "-") {
            kabs.add(item.lokasi.kabupaten);
        }
        if (item.sektor && item.sektor !== "-") {
            sektors.add(item.sektor);
        }
    });

    const kabFilter = document.getElementById('kabupatenFilter');
    Array.from(kabs).sort().forEach(kab => {
        const option = document.createElement('option');
        option.value = kab;
        option.textContent = kab;
        kabFilter.appendChild(option);
    });

    const sektorFilter = document.getElementById('sektorFilter');
    Array.from(sektors).sort().forEach(sek => {
        const option = document.createElement('option');
        option.value = sek;
        option.textContent = sek;
        sektorFilter.appendChild(option);
    });
}

function initDashboard() {
    applyFilters();
}

function getBudgetByYear(item, selectedYear) {
    if (selectedYear === 'Semua') {
        return item.totalAnggaran || 0;
    }
    const yearData = item[`tahun${selectedYear}`];
    return yearData ? (yearData.anggaran || 0) : 0;
}

function applyFilters() {
    const tahun = document.getElementById('tahunFilter').value;
    const provinsi = document.getElementById('provinsiFilter').value;
    const kabupaten = document.getElementById('kabupatenFilter').value;
    const sektor = document.getElementById('sektorFilter').value;

    const filteredData = comprehensiveData.filter(item => {
        let match = true;
        if (provinsi !== 'Semua' && item.lokasi.provinsi !== provinsi) match = false;
        if (kabupaten !== 'Semua' && item.lokasi.kabupaten !== kabupaten) match = false;
        if (sektor !== 'Semua' && item.sektor !== sektor) match = false;
        
        // If specific year is selected, ensure it has budget > 0 for that year, or at least exists
        if (tahun !== 'Semua') {
            const b = getBudgetByYear(item, tahun);
            if (b === 0 && (!item[`tahun${tahun}`] || !item[`tahun${tahun}`].output)) {
                match = false; // no action planned for this year
            }
        }
        return match;
    });

    updateSummary(filteredData, tahun);
    updateCharts(filteredData, tahun);
    renderTable(filteredData, tahun);
    updateMap(filteredData, tahun);
}

function updateSummary(data, tahun) {
    let totalBiaya = 0;
    data.forEach(item => {
        totalBiaya += getBudgetByYear(item, tahun);
    });

    document.getElementById('totalBiaya').textContent = formatRupiah(totalBiaya);
    document.getElementById('totalVolume').textContent = data.length + " Aksi"; // Representing number of actions since volume units differ
}

function updateCharts(data, tahun) {
    const sektorData = {};
    const provinsiData = {};

    data.forEach(item => {
        const budget = getBudgetByYear(item, tahun);
        if (budget > 0) {
            // Sektor
            sektorData[item.sektor] = (sektorData[item.sektor] || 0) + budget;
            // Provinsi
            provinsiData[item.lokasi.provinsi] = (provinsiData[item.lokasi.provinsi] || 0) + budget;
        }
    });

    // Sektor Chart
    const ctxProg = document.getElementById('programChart').getContext('2d');
    if (programChart) programChart.destroy();
    programChart = new Chart(ctxProg, {
        type: 'doughnut',
        data: {
            labels: Object.keys(sektorData),
            datasets: [{
                data: Object.values(sektorData),
                backgroundColor: ['#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } },
                tooltip: { callbacks: { label: (ctx) => ' ' + formatRupiah(ctx.raw) } }
            }
        }
    });

    // Provinsi Chart
    const ctxProv = document.getElementById('provinsiChart').getContext('2d');
    if (provinsiChart) provinsiChart.destroy();
    provinsiChart = new Chart(ctxProv, {
        type: 'bar',
        data: {
            labels: Object.keys(provinsiData),
            datasets: [{
                label: 'Total Anggaran',
                data: Object.values(provinsiData),
                backgroundColor: '#0ea5e9',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => ' ' + formatRupiah(ctx.raw) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (value) => 'Rp ' + (value / 1e9).toFixed(0) + ' M' } }
            }
        }
    });
}

function renderTable(data, tahun) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    document.getElementById('emptyState').style.display = data.length === 0 ? 'block' : 'none';

    data.forEach((item, index) => {
        const budget = getBudgetByYear(item, tahun);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <strong>${item.lokasi.provinsi}</strong><br>
                <span style="font-size: 0.85rem; color: #64748b;">${item.lokasi.kabupaten}</span>
            </td>
            <td>
                <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">${item.program}</div>
                <div style="font-size: 0.85rem; color: #64748b;">${item.rencanaAksi}</div>
            </td>
            <td><span class="badge" style="background: rgba(14, 165, 233, 0.1); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.2);">${item.sasaran || '-'}</span></td>
            <td style="font-weight: 700; color: #059669;">${formatRupiah(budget)}</td>
            <td style="text-align: center;">
                <button class="btn btn-sm btn-primary" onclick="showDetail('${item.id}')">
                    <i class="fas fa-list"></i> Rincian
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.showDetail = function(id) {
    const item = comprehensiveData.find(i => i.id === id);
    if (!item) return;

    const modalBody = document.getElementById('detailModalBody');
    modalBody.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
            <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
                <h4 style="color: var(--primary-gradient); margin-bottom: 1rem;"><i class="fas fa-bullseye"></i> Konteks & Sasaran</h4>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <strong style="color: var(--text-muted);">Isu / Dampak</strong>
                    <span>${item.isu}</span>
                </div>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <strong style="color: var(--text-muted);">Rincian Output</strong>
                    <span>${item.ro}</span>
                </div>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <strong style="color: var(--text-muted);">Sasaran</strong>
                    <span style="color: var(--success); font-weight: bold;">${item.sasaran}</span>
                </div>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem;">
                    <strong style="color: var(--text-muted);">Sektor</strong>
                    <span>${item.sektor}</span>
                </div>
            </div>

            <div class="glass-card" style="padding: 1.5rem; border: 1px solid var(--glass-border);">
                <h4 style="color: var(--info); margin-bottom: 1rem;"><i class="fas fa-calendar-alt"></i> Timeline & Anggaran Pelaksanaan</h4>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
                    <thead>
                        <tr style="background: rgba(0,0,0,0.05);">
                            <th style="padding: 0.75rem; text-align: left; border: 1px solid #e2e8f0;">Tahun</th>
                            <th style="padding: 0.75rem; text-align: left; border: 1px solid #e2e8f0;">Target Output</th>
                            <th style="padding: 0.75rem; text-align: right; border: 1px solid #e2e8f0;">Anggaran</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0;">2026</td>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0;">${item.tahun2026.output || '-'}</td>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatRupiah(item.tahun2026.anggaran)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0;">2027</td>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0;">${item.tahun2027.output || '-'}</td>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatRupiah(item.tahun2027.anggaran)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0;">2028</td>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0;">${item.tahun2028.output || '-'}</td>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatRupiah(item.tahun2028.anggaran)}</td>
                        </tr>
                        <tr style="background: rgba(16, 185, 129, 0.1);">
                            <td colspan="2" style="padding: 0.75rem; border: 1px solid #e2e8f0; font-weight: bold;">Total Anggaran</td>
                            <td style="padding: 0.75rem; border: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: var(--success);">${formatRupiah(item.totalAnggaran)}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <span class="badge" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--glass-border);"><i class="fas fa-money-bill"></i> Sumber: ${item.sumberDana || '-'}</span>
                    <span class="badge" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--glass-border);"><i class="fas fa-cogs"></i> Skema: ${item.skemaPelaksanaan || '-'}</span>
                    <span class="badge" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--glass-border);"><i class="fas fa-handshake"></i> Mitra: ${item.mitra || '-'}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('detailModal').classList.add('show');
}

window.closeDetailModal = function() {
    document.getElementById('detailModal').classList.remove('show');
}

function updateMap(data, tahun) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const provCoords = {
        'Aceh': [4.6951, 96.7494],
        'Sumatera Utara': [2.1154, 99.5451],
        'Sumatera Barat': [-0.7399, 100.8000]
    };

    const provAgg = {};
    data.forEach(item => {
        const budget = getBudgetByYear(item, tahun);
        const prov = item.lokasi.provinsi;
        if (prov && budget > 0) {
            if (!provAgg[prov]) provAgg[prov] = { budget: 0, aksi: 0 };
            provAgg[prov].budget += budget;
            provAgg[prov].aksi += 1;
        }
    });

    for (const [prov, stats] of Object.entries(provAgg)) {
        if (provCoords[prov]) {
            const marker = L.marker(provCoords[prov]).addTo(map);
            marker.bindPopup(`
                <div class="p-2">
                    <h6 class="fw-bold mb-2">${prov}</h6>
                    <div class="small mb-1"><strong>Total Aksi:</strong> ${stats.aksi} kegiatan</div>
                    <div class="small text-success fw-bold"><strong>Anggaran:</strong> ${formatRupiah(stats.budget)}</div>
                </div>
            `);
            markers.push(marker);
        }
    }
}
