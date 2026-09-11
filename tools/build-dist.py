# -*- coding: utf-8 -*-
"""
Susun folder dist/ yang siap diunggah ke hosting statis.

Dibuat setelah dist/ sempat tertinggal dari root: HTML-nya versi baru
(class="brand") sementara style.css-nya masih versi lama yang belum punya
aturan itu, sehingga logo tampil sebesar ukuran aslinya. Menyalin berkas satu
per satu secara manual terlalu mudah terlewat - pakai skrip ini.

    python tools/build-dist.py
"""
import io
import os
import shutil

AKAR = os.path.join(os.path.dirname(__file__), '..')
DIST = os.path.join(AKAR, 'dist')

# Berkas yang ikut diunggah. Yang TIDAK ikut: berkas sumber di assets/geo
# (CSV/GeoJSON mentah, ~6 MB), skrip .ps1, arsip .xlsx, dan folder .claude.
BERKAS = [
    'index.html',
    'style.css',
    'script.js',
    'config.js',
    'sheets.js',
    'data-snapshot.js',
    'logo-kkp.png',
    'favicon.png',
]

# Data penerima bantuan hasil tools/build-penerima.py
ASET = [
    ('assets/geo/penerima.json', 'assets/geo/penerima.json'),
]

if os.path.isdir(DIST):
    shutil.rmtree(DIST)
os.makedirs(DIST)

for nama in BERKAS:
    asal = os.path.join(AKAR, nama)
    if not os.path.exists(asal):
        raise SystemExit('Berkas wajib tidak ditemukan: ' + nama)
    shutil.copy2(asal, os.path.join(DIST, nama))

for asal_rel, tujuan_rel in ASET:
    asal = os.path.join(AKAR, asal_rel)
    if not os.path.exists(asal):
        print('  ! lewati (belum dibuat): ' + asal_rel)
        continue
    tujuan = os.path.join(DIST, tujuan_rel)
    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
    shutil.copy2(asal, tujuan)

# Cache dinaikkan khusus untuk produksi: menekan jumlah permintaan ke Google
# agar tidak kena rate limit saat pengunjung ramai. Tombol "Muat ulang" tetap
# mengambil data terbaru seketika, jadi editor spreadsheet tidak perlu menunggu.
konfig = os.path.join(DIST, 'config.js')
isi = io.open(konfig, encoding='utf-8').read()
if '    CACHE_MINUTES: 5' not in isi:
    raise SystemExit('Pola CACHE_MINUTES tidak ditemukan di config.js')
io.open(konfig, 'w', encoding='utf-8', newline='').write(
    isi.replace('    CACHE_MINUTES: 5', '    CACHE_MINUTES: 15'))

total = 0
for akar, _, berkas in os.walk(DIST):
    for b in berkas:
        total += os.path.getsize(os.path.join(akar, b))

print('dist/ siap unggah: %d berkas, %.2f MB' % (
    sum(len(f) for _, _, f in os.walk(DIST)), total / 1024 / 1024))
for akar, _, berkas in os.walk(DIST):
    for b in sorted(berkas):
        p = os.path.join(akar, b)
        print('  %-34s %7.1f KB' % (os.path.relpath(p, DIST).replace('\\', '/'),
                                    os.path.getsize(p) / 1024))
