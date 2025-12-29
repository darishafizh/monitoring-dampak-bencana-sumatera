// ===== Data Management =====
const STORAGE_KEY = 'budidayaData';
let currentFilter = '';

// Get data from localStorage
function getData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Get filtered data
function getFilteredData() {
    const data = getData();
    if (!currentFilter) return data;
    return data.filter(item => item.provinsi === currentFilter);
}

// Save data to localStorage
function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Format number with thousands separator
function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
}

// ===== DOM Elements =====
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const filterProvinsi = document.getElementById('filterProvinsi');
const toast = document.getElementById('toast');

// Add Modal Elements
const addModal = document.getElementById('addModal');
const addForm = document.getElementById('addForm');
const addDataBtn = document.getElementById('addDataBtn');
const closeAddModal = document.getElementById('closeAddModal');
const cancelAddModal = document.getElementById('cancelAddModal');

// Edit Modal Elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const closeModal = document.getElementById('closeModal');
const cancelEdit = document.getElementById('cancelEdit');

// Summary elements
const totalEntries = document.getElementById('totalEntries');
const totalKabupaten = document.getElementById('totalKabupaten');
const totalTambak = document.getElementById('totalTambak');
const totalKolam = document.getElementById('totalKolam');
const totalKJA = document.getElementById('totalKJA');
const totalSaluran = document.getElementById('totalSaluran');
const totalPintuAir = document.getElementById('totalPintuAir');
const totalJalanProduksi = document.getElementById('totalJalanProduksi');
const totalRehabBBI = document.getElementById('totalRehabBBI');
const totalBiaya = document.getElementById('totalBiaya');

// Charts
let infrastrukturChart = null;
let kabupatenChart = null;

// Map
let map = null;
let markersLayer = null;

// Koordinat Kabupaten/Kota
const koordinatKabupaten = {
    // Aceh
    "Kab. Pidie": [5.3175, 95.9533],
    "Kab. Pidie Jaya": [5.1493, 96.1819],
    "Kab. Bireun": [5.0378, 96.7009],
    "Kab. Aceh Utara": [5.1833, 97.1333],
    "Kab. Aceh Timur": [4.5833, 97.9167],
    "Kab. Aceh Tamiang": [4.2528, 97.9783],
    "Kab. Aceh Tengah": [4.6197, 96.8517],
    "Kab. Aceh Selatan": [3.2000, 97.3833],
    "Kab. Nagan Raya": [4.1500, 96.5667],
    "Kab. Aceh Barat": [4.4500, 96.1667],
    "Kab. Bener Meriah": [4.7000, 96.9000],
    "Kab. Gayo Luwes": [4.0833, 97.3500],
    "Kab. Aceh Tenggara": [3.3667, 97.7000],
    "Kab. Aceh Singkil": [2.3667, 97.8000],
    "Kota Lhoukseumawe": [5.1817, 97.1508],
    "Kota Langsa": [4.4683, 97.9683],
    
    // Sumatera Utara
    "Kab. Langkat": [3.7600, 98.2900],
    "Kab. Deli Serdang": [3.4194, 98.6767],
    "Kab. Tapanuli Tengah": [1.8333, 98.6667],
    "Kab. Tapanuli Selatan": [1.5333, 99.2667],
    "Kab. Tapanuli Utara": [2.0500, 99.0333],
    "Kota Sibolga": [1.7417, 98.7806],
    "Kota Padang Sidempuan": [1.3833, 99.2667],
    "Kota Medan": [3.5952, 98.6722],
    "Kab. Asahan": [2.8667, 99.6500],
    "Kab. Batubara": [3.1500, 99.5833],
    "Kab. Humbang Hasundutan": [2.2500, 98.5667],
    
    // Sumatera Barat
    "Kab. Pasaman": [0.0833, 99.9833],
    "Kab. Solok": [-0.8000, 100.6500],
    "Kab. Pesisir Selatan": [-1.5833, 100.5333],
    "Kab. Lima Puluh Kota": [-0.1000, 100.6333],
    "Kab. Agam": [-0.2000, 100.3333],
    "Kab. Padang Pariaman": [-0.5667, 100.1500],
    "Kab. Tanah Datar": [-0.4667, 100.6167],
    "Kota Pariaman": [-0.6278, 100.1181],
    "Kota Solok": [-0.7917, 100.6500],
    "Kota Padang": [-0.9492, 100.3543],
    "Kab. Kep. Mentawai": [-1.4167, 99.0833]
};

// ===== Toast Notifications =====
function showToast(message, type = 'success') {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    toast.querySelector('.toast-icon').textContent = icons[type];
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== Province Filter =====
function populateProvinsiFilter() {
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

// ===== Calculate Total Cost =====
function calculateTotal(prefix) {
    const fields = ['Tambak', 'Kolam', 'Kja', 'Saluran', 'PintuAir', 'Jalan', 'BBI'];
    let total = 0;
    
    fields.forEach(field => {
        const input = document.getElementById(`${prefix}Biaya${field}`);
        if (input) {
            total += parseFloat(input.value) || 0;
        }
    });
    
    const totalInput = document.getElementById(`${prefix}TotalBiaya`);
    if (totalInput) {
        totalInput.value = formatCurrency(total);
    }
    
    return total;
}

// Setup auto-calculate for cost inputs
function setupCostCalculation(prefix) {
    const costInputs = document.querySelectorAll(`#${prefix}Modal .cost-input`);
    costInputs.forEach(input => {
        input.addEventListener('input', () => calculateTotal(prefix));
    });
}

// ===== Render Functions =====
function renderTable(data = null) {
    const allData = data || getFilteredData();
    
    if (allData.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.add('show');
        document.querySelector('table').style.display = 'none';
        return;
    }
    
    emptyState.classList.remove('show');
    document.querySelector('table').style.display = 'table';
    
    tableBody.innerHTML = allData.map((item, index) => {
        const totalBiaya = (parseFloat(item.biayaTambak) || 0) +
                          (parseFloat(item.biayaKolam) || 0) +
                          (parseFloat(item.biayaKja) || 0) +
                          (parseFloat(item.biayaSaluran) || 0) +
                          (parseFloat(item.biayaPintuAir) || 0) +
                          (parseFloat(item.biayaJalan) || 0) +
                          (parseFloat(item.biayaBBI) || 0);
        
        return `
        <tr data-id="${item.id}">
            <td>${index + 1}</td>
            <td>${item.provinsi || '-'}</td>
            <td>${item.kabupaten}</td>
            <td class="data-cell">
                <span class="data-value">${formatNumber(item.tambakRusak || 0)}</span>
                <span class="data-cost">${formatCurrency(item.biayaTambak || 0)}</span>
            </td>
            <td class="data-cell">
                <span class="data-value">${formatNumber(item.kolamRusak || 0)}</span>
                <span class="data-cost">${formatCurrency(item.biayaKolam || 0)}</span>
            </td>
            <td class="data-cell">
                <span class="data-value">${formatNumber(item.kjaRusak || 0)}</span>
                <span class="data-cost">${formatCurrency(item.biayaKja || 0)}</span>
            </td>
            <td class="data-cell">
                <span class="data-value">${formatNumber(item.saluran || 0)}</span>
                <span class="data-cost">${formatCurrency(item.biayaSaluran || 0)}</span>
            </td>
            <td class="data-cell">
                <span class="data-value">${formatNumber(item.pintuAir || 0)}</span>
                <span class="data-cost">${formatCurrency(item.biayaPintuAir || 0)}</span>
            </td>
            <td class="data-cell">
                <span class="data-value">${formatNumber(item.jalanProduksi || 0)}</span>
                <span class="data-cost">${formatCurrency(item.biayaJalan || 0)}</span>
            </td>
            <td class="data-cell">
                <span class="data-value">${formatNumber(item.rehabBBI || 0)}</span>
                <span class="data-cost">${formatCurrency(item.biayaBBI || 0)}</span>
            </td>
            <td class="currency-cell total-cell">${formatCurrency(totalBiaya)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view" onclick="openPhotoModal('${item.id}')" title="Lihat Foto">📷</button>
                    <button class="action-btn edit" onclick="openEditModal('${item.id}')" title="Edit">✏️</button>
                    <button class="action-btn delete" onclick="deleteData('${item.id}')" title="Hapus">🗑️</button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function updateSummary() {
    const data = getFilteredData();
    
    const stats = data.reduce((acc, item) => {
        acc.tambak += parseFloat(item.tambakRusak) || 0;
        acc.kolam += parseFloat(item.kolamRusak) || 0;
        acc.kja += parseInt(item.kjaRusak) || 0;
        acc.saluran += parseFloat(item.saluran) || 0;
        acc.pintuAir += parseInt(item.pintuAir) || 0;
        acc.jalanProduksi += parseInt(item.jalanProduksi) || 0;
        acc.rehabBBI += parseInt(item.rehabBBI) || 0;
        acc.biaya += (parseFloat(item.biayaTambak) || 0) +
                     (parseFloat(item.biayaKolam) || 0) +
                     (parseFloat(item.biayaKja) || 0) +
                     (parseFloat(item.biayaSaluran) || 0) +
                     (parseFloat(item.biayaPintuAir) || 0) +
                     (parseFloat(item.biayaJalan) || 0) +
                     (parseFloat(item.biayaBBI) || 0);
        acc.kabupaten.add(item.kabupaten);
        return acc;
    }, { tambak: 0, kolam: 0, kja: 0, saluran: 0, pintuAir: 0, jalanProduksi: 0, rehabBBI: 0, biaya: 0, kabupaten: new Set() });
    
    totalEntries.textContent = formatNumber(data.length);
    totalKabupaten.textContent = formatNumber(stats.kabupaten.size);
    totalTambak.textContent = formatNumber(stats.tambak.toFixed(2));
    totalKolam.textContent = formatNumber(stats.kolam.toFixed(2));
    totalKJA.textContent = formatNumber(stats.kja);
    totalSaluran.textContent = formatNumber(stats.saluran.toFixed(2));
    totalPintuAir.textContent = formatNumber(stats.pintuAir);
    totalJalanProduksi.textContent = formatNumber(stats.jalanProduksi);
    totalRehabBBI.textContent = formatNumber(stats.rehabBBI);
    totalBiaya.textContent = formatCurrency(stats.biaya);
}

function updateCharts() {
    const data = getFilteredData();
    
    // Calculate totals for infrastructure chart (by cost)
    const infrastrukturTotals = data.reduce((acc, item) => {
        acc.tambak += parseFloat(item.biayaTambak) || 0;
        acc.kolam += parseFloat(item.biayaKolam) || 0;
        acc.kja += parseFloat(item.biayaKja) || 0;
        acc.saluran += parseFloat(item.biayaSaluran) || 0;
        acc.pintuAir += parseFloat(item.biayaPintuAir) || 0;
        acc.jalanProduksi += parseFloat(item.biayaJalan) || 0;
        acc.rehabBBI += parseFloat(item.biayaBBI) || 0;
        return acc;
    }, { tambak: 0, kolam: 0, kja: 0, saluran: 0, pintuAir: 0, jalanProduksi: 0, rehabBBI: 0 });
    
    const infraLabels = [];
    const infraValues = [];
    const infraColors = [];
    
    const colorMap = {
        'Tambak Rusak': '#0c4a6e',
        'Kolam Rusak': '#0e7490',
        'KJA Rusak': '#0369a1',
        'Saluran': '#0284c7',
        'Pintu Air': '#0891b2',
        'Jalan Produksi': '#075985',
        'Rehab BBI': '#22d3ee'
    };
    
    if (infrastrukturTotals.tambak > 0) {
        infraLabels.push('Tambak Rusak');
        infraValues.push(infrastrukturTotals.tambak / 1000000000);
        infraColors.push(colorMap['Tambak Rusak']);
    }
    if (infrastrukturTotals.kolam > 0) {
        infraLabels.push('Kolam Rusak');
        infraValues.push(infrastrukturTotals.kolam / 1000000000);
        infraColors.push(colorMap['Kolam Rusak']);
    }
    if (infrastrukturTotals.kja > 0) {
        infraLabels.push('KJA Rusak');
        infraValues.push(infrastrukturTotals.kja / 1000000000);
        infraColors.push(colorMap['KJA Rusak']);
    }
    if (infrastrukturTotals.saluran > 0) {
        infraLabels.push('Saluran');
        infraValues.push(infrastrukturTotals.saluran / 1000000000);
        infraColors.push(colorMap['Saluran']);
    }
    if (infrastrukturTotals.pintuAir > 0) {
        infraLabels.push('Pintu Air');
        infraValues.push(infrastrukturTotals.pintuAir / 1000000000);
        infraColors.push(colorMap['Pintu Air']);
    }
    if (infrastrukturTotals.jalanProduksi > 0) {
        infraLabels.push('Jalan Produksi');
        infraValues.push(infrastrukturTotals.jalanProduksi / 1000000000);
        infraColors.push(colorMap['Jalan Produksi']);
    }
    if (infrastrukturTotals.rehabBBI > 0) {
        infraLabels.push('Rehab BBI');
        infraValues.push(infrastrukturTotals.rehabBBI / 1000000000);
        infraColors.push(colorMap['Rehab BBI']);
    }
    
    if (infrastrukturChart) {
        infrastrukturChart.destroy();
    }
    
    const ctx1 = document.getElementById('infrastrukturChart').getContext('2d');
    infrastrukturChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: infraLabels,
            datasets: [{
                data: infraValues,
                backgroundColor: infraColors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#475569',
                        padding: 10,
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + formatNumber(context.raw.toFixed(2)) + ' M';
                        }
                    }
                }
            }
        }
    });
    
    // Kabupaten cost chart
    const kabupatenData = data.reduce((acc, item) => {
        const totalBiaya = (parseFloat(item.biayaTambak) || 0) +
                          (parseFloat(item.biayaKolam) || 0) +
                          (parseFloat(item.biayaKja) || 0) +
                          (parseFloat(item.biayaSaluran) || 0) +
                          (parseFloat(item.biayaPintuAir) || 0) +
                          (parseFloat(item.biayaJalan) || 0) +
                          (parseFloat(item.biayaBBI) || 0);
        
        if (!acc[item.kabupaten]) {
            acc[item.kabupaten] = 0;
        }
        acc[item.kabupaten] += totalBiaya;
        return acc;
    }, {});
    
    const sortedKabupaten = Object.entries(kabupatenData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const kabupatenLabels = sortedKabupaten.map(k => k[0]);
    const kabupatenValues = sortedKabupaten.map(k => k[1] / 1000000000);
    
    if (kabupatenChart) {
        kabupatenChart.destroy();
    }
    
    const ctx2 = document.getElementById('kabupatenChart').getContext('2d');
    kabupatenChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: kabupatenLabels,
            datasets: [{
                label: 'Estimasi Biaya (Miliar Rp)',
                data: kabupatenValues,
                backgroundColor: 'rgba(14, 165, 233, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#475569',
                        callback: function(value) {
                            return formatNumber(value) + ' M';
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#475569',
                        font: {
                            size: 10
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.raw * 1000000000);
                        }
                    }
                }
            }
        }
    });
}

// ===== Map Functions =====
function initMap() {
    // Initialize map centered on Sumatera
    map = L.map('map').setView([2.5, 98.5], 6);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Create markers layer group
    markersLayer = L.layerGroup().addTo(map);
    
    // Initial update
    updateMap();
}

function updateMap() {
    if (!map || !markersLayer) return;
    
    // Clear existing markers
    markersLayer.clearLayers();
    
    const data = getFilteredData();
    
    // Province color mapping
    const provinceColors = {
        'Aceh': '#0369a1',
        'Sumatera Utara': '#0891b2',
        'Sumatera Barat': '#0e7490'
    };
    
    // Add markers for each kabupaten
    data.forEach(item => {
        const coords = koordinatKabupaten[item.kabupaten];
        if (!coords) return;
        
        const totalBiaya = (parseFloat(item.biayaTambak) || 0) +
                          (parseFloat(item.biayaKolam) || 0) +
                          (parseFloat(item.biayaKja) || 0) +
                          (parseFloat(item.biayaSaluran) || 0) +
                          (parseFloat(item.biayaPintuAir) || 0) +
                          (parseFloat(item.biayaJalan) || 0) +
                          (parseFloat(item.biayaBBI) || 0);
        
        const color = provinceColors[item.provinsi] || '#0369a1';
        
        // Create custom icon
        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background: ${color};
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        // Create popup content
        const popupContent = `
            <div class="popup-title">${item.kabupaten}</div>
            <div class="popup-content">
                <strong>Provinsi:</strong> ${item.provinsi}<br>
                <strong>Tambak Rusak:</strong> ${formatNumber(item.tambakRusak || 0)} Ha<br>
                <strong>Kolam Rusak:</strong> ${formatNumber(item.kolamRusak || 0)} Ha<br>
                <strong>KJA Rusak:</strong> ${formatNumber(item.kjaRusak || 0)} Unit<br>
                <strong>Total Estimasi:</strong> ${formatCurrency(totalBiaya)}
            </div>
        `;
        
        // Add marker to layer
        const marker = L.marker(coords, { icon: markerIcon })
            .bindPopup(popupContent);
        
        markersLayer.addLayer(marker);
    });
    
    // Fit bounds to markers if there are any
    if (data.length > 0) {
        const bounds = [];
        data.forEach(item => {
            const coords = koordinatKabupaten[item.kabupaten];
            if (coords) bounds.push(coords);
        });
        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [30, 30] });
        }
    }
}

function refreshAll() {
    populateProvinsiFilter();
    renderTable();
    updateSummary();
    updateCharts();
    updateMap();
}

// ===== CRUD Operations =====
function addData(formData) {
    const data = getData();
    const newEntry = {
        id: generateId(),
        provinsi: formData.provinsi,
        kabupaten: formData.kabupaten.trim(),
        tambakRusak: parseFloat(formData.tambakRusak) || 0,
        biayaTambak: parseFloat(formData.biayaTambak) || 0,
        kolamRusak: parseFloat(formData.kolamRusak) || 0,
        biayaKolam: parseFloat(formData.biayaKolam) || 0,
        kjaRusak: parseInt(formData.kjaRusak) || 0,
        biayaKja: parseFloat(formData.biayaKja) || 0,
        saluran: parseFloat(formData.saluran) || 0,
        biayaSaluran: parseFloat(formData.biayaSaluran) || 0,
        pintuAir: parseInt(formData.pintuAir) || 0,
        biayaPintuAir: parseFloat(formData.biayaPintuAir) || 0,
        jalanProduksi: parseInt(formData.jalanProduksi) || 0,
        biayaJalan: parseFloat(formData.biayaJalan) || 0,
        rehabBBI: parseInt(formData.rehabBBI) || 0,
        biayaBBI: parseFloat(formData.biayaBBI) || 0,
        createdAt: new Date().toISOString()
    };
    
    data.push(newEntry);
    saveData(data);
    return newEntry;
}

function updateData(id, formData) {
    const data = getData();
    const index = data.findIndex(item => item.id === id);
    
    if (index !== -1) {
        data[index] = {
            ...data[index],
            provinsi: formData.provinsi,
            kabupaten: formData.kabupaten.trim(),
            tambakRusak: parseFloat(formData.tambakRusak) || 0,
            biayaTambak: parseFloat(formData.biayaTambak) || 0,
            kolamRusak: parseFloat(formData.kolamRusak) || 0,
            biayaKolam: parseFloat(formData.biayaKolam) || 0,
            kjaRusak: parseInt(formData.kjaRusak) || 0,
            biayaKja: parseFloat(formData.biayaKja) || 0,
            saluran: parseFloat(formData.saluran) || 0,
            biayaSaluran: parseFloat(formData.biayaSaluran) || 0,
            pintuAir: parseInt(formData.pintuAir) || 0,
            biayaPintuAir: parseFloat(formData.biayaPintuAir) || 0,
            jalanProduksi: parseInt(formData.jalanProduksi) || 0,
            biayaJalan: parseFloat(formData.biayaJalan) || 0,
            rehabBBI: parseInt(formData.rehabBBI) || 0,
            biayaBBI: parseFloat(formData.biayaBBI) || 0,
            updatedAt: new Date().toISOString()
        };
        saveData(data);
        return true;
    }
    return false;
}

function deleteData(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) {
        return;
    }
    
    const data = getData();
    const newData = data.filter(item => item.id !== id);
    saveData(newData);
    refreshAll();
    showToast('Data berhasil dihapus!', 'success');
}

// ===== Add Modal Functions =====
function openAddModal() {
    addForm.reset();
    document.getElementById('addTotalBiaya').value = formatCurrency(0);
    addModal.classList.add('show');
}

function closeAddModalFn() {
    addModal.classList.remove('show');
    addForm.reset();
}

// ===== Edit Modal Functions =====
function openEditModal(id) {
    const data = getData();
    const item = data.find(d => d.id === id);
    
    if (!item) {
        showToast('Data tidak ditemukan!', 'error');
        return;
    }
    
    document.getElementById('editId').value = item.id;
    document.getElementById('editProvinsi').value = item.provinsi || '';
    document.getElementById('editKabupaten').value = item.kabupaten;
    document.getElementById('editTambakRusak').value = item.tambakRusak || 0;
    document.getElementById('editBiayaTambak').value = item.biayaTambak || 0;
    document.getElementById('editKolamRusak').value = item.kolamRusak || 0;
    document.getElementById('editBiayaKolam').value = item.biayaKolam || 0;
    document.getElementById('editKjaRusak').value = item.kjaRusak || 0;
    document.getElementById('editBiayaKja').value = item.biayaKja || 0;
    document.getElementById('editSaluran').value = item.saluran || 0;
    document.getElementById('editBiayaSaluran').value = item.biayaSaluran || 0;
    document.getElementById('editPintuAir').value = item.pintuAir || 0;
    document.getElementById('editBiayaPintuAir').value = item.biayaPintuAir || 0;
    document.getElementById('editJalanProduksi').value = item.jalanProduksi || 0;
    document.getElementById('editBiayaJalan').value = item.biayaJalan || 0;
    document.getElementById('editRehabBBI').value = item.rehabBBI || 0;
    document.getElementById('editBiayaBBI').value = item.biayaBBI || 0;
    
    calculateTotal('edit');
    editModal.classList.add('show');
}

function closeEditModal() {
    editModal.classList.remove('show');
    editForm.reset();
}

// ===== Photo Modal Functions =====
const photoModal = document.getElementById('photoModal');
const photoGallery = document.getElementById('photoGallery');
const photoInput = document.getElementById('photoInput');
const closePhotoModal = document.getElementById('closePhotoModal');
const cancelPhotoModal = document.getElementById('cancelPhotoModal');
const PHOTO_STORAGE_KEY = 'budidayaPhotos';
let currentPhotoItemId = null;

function getPhotos() {
    const photos = localStorage.getItem(PHOTO_STORAGE_KEY);
    return photos ? JSON.parse(photos) : {};
}

function savePhotos(photos) {
    localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(photos));
}

function openPhotoModal(id) {
    const data = getData();
    const item = data.find(d => d.id === id);
    
    if (!item) {
        showToast('Data tidak ditemukan!', 'error');
        return;
    }
    
    currentPhotoItemId = id;
    
    document.getElementById('photoKabupatenName').textContent = item.kabupaten;
    document.getElementById('photoProvinsi').textContent = item.provinsi;
    document.getElementById('photoKabupaten').textContent = item.kabupaten;
    
    loadPhotos(id);
    photoModal.classList.add('show');
}

function closePhotoModalFn() {
    photoModal.classList.remove('show');
    currentPhotoItemId = null;
    photoInput.value = '';
}

function loadPhotos(id) {
    const allPhotos = getPhotos();
    const itemPhotos = allPhotos[id] || [];
    
    if (itemPhotos.length === 0) {
        photoGallery.innerHTML = `
            <div class="photo-empty">
                <div class="photo-empty-icon">📷</div>
                <p>Belum ada foto dokumentasi</p>
                <span>Upload foto menggunakan form di bawah</span>
            </div>
        `;
    } else {
        photoGallery.innerHTML = itemPhotos.map((photo, index) => `
            <div class="photo-item" onclick="viewPhoto('${photo}')">
                <img src="${photo}" alt="Dokumentasi ${index + 1}">
                <button class="photo-delete" onclick="event.stopPropagation(); deletePhoto('${id}', ${index})" title="Hapus foto">×</button>
            </div>
        `).join('');
    }
}

function viewPhoto(src) {
    // Create lightbox if not exists
    let lightbox = document.getElementById('lightbox');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox';
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
            <img src="" alt="Preview">
        `;
        document.body.appendChild(lightbox);
        
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
    }
    
    lightbox.querySelector('img').src = src;
    lightbox.classList.add('show');
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
        lightbox.classList.remove('show');
    }
}

function deletePhoto(itemId, photoIndex) {
    if (!confirm('Hapus foto ini?')) return;
    
    const allPhotos = getPhotos();
    if (allPhotos[itemId]) {
        allPhotos[itemId].splice(photoIndex, 1);
        savePhotos(allPhotos);
        loadPhotos(itemId);
        showToast('Foto berhasil dihapus!', 'success');
    }
}

// Photo upload handler
if (photoInput) {
    photoInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (!files.length || !currentPhotoItemId) return;
        
        const allPhotos = getPhotos();
        if (!allPhotos[currentPhotoItemId]) {
            allPhotos[currentPhotoItemId] = [];
        }
        
        let loadedCount = 0;
        const totalFiles = files.length;
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                allPhotos[currentPhotoItemId].push(event.target.result);
                loadedCount++;
                
                if (loadedCount === totalFiles) {
                    savePhotos(allPhotos);
                    loadPhotos(currentPhotoItemId);
                    photoInput.value = '';
                    showToast(`${totalFiles} foto berhasil diupload!`, 'success');
                }
            };
            reader.readAsDataURL(file);
        });
    });
}

// Photo modal event listeners
if (closePhotoModal) {
    closePhotoModal.addEventListener('click', closePhotoModalFn);
}
if (cancelPhotoModal) {
    cancelPhotoModal.addEventListener('click', closePhotoModalFn);
}
if (photoModal) {
    photoModal.addEventListener('click', (e) => {
        if (e.target === photoModal) {
            closePhotoModalFn();
        }
    });
}

// ===== Search Function =====
function searchData(query) {
    const data = getFilteredData();
    if (!query.trim()) {
        renderTable(data);
        return;
    }
    
    const filtered = data.filter(item => 
        item.kabupaten.toLowerCase().includes(query.toLowerCase()) ||
        (item.provinsi && item.provinsi.toLowerCase().includes(query.toLowerCase()))
    );
    
    renderTable(filtered);
}

// ===== Event Listeners =====
addDataBtn.addEventListener('click', openAddModal);
closeAddModal.addEventListener('click', closeAddModalFn);
cancelAddModal.addEventListener('click', closeAddModalFn);

addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = {
        provinsi: document.getElementById('addProvinsi').value,
        kabupaten: document.getElementById('addKabupaten').value,
        tambakRusak: document.getElementById('addTambakRusak').value,
        biayaTambak: document.getElementById('addBiayaTambak').value,
        kolamRusak: document.getElementById('addKolamRusak').value,
        biayaKolam: document.getElementById('addBiayaKolam').value,
        kjaRusak: document.getElementById('addKjaRusak').value,
        biayaKja: document.getElementById('addBiayaKja').value,
        saluran: document.getElementById('addSaluran').value,
        biayaSaluran: document.getElementById('addBiayaSaluran').value,
        pintuAir: document.getElementById('addPintuAir').value,
        biayaPintuAir: document.getElementById('addBiayaPintuAir').value,
        jalanProduksi: document.getElementById('addJalanProduksi').value,
        biayaJalan: document.getElementById('addBiayaJalan').value,
        rehabBBI: document.getElementById('addRehabBBI').value,
        biayaBBI: document.getElementById('addBiayaBBI').value
    };
    
    addData(formData);
    closeAddModalFn();
    refreshAll();
    showToast('Data berhasil ditambahkan!', 'success');
});

editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editId').value;
    const formData = {
        provinsi: document.getElementById('editProvinsi').value,
        kabupaten: document.getElementById('editKabupaten').value,
        tambakRusak: document.getElementById('editTambakRusak').value,
        biayaTambak: document.getElementById('editBiayaTambak').value,
        kolamRusak: document.getElementById('editKolamRusak').value,
        biayaKolam: document.getElementById('editBiayaKolam').value,
        kjaRusak: document.getElementById('editKjaRusak').value,
        biayaKja: document.getElementById('editBiayaKja').value,
        saluran: document.getElementById('editSaluran').value,
        biayaSaluran: document.getElementById('editBiayaSaluran').value,
        pintuAir: document.getElementById('editPintuAir').value,
        biayaPintuAir: document.getElementById('editBiayaPintuAir').value,
        jalanProduksi: document.getElementById('editJalanProduksi').value,
        biayaJalan: document.getElementById('editBiayaJalan').value,
        rehabBBI: document.getElementById('editRehabBBI').value,
        biayaBBI: document.getElementById('editBiayaBBI').value
    };
    
    if (updateData(id, formData)) {
        closeEditModal();
        refreshAll();
        showToast('Data berhasil diperbarui!', 'success');
    } else {
        showToast('Gagal memperbarui data!', 'error');
    }
});

closeModal.addEventListener('click', closeEditModal);
cancelEdit.addEventListener('click', closeEditModal);

addModal.addEventListener('click', (e) => {
    if (e.target === addModal) {
        closeAddModalFn();
    }
});

editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeEditModal();
    }
});

searchInput.addEventListener('input', (e) => {
    searchData(e.target.value);
});

filterProvinsi.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderTable();
    updateSummary();
    updateCharts();
    updateMap();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (addModal.classList.contains('show')) {
            closeAddModalFn();
        }
        if (editModal.classList.contains('show')) {
            closeEditModal();
        }
    }
});

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    setupCostCalculation('add');
    setupCostCalculation('edit');
    initMap();
    refreshAll();
});
