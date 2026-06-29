document.addEventListener('DOMContentLoaded', () => {
    // Pastikan data tersedia dari data.js
    if (typeof matriksBappenasData === 'undefined') {
        console.error('Data matriksBappenasData tidak ditemukan!');
        return;
    }

    // Konfigurasi State
    const state = {
        rawData: [],
        filteredData: [],
        currentPage: 1,
        itemsPerPage: 15,
        filters: {
            provinsi: '',
            sektor: '',
            isu: '',
            ro: '',
            search: ''
        },
        charts: {
            provinsi: null,
            tahun: null,
            sektor: null,
            kabkota: null
        }
    };

    // KKP Theme Colors for Charts
    const colors = {
        primary: '#03255C',
        secondary: '#043685',
        tertiary: '#1c4e99',
        quaternary: '#4a7ec9',
        accent: '#03545C'
    };
    
    // Palette generator for charts with many categories
    const chartPalette = [
        '#03255C', '#03545C', '#043685', '#0284c7', '#1c4e99', '#4a7ec9', '#64748b', '#94a3b8'
    ];

    // Helper: Parse Rupiah string to Number
    const parseRupiah = (str) => {
        if (!str) return 0;
        let cleanStr = str.replace(/[Rp\s,.]/g, '');
        let val = parseInt(cleanStr, 10);
        return isNaN(val) ? 0 : val;
    };

    // Helper: Format Number to Rupiah
    const formatRupiah = (num) => {
        if (num === 0) return '-';
        if (num >= 1e12) return `Rp ${(num / 1e12).toFixed(2)} Triliun`;
        if (num >= 1e9) return `Rp ${(num / 1e9).toFixed(2)} Miliar`;
        if (num >= 1e6) return `Rp ${(num / 1e6).toFixed(2)} Juta`;
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    };

    // Data Initialization & Cleaning
    const initializeData = () => {
        state.rawData = matriksBappenasData.filter(item => {
            // Filter out subtotal rows, headers, and shifted data
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
        
        state.filteredData = [...state.rawData];
    };

    // Setup Filter Options
    const setupFilters = () => {
        const getUniqueValues = (key) => {
            const values = state.rawData.map(item => item[key]?.trim()).filter(v => v);
            return [...new Set(values)].sort();
        };

        const populateSelect = (elementId, values) => {
            const select = document.getElementById(elementId);
            values.forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val.length > 80 ? val.substring(0, 80) + '...' : val;
                select.appendChild(option);
            });
        };

        populateSelect('filter-provinsi', getUniqueValues('provinsi'));
        populateSelect('filter-sektor', getUniqueValues('sektor'));
        populateSelect('filter-isu', getUniqueValues('isu'));
        populateSelect('filter-ro', getUniqueValues('ro'));

        // Event Listeners
        document.getElementById('filter-provinsi').addEventListener('change', (e) => {
            state.filters.provinsi = e.target.value;
            applyFilters();
        });
        document.getElementById('filter-sektor').addEventListener('change', (e) => {
            state.filters.sektor = e.target.value;
            applyFilters();
        });
        document.getElementById('filter-isu').addEventListener('change', (e) => {
            state.filters.isu = e.target.value;
            applyFilters();
        });
        document.getElementById('filter-ro').addEventListener('change', (e) => {
            state.filters.ro = e.target.value;
            applyFilters();
        });
        document.getElementById('search-input').addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase();
            applyFilters();
        });
        document.getElementById('btn-reset-filter').addEventListener('click', () => {
            document.getElementById('filter-provinsi').value = '';
            document.getElementById('filter-sektor').value = '';
            document.getElementById('filter-isu').value = '';
            document.getElementById('filter-ro').value = '';
            document.getElementById('search-input').value = '';
            
            state.filters = { provinsi: '', sektor: '', isu: '', ro: '', search: '' };
            applyFilters();
        });
    };

    // Helper to get anggaran
    const getItemAnggaran = (item) => {
        return item.numTotalAnggaran;
    };

    // Apply Filters and Re-render
    const applyFilters = () => {
        state.filteredData = state.rawData.filter(item => {
            const matchProvinsi = !state.filters.provinsi || item.provinsi === state.filters.provinsi;
            const matchSektor = !state.filters.sektor || item.sektor === state.filters.sektor;
            const matchIsu = !state.filters.isu || item.isu === state.filters.isu;
            const matchRO = !state.filters.ro || item.ro === state.filters.ro;
            
            const matchSearch = !state.filters.search || 
                (item.rencanaAksi && item.rencanaAksi.toLowerCase().includes(state.filters.search)) ||
                (item.kabKota && item.kabKota.toLowerCase().includes(state.filters.search)) ||
                (item.program && item.program.toLowerCase().includes(state.filters.search));

            return matchProvinsi && matchSektor && matchIsu && matchRO && matchSearch;
        });

        state.currentPage = 1;
        updateDashboard();
    };

    // Render Summary Cards
    const renderSummary = () => {
        const totalAnggaran = state.filteredData.reduce((sum, item) => sum + getItemAnggaran(item), 0);
        const programs = new Set(state.filteredData.map(item => item.program).filter(v => v));
        const provs = new Set(state.filteredData.map(item => item.provinsi).filter(v => v));
        const kabKotaSet = new Set();
        
        // Calculate sector distribution for narrative insight
        const sektorSums = {};
        state.filteredData.forEach(item => {
            if (item.sektor) sektorSums[item.sektor] = (sektorSums[item.sektor] || 0) + getItemAnggaran(item);
            if (item.kabKota) {
                item.kabKota.split(/[,.]/).forEach(k => {
                    const clean = k.trim();
                    if (clean && clean.length > 2) kabKotaSet.add(clean);
                });
            }
        });

        let topSektor = '', maxSektorVal = 0;
        Object.entries(sektorSums).forEach(([sek, val]) => {
            if (val > maxSektorVal) { maxSektorVal = val; topSektor = sek; }
        });
        const topSektorPct = totalAnggaran > 0 ? Math.round((maxSektorVal / totalAnggaran) * 100) : 0;

        document.getElementById('stat-anggaran').textContent = formatRupiah(totalAnggaran);
        document.getElementById('stat-aksi').textContent = state.filteredData.length;
        document.getElementById('stat-program').textContent = programs.size;
        document.getElementById('stat-kabkota').textContent = kabKotaSet.size;

        // Dynamic SMART storytelling insights
        const elAnggaran = document.getElementById('insight-anggaran');
        if (elAnggaran) elAnggaran.textContent = topSektor ? `Dominasi Sektor ${topSektor} (${topSektorPct}%)` : 'Tersebar merata';
        
        const elAksi = document.getElementById('insight-aksi');
        if (elAksi) elAksi.textContent = `Meliputi ${provs.size} Provinsi terdampak`;

        const elProgram = document.getElementById('insight-program');
        if (elProgram) elProgram.textContent = `Rata-rata ${Math.round(state.filteredData.length / (programs.size || 1))} aksi/program`;

        const elKabKota = document.getElementById('insight-kabkota');
        if (elKabKota) elKabKota.textContent = `Tersebar di ${kabKotaSet.size} titik lokasi`;
    };

    // Helper formatting for charts
    const chartNumberFormat = (val) => {
        if (val >= 1e12) return (val / 1e12).toFixed(1) + 'T';
        if (val >= 1e9) return (val / 1e9).toFixed(1) + 'M';
        if (val >= 1e6) return (val / 1e6).toFixed(1) + 'Jt';
        return val;
    };

    // Render Charts
    const renderCharts = () => {
        
        // 1. Chart Provinsi (Doughnut)
        const provData = {};
        state.filteredData.forEach(item => {
            if (!item.provinsi) return;
            provData[item.provinsi] = (provData[item.provinsi] || 0) + getItemAnggaran(item);
        });
        
        const provLabels = Object.keys(provData);
        const provValues = Object.values(provData);

        const ctxProv = document.getElementById('chart-provinsi').getContext('2d');
        if (state.charts.provinsi) {
            state.charts.provinsi.data.labels = provLabels;
            state.charts.provinsi.data.datasets[0].data = provValues;
            state.charts.provinsi.update();
        } else {
            state.charts.provinsi = new Chart(ctxProv, {
                type: 'doughnut',
                data: {
                    labels: provLabels,
                    datasets: [{
                        data: provValues,
                        backgroundColor: [colors.primary, colors.accent, colors.quaternary, '#cbd5e1'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { position: 'right', labels: { usePointStyle: true } },
                        tooltip: {
                            callbacks: { label: (context) => ` ${formatRupiah(context.raw)}` }
                        }
                    }
                }
            });
        }

        // 2. Chart Tahun (Bar)
        let total2026 = 0, total2027 = 0, total2028 = 0;
        state.filteredData.forEach(item => {
            total2026 += item.numAnggaran2026;
            total2027 += item.numAnggaran2027;
            total2028 += item.numAnggaran2028;
        });

        const ctxTahun = document.getElementById('chart-tahun').getContext('2d');
        if (state.charts.tahun) {
            state.charts.tahun.data.datasets[0].data = [total2026, total2027, total2028];
            state.charts.tahun.update();
        } else {
            state.charts.tahun = new Chart(ctxTahun, {
                type: 'bar',
                data: {
                    labels: ['2026', '2027', '2028'],
                    datasets: [{
                        label: 'Alokasi Anggaran',
                        data: [total2026, total2027, total2028],
                        backgroundColor: colors.primary,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (context) => formatRupiah(context.raw) } }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: (val) => chartNumberFormat(val) }
                        }
                    }
                }
            });
        }

        // 3. Chart Sektor (Pie)
        const sektorData = {};
        state.filteredData.forEach(item => {
            if (!item.sektor) return;
            sektorData[item.sektor] = (sektorData[item.sektor] || 0) + getItemAnggaran(item);
        });

        const ctxSektor = document.getElementById('chart-sektor').getContext('2d');
        if (state.charts.sektor) {
            state.charts.sektor.data.labels = Object.keys(sektorData);
            state.charts.sektor.data.datasets[0].data = Object.values(sektorData);
            state.charts.sektor.update();
        } else {
            state.charts.sektor = new Chart(ctxSektor, {
                type: 'pie',
                data: {
                    labels: Object.keys(sektorData),
                    datasets: [{
                        data: Object.values(sektorData),
                        backgroundColor: chartPalette,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { usePointStyle: true } },
                        tooltip: { callbacks: { label: (context) => ` ${formatRupiah(context.raw)}` } }
                    }
                }
            });
        }

        // 4. Chart Top Kab/Kota (Horizontal Bar)
        const kabKotaData = {};
        state.filteredData.forEach(item => {
            if (!item.kabKota) return;
            // Handle multiple kabKota in one row for approximation
            const kabKotas = item.kabKota.split(/[,.]/).map(k => k.trim()).filter(k => k.length > 2);
            if (kabKotas.length > 0) {
                const avgAnggaran = getItemAnggaran(item) / kabKotas.length;
                kabKotas.forEach(k => {
                    kabKotaData[k] = (kabKotaData[k] || 0) + avgAnggaran;
                });
            }
        });

        // Sort and get Top 5
        const sortedKabKota = Object.entries(kabKotaData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const kabKotaLabels = sortedKabKota.map(k => k[0]);
        const kabKotaValues = sortedKabKota.map(k => k[1]);

        const ctxKabKota = document.getElementById('chart-kabkota').getContext('2d');
        if (state.charts.kabkota) {
            state.charts.kabkota.data.labels = kabKotaLabels;
            state.charts.kabkota.data.datasets[0].data = kabKotaValues;
            state.charts.kabkota.update();
        } else {
            state.charts.kabkota = new Chart(ctxKabKota, {
                type: 'bar',
                data: {
                    labels: kabKotaLabels,
                    datasets: [{
                        label: 'Anggaran (Estimasi)',
                        data: kabKotaValues,
                        backgroundColor: colors.accent,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (context) => formatRupiah(context.raw) } }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: { callback: (val) => chartNumberFormat(val) }
                        }
                    }
                }
            });
        }
    };

    // Render Table
    const renderTable = () => {
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';

        const startIdx = (state.currentPage - 1) * state.itemsPerPage;
        const endIdx = startIdx + state.itemsPerPage;
        const pageData = state.filteredData.slice(startIdx, endIdx);

        if (pageData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 2rem;">Tidak ada data yang ditemukan.</td></tr>`;
            renderPagination();
            return;
        }

        pageData.forEach(item => {
            const tr = document.createElement('tr');
            
            let badgeHtml = '';
            if (item.skema) badgeHtml += `<span class="badge badge-blue" style="margin-bottom:4px; display:inline-block;">${item.skema}</span><br>`;
            if (item.mitra) badgeHtml += `<span class="badge badge-gray" style="display:inline-block;">${item.mitra}</span>`;

            tr.innerHTML = `
                <td>${item.provinsi || '-'}</td>
                <td class="cell-truncate" title="${item.kabKota}">${item.kabKota || '-'}</td>
                <td><span class="badge badge-green">${item.sektor || '-'}</span></td>
                <td class="cell-truncate" title="${item.program}">${item.program || '-'}</td>
                <td class="cell-truncate" title="${item.rencanaAksi}" style="font-weight: 500;">${item.rencanaAksi || '-'}</td>
                <td class="cell-truncate" title="${item.sasaran}">${item.sasaran || '-'}</td>
                <td>
                    <div style="font-size: 0.75rem; color: #475569;">${item.output2026 || ''}</div>
                    <div>${item.numAnggaran2026 ? formatRupiah(item.numAnggaran2026) : '-'}</div>
                </td>
                <td>
                    <div style="font-size: 0.75rem; color: #475569;">${item.output2027 || ''}</div>
                    <div>${item.numAnggaran2027 ? formatRupiah(item.numAnggaran2027) : '-'}</div>
                </td>
                <td>
                    <div style="font-size: 0.75rem; color: #475569;">${item.output2028 || ''}</div>
                    <div>${item.numAnggaran2028 ? formatRupiah(item.numAnggaran2028) : '-'}</div>
                </td>
                <td style="font-weight: 600; color: #03255C;">${item.numTotalAnggaran ? formatRupiah(item.numTotalAnggaran) : '-'}</td>
                <td>${badgeHtml || '-'}</td>
            `;
            tr.title = "Klik baris ini untuk melihat rincian detail record data";
            tr.addEventListener('click', () => {
                window.location.href = `detail.html?id=${item.id}`;
            });
            tbody.appendChild(tr);
        });

        renderPagination();
    };

    // Render Pagination
    const renderPagination = () => {
        const paginationContainer = document.getElementById('pagination');
        paginationContainer.innerHTML = '';
        
        const totalItems = state.filteredData.length;
        const totalPages = Math.ceil(totalItems / state.itemsPerPage);
        
        if (totalPages <= 1) return;

        const info = document.createElement('div');
        info.className = 'page-info';
        const startIdx = (state.currentPage - 1) * state.itemsPerPage + 1;
        const endIdx = Math.min(startIdx + state.itemsPerPage - 1, totalItems);
        info.textContent = `Menampilkan ${startIdx}-${endIdx} dari ${totalItems} baris data`;
        paginationContainer.appendChild(info);

        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = 'Sebelumnya';
        prevBtn.disabled = state.currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderTable();
            }
        });
        paginationContainer.appendChild(prevBtn);

        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = 'Selanjutnya';
        nextBtn.disabled = state.currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (state.currentPage < totalPages) {
                state.currentPage++;
                renderTable();
            }
        });
        paginationContainer.appendChild(nextBtn);
    };

    // Master Update Function
    const updateDashboard = () => {
        renderSummary();
        renderCharts();
        renderTable();
    };

    // Initialize Application
    initializeData();
    setupFilters();
    updateDashboard();
});
