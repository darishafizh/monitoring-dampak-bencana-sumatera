// ===== Data Management =====
const STORAGE_KEY = 'budidayaData';
let currentProvinsiFilter = '';
let currentUnitFilter = '';

// Get data from localStorage
function getData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Get filtered data
function getFilteredData() {
    const data = getData();
    return data.filter(item => {
        const matchProvinsi = !currentProvinsiFilter || item.provinsi === currentProvinsiFilter;
        const matchUnit = !currentUnitFilter || item.items.some(i => i.unit === currentUnitFilter);
        return matchProvinsi && matchUnit;
    });
}

// Save data to localStorage
function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Format currency
// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatCurrencyCompact(amount) {
    if (amount >= 1e12) {
        return 'Rp ' + (amount / 1e12).toFixed(3).replace('.', ',') + ' T';
    } else if (amount >= 1e9) {
        return 'Rp ' + (amount / 1e9).toFixed(3).replace('.', ',') + ' M';
    } else if (amount >= 1e6) {
        return 'Rp ' + (amount / 1e6).toFixed(1).replace('.', ',') + ' Jt';
    } else {
        return formatCurrency(amount);
    }
}

// Format number with thousands separator
function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
}

// ===== DOM Elements =====
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const filterProvinsi = document.getElementById('filterProvinsi');
const filterUnit = document.getElementById('filterUnit');
const toast = document.getElementById('toast');
const summaryCardsContainer = document.getElementById('summaryCardsContainer');
const totalBiayaEl = document.getElementById('totalBiaya');
const totalEntriesEl = document.getElementById('totalEntries');

// Detail Modal Elements
const detailModal = document.getElementById('detailModal');
const detailItemsList = document.getElementById('detailItemsList');
const detailKabupaten = document.getElementById('detailKabupaten');
const detailProvinsi = document.getElementById('detailProvinsi');
const detailTotalBiaya = document.getElementById('detailTotalBiaya');

// Charts
let unitChart = null;
let kabupatenChart = null;

// Map
let map = null;
let markersLayer = null;

// Coordinate mapping (using existing coordinates, logic to add fallback)
const koordinatKabupaten = {
    // Aceh
    "Kab. Pidie": [5.3175, 95.9533], "Pidie": [5.3175, 95.9533],
    "Kab. Pidie Jaya": [5.1493, 96.1819], "Pidie Jaya": [5.1493, 96.1819],
    "Kab. Bireun": [5.0378, 96.7009], "Bireun": [5.0378, 96.7009], "Bireuen": [5.0378, 96.7009], "Kab. Bireuen": [5.0378, 96.7009],
    "Kab. Aceh Utara": [5.1833, 97.1333], "Aceh Utara": [5.1833, 97.1333],
    "Kab. Aceh Timur": [4.5833, 97.9167], "Aceh Timur": [4.5833, 97.9167],
    "Kab. Aceh Tamiang": [4.2528, 97.9783], "Aceh Tamiang": [4.2528, 97.9783],
    "Kab. Aceh Tengah": [4.6197, 96.8517], "Aceh Tengah": [4.6197, 96.8517],
    "Kab. Aceh Selatan": [3.2000, 97.3833], "Aceh Selatan": [3.2000, 97.3833],
    "Kab. Nagan Raya": [4.1500, 96.5667], "Nagan Raya": [4.1500, 96.5667],
    "Kab. Aceh Barat": [4.4500, 96.1667], "Aceh Barat": [4.4500, 96.1667],
    "Kab. Bener Meriah": [4.7000, 96.9000], "Bener Meriah": [4.7000, 96.9000],
    "Kab. Gayo Luwes": [4.0833, 97.3500], "Gayo Luwes": [4.0833, 97.3500],
    "Kab. Aceh Tenggara": [3.3667, 97.7000], "Aceh Tenggara": [3.3667, 97.7000],
    "Kab. Aceh Singkil": [2.3667, 97.8000], "Aceh Singkil": [2.3667, 97.8000],
    "Kota Lhoukseumawe": [5.1817, 97.1508], "Kota Lhokseumawe": [5.1817, 97.1508],
    "Kota Langsa": [4.4683, 97.9683],
    "Aceh Besar": [5.3667, 95.4500],
    
    // Sumatera Utara
    "Kab. Langkat": [3.7600, 98.2900], "Langkat": [3.7600, 98.2900],
    "Kab. Deli Serdang": [3.4194, 98.6767], "Deli Serdang": [3.4194, 98.6767],
    "Kab. Tapanuli Tengah": [1.8333, 98.6667], "Tapanuli Tengah": [1.8333, 98.6667],
    "Kab. Tapanuli Selatan": [1.5333, 99.2667], "Tapanuli Selatan": [1.5333, 99.2667],
    "Kab. Tapanuli Utara": [2.0500, 99.0333], "Tapanuli Utara": [2.0500, 99.0333],
    "Kota Sibolga": [1.7417, 98.7806],
    "Kota Padang Sidempuan": [1.3833, 99.2667], "Kota Padangsidimpuan": [1.3833, 99.2667],
    "Kota Medan": [3.5952, 98.6722],
    "Kab. Asahan": [2.8667, 99.6500], "Asahan": [2.8667, 99.6500],
    "Kab. Batubara": [3.1500, 99.5833], "Batubara": [3.1500, 99.5833],
    "Kab. Humbang Hasundutan": [2.2500, 98.5667], "Humbang Hasundutan": [2.2500, 98.5667],
    "Sibolga Selatan": [1.7200, 98.7900],
    "Sibolga Utara": [1.7700, 98.7700],
    
    // Sumatera Barat
    "Kab. Pasaman": [0.0833, 99.9833], "Pasaman": [0.0833, 99.9833],
    "Kab. Solok": [-0.8000, 100.6500], "Solok": [-0.8000, 100.6500],
    "Kab. Pesisir Selatan": [-1.5833, 100.5333], "Pesisir Selatan": [-1.5833, 100.5333], "Peisir Selatan": [-1.5833, 100.5333],
    "Kab. Lima Puluh Kota": [-0.1000, 100.6333], "Lima Puluh Kota": [-0.1000, 100.6333],
    "Kab. Agam": [-0.2000, 100.3333], "Agam": [-0.2000, 100.3333],
    "Kab. Padang Pariaman": [-0.5667, 100.1500], "Padang Pariaman": [-0.5667, 100.1500],
    "Kab. Tanah Datar": [-0.4667, 100.6167], "Tanah Datar": [-0.4667, 100.6167],
    "Kota Pariaman": [-0.6278, 100.1181],
    "Kota Solok": [-0.7917, 100.6500],
    "Kota Padang": [-0.9492, 100.3543],
    "Kab. Kep. Mentawai": [-1.4167, 99.0833], "Kep. Mentawai": [-1.4167, 99.0833],
    "Pasaman Barat": [0.1333, 99.7833],
    "Pesisir Barat": [-1.5833, 100.5333] // Assuming typo for Pesisir Selatan
};

// Search coordinates function
function getCoordinates(name) {
    if (koordinatKabupaten[name]) return koordinatKabupaten[name];
    
    // Try to fuzzy match keys
    const keys = Object.keys(koordinatKabupaten);
    const normalizedName = name.toLowerCase().replace('kab.', '').replace('kota', '').trim();
    
    for (const key of keys) {
        if (key.toLowerCase().includes(normalizedName)) {
            return koordinatKabupaten[key];
        }
    }
    
    // Fallback based on Province if possible (not implemented here for simplicity)
    return null; 
}

// ===== Toast Notifications =====
function showToast(message, type = 'success') {
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    toast.querySelector('.toast-icon').textContent = icons[type];
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== Filter Listeners =====
filterProvinsi.addEventListener('change', (e) => {
    currentProvinsiFilter = e.target.value;
    refreshAll();
});

filterUnit.addEventListener('change', (e) => {
    currentUnitFilter = e.target.value;
    refreshAll();
});

function populateFilters() {
    const data = getData();
    const provinsiSet = new Set(data.map(item => item.provinsi).filter(p => p));
    const provinsiList = Array.from(provinsiSet).sort();
    
    filterProvinsi.innerHTML = '<option value="">Semua Provinsi</option>';
    provinsiList.forEach(prov => {
        const option = document.createElement('option');
        option.value = prov;
        option.textContent = prov;
        filterProvinsi.appendChild(option);
    });
}

// ===== Render Functions =====
function renderTable() {
    const data = getFilteredData();
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    
    const filteredData = data.filter(item => 
        item.kabupaten.toLowerCase().includes(searchVal) ||
        item.provinsi.toLowerCase().includes(searchVal)
    );

    if (filteredData.length === 0) {
        tableBody.innerHTML = '';
        emptyState.style.display = 'flex';
        document.querySelector('table').style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    document.querySelector('table').style.display = 'table';
    
    tableBody.innerHTML = filteredData.map((item, index) => {
        // Collect unique units
        const units = [...new Set(item.items.map(i => i.unit))];
        const unitBadges = units.map(u => 
            `<span class="badge-unit badge-${u.toLowerCase()}">${u}</span>`
        ).join(' ');
        
        return `
        <tr data-id="${item.id}">
            <td>${index + 1}</td>
            <td>${item.provinsi || '-'}</td>
            <td>${item.kabupaten}</td>
            <td>${item.items.length} Kegiatan</td>
            <td>${unitBadges}</td>
            <td class="currency-cell" style="font-weight: bold; color: #0284c7;">${formatCurrency(item.totalBiaya)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view" onclick="openDetailModal('${item.id}')" title="Lihat Detail Bantuan">📋</button>
                    <!-- Edit/Delete disabled for now as data comes from Excel -->
                </div>
            </td>
        </tr>
    `}).join('');
}

function updateSummary() {
    const data = getFilteredData();
    
    let stats = {
        totalBiaya: 0,
        units: {
            'DJPB': 0,
            'DJPT': 0,
            'PDSPKP': 0,
            'BPPSDM': 0
        },
        kabupatenCount: data.length
    };
    
    data.forEach(item => {
        stats.totalBiaya += item.totalBiaya;
        item.items.forEach(subItem => {
            if (stats.units[subItem.unit] !== undefined) {
                stats.units[subItem.unit] += subItem.biaya;
            } else {
                 // Fallback if there are other units
                 if(!stats.units['Lainnya']) stats.units['Lainnya'] = 0;
                 stats.units['Lainnya'] += subItem.biaya;
            }
        });
    });
    
    totalEntriesEl.textContent = formatNumber(stats.kabupatenCount);
    totalBiayaEl.textContent = formatCurrency(stats.totalBiaya);
    
    // Dynamically create cards for Units
    // Clear old cards except the Total Biaya card which we want to keep at the end
    // Actually, let's rebuild the container content entirely
    
    const unitCards = Object.entries(stats.units).map(([unit, cost], index) => {
        if (cost === 0) return '';
        
        const cardClass = `card-gradient-${(index % 6) + 1}`;
        let icon = '🏢';
        let label = unit;
        
        if (unit === 'DJPB') { icon = '🐟'; label = 'DJPB (Budidaya)'; }
        if (unit === 'DJPT') { icon = '⚓'; label = 'DJPT (Tangkap)'; }
        if (unit === 'PDSPKP') { icon = '🏭'; label = 'PDSPKP (Pengolahan)'; }
        if (unit === 'BPPSDM') { icon = '🎓'; label = 'BPPSDM (SDM)'; }
        
        return `
        <div class="summary-card ${cardClass}">
            <div class="card-icon">${icon}</div>
            <div class="card-content">
                <span class="card-value">${formatCurrencyCompact(cost)}</span>
                <span class="card-label">${label}</span>
            </div>
        </div>
        `;
    }).join('');
    
    const totalCard = `
         <div class="summary-card card-gradient-8">
            <div class="card-icon">💰</div>
            <div class="card-content">
                <span class="card-value" id="totalBiaya">${formatCurrencyCompact(stats.totalBiaya)}</span>
                <span class="card-label">Total Estimasi Biaya</span>
            </div>
        </div>
    `;
    
    summaryCardsContainer.innerHTML = unitCards + totalCard;
}

function updateCharts() {
    const data = getFilteredData();
    
    // 1. Cost per Unit Chart (Pie)
    let unitCosts = {};
    data.forEach(item => {
        item.items.forEach(subItem => {
            const u = subItem.unit || 'Lainnya';
            unitCosts[u] = (unitCosts[u] || 0) + subItem.biaya;
        });
    });
    
    const unitLabels = Object.keys(unitCosts);
    const unitValues = Object.values(unitCosts).map(v => v / 1000000000); // In Billions
    const unitColors = ['#0ea5e9', '#0369a1', '#0d9488', '#7c3aed', '#64748b'];
    
    if (unitChart) unitChart.destroy();
    const ctx1 = document.getElementById('unitChart').getContext('2d');
    unitChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: unitLabels,
            datasets: [{
                data: unitValues,
                backgroundColor: unitColors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { 
                    callbacks: { 
                        label: (ctx) => `${ctx.label}: ${formatNumber(ctx.raw.toFixed(2))} M`
                    } 
                }
            }
        }
    });
    
    // 2. Top 10 Kabupaten by Cost
    const sortedKab = [...data].sort((a, b) => b.totalBiaya - a.totalBiaya).slice(0, 10);
    const kabLabels = sortedKab.map(d => d.kabupaten);
    const kabValues = sortedKab.map(d => d.totalBiaya / 1000000000);
    
    if (kabupatenChart) kabupatenChart.destroy();
    const ctx2 = document.getElementById('kabupatenChart').getContext('2d');
    kabupatenChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: kabLabels,
            datasets: [{
                label: 'Biaya (Miliar Rp)',
                data: kabValues,
                backgroundColor: 'rgba(14, 165, 233, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                         label: (ctx) => `${formatCurrency(ctx.raw * 1000000000)}`
                    }
                }
            },
            scales: {
                x: { ticks: { callback: (val) => val + ' M' } }
            }
        }
    });
}

// ===== Map Functions =====
function initMap() {
    // Initialize map centered on Sumatera
    map = L.map('map').setView([2.5, 98.5], 6);
    
    // Esri World Imagery (Satellite View)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    updateMap();
}

function updateMap() {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();
    const data = getFilteredData();
    
    // Province colors
    const provinceColors = {
        'Aceh': '#0369a1',
        'Sumatera Utara': '#0891b2',
        'Sumatera Barat': '#0e7490'
    };
    
    const bounds = [];
    
    data.forEach(item => {
        const coords = getCoordinates(item.kabupaten);
        if (!coords) return;
        
        bounds.push(coords);
        
        const color = provinceColors[item.provinsi] || '#0369a1';
        
        // Summary of items for popup
        const itemCount = item.items.length;
        const topItem = item.items[0] ? item.items[0].kegiatan : '';
        const moreCount = itemCount > 1 ? `dan ${itemCount - 1} kegiatan lainnya` : '';
        
        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const popupContent = `
            <div class="popup-title">${item.kabupaten}</div>
            <div class="popup-content">
                <strong>Provinsi:</strong> ${item.provinsi}<br>
                <strong>Total Biaya:</strong> ${formatCurrency(item.totalBiaya)}<br>
                <hr style="margin: 5px 0; border: 0; border-top: 1px solid #eee;">
                <div style="font-size: 0.75rem; color: #555;">
                   ${topItem}<br>
                   ${moreCount}
                </div>
            </div>
        `;
        
        L.marker(coords, { icon: markerIcon }).bindPopup(popupContent).addTo(markersLayer);
    });
    
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
}

// ===== Detail Modal =====
function openDetailModal(id) {
    const data = getData();
    const item = data.find(i => i.id === id);
    if (!item) return;
    
    detailKabupaten.textContent = item.kabupaten;
    detailProvinsi.textContent = item.provinsi;
    detailTotalBiaya.textContent = formatCurrency(item.totalBiaya);
    
    // Sort items by cost descending
    const sortedItems = [...item.items].sort((a, b) => b.biaya - a.biaya);
    
    detailItemsList.innerHTML = sortedItems.map(subItem => `
        <div class="item-row">
            <div class="item-details">
                <div class="item-title">
                    <span class="badge-unit badge-${subItem.unit.toLowerCase()}">${subItem.unit}</span>
                    ${subItem.kegiatan}
                </div>
                <div class="item-meta">
                     Kategori: ${subItem.kategori} | Vol: ${formatNumber(subItem.volume)} ${subItem.satuan}
                </div>
            </div>
            <div class="item-cost">${formatCurrency(subItem.biaya)}</div>
        </div>
    `).join('');
    
    detailModal.classList.add('show');
}

function closeDetailModal() {
    detailModal.classList.remove('show');
}

function refreshAll() {
    renderTable();
    updateSummary();
    updateCharts();
    updateMap();
}

function init() {
    document.getElementById('searchInput').addEventListener('input', renderTable);
    populateFilters();
    refreshAll();
    initMap();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
