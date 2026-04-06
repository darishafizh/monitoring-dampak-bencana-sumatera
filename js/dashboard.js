/**
 * dashboard.js — Display-only dashboard controller
 * Uses static data from js/data.js (RAW_DATA)
 */

// ==========================================
// DATA REFERENCE (from data.js)
// ==========================================
const D = RAW_DATA;

// ==========================================
// Chart.js defaults
// ==========================================
Chart.defaults.font.family = "'Mulish', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#4A5568';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.plugins.tooltip.backgroundColor = '#1A202C';
Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 13 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.datasets.bar.borderRadius = 5;
Chart.defaults.datasets.bar.maxBarThickness = 44;

const C = {
  aceh: '#1565C0',
  sumut: '#00838F',
  sumbar: '#2E7D32',
  blue: '#005B96',
  teal: '#00838F',
  gold: '#D4A843',
  danger: '#E53935',
  warn: '#FB8C00',
  warnL: '#FFA726',
  success: '#43A047',
  pal: ['#005B96', '#00838F', '#2E7D32', '#D4A843', '#E53935', '#6A1B9A', '#00695C', '#FB8C00', '#1565C0', '#4E342E'],
};

let charts = {};
const PG = 15;
let rPage = 1,
  dPage = 1;

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupFilters();
  render();
});

// ==========================================
// NAV
// ==========================================
function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
    el.addEventListener('click', () => {
      const p = el.dataset.page;
      document.querySelectorAll('.nav-item[data-page]').forEach((n) => n.classList.toggle('active', n.dataset.page === p));
      document.querySelectorAll('.page').forEach((pg) => pg.classList.toggle('active', pg.id === 'p-' + p));
      const t = { overview: 'Overview', 'rencana-aksi': 'Rencana Aksi', dampak: 'Data Dampak', anggaran: 'Anggaran' };
      document.getElementById('pageTitle').textContent = t[p] || 'Dashboard';
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

// ==========================================
// FILTERS
// ==========================================
function setupFilters() {
  document.getElementById('fProv').addEventListener('change', render);
  document.getElementById('fYear').addEventListener('change', render);
  document.getElementById('fSektor').addEventListener('change', () => {
    rPage = 1;
    renderRencanaTable();
  });
  document.getElementById('fBagian').addEventListener('change', () => {
    dPage = 1;
    renderDampakTable();
  });

  let t1, t2;
  document.getElementById('sRencana').addEventListener('input', () => {
    clearTimeout(t1);
    t1 = setTimeout(() => {
      rPage = 1;
      renderRencanaTable();
    }, 250);
  });
  document.getElementById('sDampak').addEventListener('input', () => {
    clearTimeout(t2);
    t2 = setTimeout(() => {
      dPage = 1;
      renderDampakTable();
    }, 250);
  });
}

// ==========================================
// HELPERS
// ==========================================
function fmtRp(v, isK = true) {
  if (!v && v !== 0) return '—';
  let n = +v;
  if (isNaN(n)) return '—';
  if (isK) n *= 1000;
  if (n >= 1e12) return 'Rp ' + (n / 1e12).toFixed(2) + ' T';
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(2) + ' M';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + ' Jt';
  return 'Rp ' + n.toLocaleString('id-ID');
}

function fmtN(v) {
  if (!v && v !== 0) return '—';
  return (+v).toLocaleString('id-ID');
}

function trunc(s, n = 35) {
  return s && s.length > n ? s.slice(0, n) + '…' : s || '';
}

function matchProv(val, filter) {
  if (!val || filter === 'semua') return true;
  const v = val.toLowerCase();
  if (filter === 'aceh') return v.includes('aceh');
  if (filter === 'sumut') return v.includes('sumatera utara') || v.includes('sumut');
  if (filter === 'sumbar') return v.includes('sumatera barat') || v.includes('sumbar');
  return true;
}

function provBadge(p) {
  if (!p) return '<span style="color:var(--text-light)">—</span>';
  const l = p.toLowerCase();
  if (l.includes('aceh')) return `<span class="badge badge-aceh">${p}</span>`;
  if (l.includes('utara') || l.includes('sumut')) return `<span class="badge badge-sumut">${p}</span>`;
  if (l.includes('barat') || l.includes('sumbar')) return `<span class="badge badge-sumbar">${p}</span>`;
  return `<span class="badge badge-blue">${p}</span>`;
}

// ==========================================
// MAIN RENDER
// ==========================================
function render() {
  const prov = document.getElementById('fProv').value;
  const year = document.getElementById('fYear').value;

  renderKPIs(prov, year);
  renderOverviewCharts();
  fillSektorFilter();
  renderRencanaTable();
  renderRencanaCharts();
  fillBagianFilter();
  renderDampakKPIs();
  renderDampakCharts();
  renderDampakTable();
  renderAnggaranKPIs();
  renderAnggaranCharts();
  renderAnggaranTable();
}

// ==========================================
// KPIs (OVERVIEW)
// ==========================================
function renderKPIs(prov, year) {
  let totalAng = 0;
  for (const r of D.highlightRekap) {
    for (const p of prov === 'semua' ? ['aceh', 'sumut', 'sumbar'] : [prov]) {
      for (const y of year === 'semua' ? ['2026', '2027', '2028'] : [year]) {
        totalAng += r[`t${y}_${p}_rp`] || 0;
      }
    }
  }

  const kabSet = new Set();
  for (const r of D.matriksAksi) {
    if (r.kab_kota && (prov === 'semua' || matchProv(r.provinsi, prov))) kabSet.add(r.kab_kota);
  }

  let totalDmpk = 0;
  for (const r of D.dampak) {
    if (prov === 'semua' || matchProv(r.provinsi, prov)) totalDmpk += r.jumlah || 0;
  }

  document.getElementById('k-ang').textContent = fmtRp(totalAng, true);
  document.getElementById('k-kab').textContent = fmtN(kabSet.size);
  document.getElementById('k-prog').textContent = fmtN(D.highlightRekap.length);
  document.getElementById('k-dmpk').textContent = fmtN(totalDmpk);
}

// ==========================================
// OVERVIEW CHARTS
// ==========================================
function renderOverviewCharts() {
  // Sektor donut
  const sMap = {};
  for (const r of D.matriksAksi) {
    if (r.sektor && r.total_anggaran) {
      sMap[r.sektor] = (sMap[r.sektor] || 0) + r.total_anggaran;
    }
  }
  const sEntries = Object.entries(sMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  mkChart(
    'chSektor',
    'doughnut',
    {
      labels: sEntries.map(([k]) => k),
      datasets: [{ data: sEntries.map(([, v]) => +(v / 1e9).toFixed(2)), backgroundColor: C.pal.slice(0, sEntries.length), borderWidth: 0, hoverOffset: 6 }],
    },
    { cutout: '62%', plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => c.label + ': ' + c.formattedValue + ' M' } } } },
  );

  // Anggaran per provinsi per tahun
  const yrs = ['2026', '2027', '2028'];
  const aggProv = { aceh: [0, 0, 0], sumut: [0, 0, 0], sumbar: [0, 0, 0] };
  for (const r of D.highlightRekap) {
    for (let i = 0; i < 3; i++) {
      aggProv.aceh[i] += ((r[`t${yrs[i]}_aceh_rp`] || 0) * 1000) / 1e9;
      aggProv.sumut[i] += ((r[`t${yrs[i]}_sumut_rp`] || 0) * 1000) / 1e9;
      aggProv.sumbar[i] += ((r[`t${yrs[i]}_sumbar_rp`] || 0) * 1000) / 1e9;
    }
  }
  const fix2 = (arr) => arr.map((v) => +v.toFixed(2));

  mkChart(
    'chProvTahun',
    'bar',
    {
      labels: yrs,
      datasets: [
        { label: 'Aceh', data: fix2(aggProv.aceh), backgroundColor: C.aceh },
        { label: 'Sumatera Utara', data: fix2(aggProv.sumut), backgroundColor: C.sumut },
        { label: 'Sumatera Barat', data: fix2(aggProv.sumbar), backgroundColor: C.sumbar },
      ],
    },
    { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: '#EDF2F7' }, title: { display: true, text: 'Miliar Rupiah', font: { size: 11 } } } } },
  );

  // Top programs
  const progs = D.highlightRekap
    .map((r) => ({
      name: r.program,
      total: ((r.t2026_total_rp || 0) + (r.t2027_total_rp || 0) + (r.t2028_total_rp || 0)) * 1000,
    }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  mkChart(
    'chTopProg',
    'bar',
    {
      labels: progs.map((p) => trunc(p.name, 38)),
      datasets: [{ data: progs.map((p) => +(p.total / 1e9).toFixed(2)), backgroundColor: C.pal.slice(0, progs.length).map((c) => c + 'CC'), borderColor: C.pal.slice(0, progs.length), borderWidth: 1 }],
    },
    {
      indexAxis: 'y',
      scales: { x: { grid: { color: '#EDF2F7' }, title: { display: true, text: 'Miliar Rupiah', font: { size: 11 } } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (it) => progs[it[0].dataIndex]?.name, label: (c) => 'Anggaran: ' + c.formattedValue + ' M' } } },
    },
  );

  // Summary table
  const provLabels = { aceh: 'Aceh', sumut: 'Sumatera Utara', sumbar: 'Sumatera Barat' };
  const tbody = document.querySelector('#tblProvSummary tbody');
  tbody.innerHTML = '';
  let gAng = 0,
    gKab = 0;
  for (const pk of ['aceh', 'sumut', 'sumbar']) {
    let ang = 0,
      kab = 0;
    for (const r of D.highlightRekap) {
      for (const y of ['t2026', 't2027', 't2028']) {
        ang += r[`${y}_${pk}_rp`] || 0;
        kab += r[`${y}_${pk}_kab`] || 0;
      }
    }
    gAng += ang;
    gKab += kab;
    const cls = pk === 'aceh' ? 'badge-aceh' : pk === 'sumut' ? 'badge-sumut' : 'badge-sumbar';
    tbody.innerHTML += `<tr><td><span class="badge ${cls}">${provLabels[pk]}</span></td><td class="cur">${fmtRp(ang, true)}</td><td class="num">${fmtN(kab)}</td></tr>`;
  }
  tbody.innerHTML += `<tr style="background:var(--bg-muted)"><td><strong>TOTAL</strong></td><td class="cur bold">${fmtRp(gAng, true)}</td><td class="num bold">${fmtN(gKab)}</td></tr>`;
}

// ==========================================
// RENCANA AKSI
// ==========================================
function fillSektorFilter() {
  const set = new Set();
  D.matriksAksi.forEach((r) => r.sektor && set.add(r.sektor));
  const sel = document.getElementById('fSektor');
  sel.innerHTML = '<option value="semua">Semua Sektor</option>';
  [...set].sort().forEach((s) => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    sel.appendChild(o);
  });
}

function renderRencanaTable() {
  const prov = document.getElementById('fProv').value;
  const sektor = document.getElementById('fSektor').value;
  const q = document.getElementById('sRencana').value.toLowerCase();

  let data = D.matriksAksi.filter((r) => {
    if (prov !== 'semua' && !matchProv(r.provinsi, prov)) return false;
    if (sektor !== 'semua' && r.sektor !== sektor) return false;
    if (q && !((r.rencana_aksi || '').toLowerCase().includes(q) || (r.program || '').toLowerCase().includes(q) || (r.kab_kota || '').toLowerCase().includes(q))) return false;
    return true;
  });

  // Pills
  document.getElementById('rencanaPills').innerHTML =
    `<div class="pill">📋 Total: <b>${data.length}</b> rencana aksi</div>` +
    `<div class="pill">💰 Total: <b>${fmtRp(
      data.reduce((s, r) => s + (r.total_anggaran || 0), 0),
      false,
    )}</b></div>`;

  const tp = Math.max(1, Math.ceil(data.length / PG));
  rPage = Math.min(rPage, tp);
  const st = (rPage - 1) * PG;
  const pg = data.slice(st, st + PG);

  const tb = document.querySelector('#tblRencana tbody');
  tb.innerHTML = '';
  if (!pg.length) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:var(--sp-8);color:var(--text-muted)">Tidak ada data ditemukan</td></tr>';
  } else {
    pg.forEach((r, i) => {
      tb.innerHTML += `<tr>
        <td style="color:var(--text-light)">${st + i + 1}</td>
        <td style="max-width:240px">${r.rencana_aksi || r.program || '—'}</td>
        <td><span class="badge badge-blue">${r.sektor || '—'}</span></td>
        <td>${provBadge(r.provinsi)}</td>
        <td>${r.kab_kota || '—'}</td>
        <td class="cur">${fmtRp(r.anggaran_2026, false)}</td>
        <td class="cur">${fmtRp(r.anggaran_2027, false)}</td>
        <td class="cur">${fmtRp(r.anggaran_2028, false)}</td>
        <td class="cur bold">${fmtRp(r.total_anggaran, false)}</td>
        <td>${r.sumber_dana || '—'}</td>
      </tr>`;
    });
  }

  document.getElementById('rencanaInfo').textContent = `Menampilkan ${st + 1}–${Math.min(st + PG, data.length)} dari ${data.length} data`;
  mkPaging('rencanaPag', rPage, tp, (p) => {
    rPage = p;
    renderRencanaTable();
  });
}

function renderRencanaCharts() {
  // Sumber dana
  const sMap = {};
  D.matriksAksi.forEach((r) => {
    if (r.sumber_dana && r.total_anggaran) sMap[r.sumber_dana] = (sMap[r.sumber_dana] || 0) + r.total_anggaran;
  });
  const sE = Object.entries(sMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  mkChart(
    'chSumber',
    'doughnut',
    {
      labels: sE.map(([k]) => k),
      datasets: [{ data: sE.map(([, v]) => +(v / 1e9).toFixed(2)), backgroundColor: C.pal.slice(0, sE.length), borderWidth: 0 }],
    },
    { cutout: '58%', plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } } },
  );

  // Aksi per kab
  const kMap = {};
  D.matriksAksi.forEach((r) => {
    if (r.kab_kota) kMap[r.kab_kota] = (kMap[r.kab_kota] || 0) + 1;
  });
  const kE = Object.entries(kMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  mkChart(
    'chAksiKab',
    'bar',
    {
      labels: kE.map(([k]) => trunc(k, 18)),
      datasets: [{ data: kE.map(([, v]) => v), backgroundColor: C.blue + 'CC', borderColor: C.blue, borderWidth: 1 }],
    },
    { indexAxis: 'y', scales: { x: { grid: { color: '#EDF2F7' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } }, plugins: { legend: { display: false } } },
  );
}

// ==========================================
// DAMPAK
// ==========================================
function fillBagianFilter() {
  const set = new Set();
  D.dampak.forEach((r) => r.bagian && set.add(r.bagian));
  const sel = document.getElementById('fBagian');
  sel.innerHTML = '<option value="semua">Semua Unit Kerja</option>';
  [...set].sort().forEach((b) => {
    const o = document.createElement('option');
    o.value = b;
    o.textContent = b;
    sel.appendChild(o);
  });
}

function renderDampakKPIs() {
  let rr = 0,
    rs = 0,
    rb = 0,
    h = 0;
  D.bahanRapat.forEach((r) => {
    rr += r.rusak_ringan || 0;
    rs += r.rusak_sedang || 0;
    rb += r.rusak_berat || 0;
    h += r.hilang || 0;
  });
  document.getElementById('k-rr').textContent = fmtN(rr);
  document.getElementById('k-rs').textContent = fmtN(rs);
  document.getElementById('k-rb').textContent = fmtN(rb);
  document.getElementById('k-h').textContent = fmtN(h);
}

function renderDampakCharts() {
  // Per bagian
  const bMap = {};
  D.dampak.forEach((r) => {
    if (r.bagian) bMap[r.bagian] = (bMap[r.bagian] || 0) + (r.jumlah || 0);
  });
  const bE = Object.entries(bMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  mkChart(
    'chBagian',
    'doughnut',
    {
      labels: bE.map(([k]) => k),
      datasets: [{ data: bE.map(([, v]) => v), backgroundColor: C.pal.slice(0, bE.length), borderWidth: 0 }],
    },
    { cutout: '58%', plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } } },
  );

  // Kerusakan per kab
  const kMap = {};
  D.bahanRapat.forEach((r) => {
    if (!r.kab_kota) return;
    if (!kMap[r.kab_kota]) kMap[r.kab_kota] = { rr: 0, rs: 0, rb: 0, h: 0 };
    kMap[r.kab_kota].rr += r.rusak_ringan || 0;
    kMap[r.kab_kota].rs += r.rusak_sedang || 0;
    kMap[r.kab_kota].rb += r.rusak_berat || 0;
    kMap[r.kab_kota].h += r.hilang || 0;
  });
  const kE = Object.entries(kMap)
    .map(([k, v]) => ({ kab: k, ...v, tot: v.rr + v.rs + v.rb + v.h }))
    .filter((e) => e.tot > 0)
    .sort((a, b) => b.tot - a.tot)
    .slice(0, 10);

  mkChart(
    'chKerusakan',
    'bar',
    {
      labels: kE.map((r) => trunc(r.kab, 16)),
      datasets: [
        { label: 'Rusak Ringan', data: kE.map((r) => r.rr), backgroundColor: C.warnL },
        { label: 'Rusak Sedang', data: kE.map((r) => r.rs), backgroundColor: C.warn },
        { label: 'Rusak Berat', data: kE.map((r) => r.rb), backgroundColor: C.danger },
        { label: 'Hilang', data: kE.map((r) => r.h), backgroundColor: '#455A64' },
      ],
    },
    { scales: { x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } }, y: { stacked: true, grid: { color: '#EDF2F7' } } }, plugins: { legend: { position: 'bottom', labels: { padding: 10, font: { size: 11 } } } } },
  );
}

function renderDampakTable() {
  const prov = document.getElementById('fProv').value;
  const bag = document.getElementById('fBagian').value;
  const q = document.getElementById('sDampak').value.toLowerCase();

  let data = D.dampak.filter((r) => {
    if (prov !== 'semua' && !matchProv(r.provinsi, prov)) return false;
    if (bag !== 'semua' && r.bagian !== bag) return false;
    if (q && !((r.dampak || '').toLowerCase().includes(q) || (r.kabupaten || '').toLowerCase().includes(q) || (r.bagian || '').toLowerCase().includes(q))) return false;
    return true;
  });

  const tp = Math.max(1, Math.ceil(data.length / PG));
  dPage = Math.min(dPage, tp);
  const st = (dPage - 1) * PG;
  const pg = data.slice(st, st + PG);

  const tb = document.querySelector('#tblDampak tbody');
  tb.innerHTML = '';
  if (!pg.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:var(--sp-8);color:var(--text-muted)">Tidak ada data ditemukan</td></tr>';
  } else {
    pg.forEach((r) => {
      tb.innerHTML += `<tr>
        <td><span class="badge badge-blue">${r.bagian || '—'}</span></td>
        <td>${provBadge(r.provinsi)}</td>
        <td>${r.kabupaten || '—'}</td>
        <td style="max-width:280px">${r.dampak || '—'}</td>
        <td class="num">${fmtN(r.jumlah)}</td>
        <td>${r.satuan || '—'}</td>
      </tr>`;
    });
  }

  document.getElementById('dampakInfo').textContent = `Menampilkan ${st + 1}–${Math.min(st + PG, data.length)} dari ${data.length} data`;
  mkPaging('dampakPag', dPage, tp, (p) => {
    dPage = p;
    renderDampakTable();
  });
}

// ==========================================
// ANGGARAN
// ==========================================
function renderAnggaranKPIs() {
  let reg = { aceh: 0, sumut: 0, sumbar: 0 },
    tam = { aceh: 0, sumut: 0, sumbar: 0 };
  D.rencanaKegiatan.forEach((r) => {
    reg.aceh += r.reg_aceh_rp || 0;
    reg.sumut += r.reg_sumut_rp || 0;
    reg.sumbar += r.reg_sumbar_rp || 0;
    tam.aceh += r.tam_aceh_rp || 0;
    tam.sumut += r.tam_sumut_rp || 0;
    tam.sumbar += r.tam_sumbar_rp || 0;
  });
  const toM = (v) => +((v * 1000) / 1e9).toFixed(2);
  const tR = toM(reg.aceh + reg.sumut + reg.sumbar);
  const tT = toM(tam.aceh + tam.sumut + tam.sumbar);
  document.getElementById('k-reg').textContent = tR + ' M';
  document.getElementById('k-tam').textContent = tT + ' M';
  document.getElementById('k-gab').textContent = (tR + tT).toFixed(2) + ' M';
}

function renderAnggaranCharts() {
  let reg = { aceh: 0, sumut: 0, sumbar: 0 },
    tam = { aceh: 0, sumut: 0, sumbar: 0 };
  D.rencanaKegiatan.forEach((r) => {
    reg.aceh += r.reg_aceh_rp || 0;
    reg.sumut += r.reg_sumut_rp || 0;
    reg.sumbar += r.reg_sumbar_rp || 0;
    tam.aceh += r.tam_aceh_rp || 0;
    tam.sumut += r.tam_sumut_rp || 0;
    tam.sumbar += r.tam_sumbar_rp || 0;
  });
  const toM = (v) => +((v * 1000) / 1e9).toFixed(2);

  mkChart(
    'chAPBN',
    'bar',
    {
      labels: ['Aceh', 'Sumatera Utara', 'Sumatera Barat'],
      datasets: [
        { label: 'APBN Reguler', data: [toM(reg.aceh), toM(reg.sumut), toM(reg.sumbar)], backgroundColor: C.blue + 'CC', borderColor: C.blue, borderWidth: 1 },
        { label: 'APBN Tambahan', data: [toM(tam.aceh), toM(tam.sumut), toM(tam.sumbar)], backgroundColor: C.gold + 'CC', borderColor: C.gold, borderWidth: 1 },
      ],
    },
    { scales: { x: { grid: { display: false } }, y: { grid: { color: '#EDF2F7' }, title: { display: true, text: 'Miliar Rupiah', font: { size: 11 } } } } },
  );

  // Tren
  const yrs = ['2026', '2027', '2028'];
  const tren = { aceh: [], sumut: [], sumbar: [] };
  for (const y of yrs) {
    let a = 0,
      u = 0,
      b = 0;
    D.highlightRekap.forEach((r) => {
      a += r[`t${y}_aceh_rp`] || 0;
      u += r[`t${y}_sumut_rp`] || 0;
      b += r[`t${y}_sumbar_rp`] || 0;
    });
    tren.aceh.push(+((a * 1000) / 1e9).toFixed(2));
    tren.sumut.push(+((u * 1000) / 1e9).toFixed(2));
    tren.sumbar.push(+((b * 1000) / 1e9).toFixed(2));
  }

  mkChart(
    'chTren',
    'line',
    {
      labels: yrs,
      datasets: [
        { label: 'Aceh', data: tren.aceh, borderColor: C.aceh, backgroundColor: C.aceh + '22', fill: true, tension: 0.3, pointRadius: 5 },
        { label: 'Sumatera Utara', data: tren.sumut, borderColor: C.sumut, backgroundColor: C.sumut + '22', fill: true, tension: 0.3, pointRadius: 5 },
        { label: 'Sumatera Barat', data: tren.sumbar, borderColor: C.sumbar, backgroundColor: C.sumbar + '22', fill: true, tension: 0.3, pointRadius: 5 },
      ],
    },
    { scales: { x: { grid: { display: false } }, y: { grid: { color: '#EDF2F7' }, title: { display: true, text: 'Miliar Rupiah', font: { size: 11 } } } } },
  );
}

function renderAnggaranTable() {
  const tb = document.querySelector('#tblAnggaran tbody');
  tb.innerHTML = '';
  let g26 = 0,
    g27 = 0,
    g28 = 0;

  D.highlightRekap.forEach((r, i) => {
    const t26 = r.t2026_total_rp || 0,
      t27 = r.t2027_total_rp || 0,
      t28 = r.t2028_total_rp || 0;
    g26 += t26;
    g27 += t27;
    g28 += t28;
    tb.innerHTML += `<tr>
      <td style="color:var(--text-light)">${i + 1}</td>
      <td style="max-width:300px">${r.program || '—'}</td>
      <td class="cur">${fmtRp(t26, true)}</td>
      <td class="cur">${fmtRp(t27, true)}</td>
      <td class="cur">${fmtRp(t28, true)}</td>
      <td class="cur bold">${fmtRp(t26 + t27 + t28, true)}</td>
    </tr>`;
  });

  tb.innerHTML += `<tr style="background:var(--bg-muted)">
    <td></td><td><strong>GRAND TOTAL</strong></td>
    <td class="cur bold">${fmtRp(g26, true)}</td><td class="cur bold">${fmtRp(g27, true)}</td>
    <td class="cur bold">${fmtRp(g28, true)}</td>
    <td class="cur bold" style="color:var(--kkp-blue-dark)">${fmtRp(g26 + g27 + g28, true)}</td>
  </tr>`;
}

// ==========================================
// CHART HELPER
// ==========================================
function mkChart(id, type, data, opts = {}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeOutQuart' },
    plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 12, font: { size: 12 } } } },
  };
  charts[id] = new Chart(ctx, { type, data, options: merge(base, opts) });
}

function merge(a, b) {
  const r = { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) r[k] = merge(r[k] || {}, b[k]);
    else r[k] = b[k];
  }
  return r;
}

// ==========================================
// PAGINATION HELPER
// ==========================================
function mkPaging(id, cur, total, cb) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  if (total <= 1) return;

  const btn = (txt, pg, active, dis) => {
    const b = document.createElement('button');
    b.className = 'pg-btn' + (active ? ' active' : '');
    b.textContent = txt;
    b.disabled = !!dis;
    if (!dis && !active) b.onclick = () => cb(pg);
    return b;
  };

  el.appendChild(btn('‹', cur - 1, false, cur <= 1));
  const maxV = 5;
  let s = Math.max(1, cur - Math.floor(maxV / 2));
  let e = Math.min(total, s + maxV - 1);
  if (e - s < maxV - 1) s = Math.max(1, e - maxV + 1);

  if (s > 1) {
    el.appendChild(btn(1, 1));
    if (s > 2) el.appendChild(btn('…', 0, false, true));
  }
  for (let p = s; p <= e; p++) el.appendChild(btn(p, p, p === cur));
  if (e < total) {
    if (e < total - 1) el.appendChild(btn('…', 0, false, true));
    el.appendChild(btn(total, total));
  }
  el.appendChild(btn('›', cur + 1, false, cur >= total));
}
