# -*- coding: utf-8 -*-
"""
Gabungkan data penerima bantuan dari assets/geo menjadi satu berkas ringkas
yang siap dibaca dashboard: assets/geo/penerima.json

Sumbernya tiga berkas dengan skema berbeda:
  - ACEH_FIX_USED.csv   (CSV, nama kolom panjang)
  - Json_Sumbar.geojson (GeoJSON MultiPoint, kolom dipotong 10 huruf oleh QGIS)
  - Json_Sumut.geojson  (GeoJSON Point)

Jalankan ulang setiap kali berkas sumbernya diperbarui:
    python tools/build-penerima.py
"""
import csv
import io
import json
import os
import re
from collections import Counter

BASE = os.path.join(os.path.dirname(__file__), '..', 'assets', 'geo')
KELUARAN = os.path.join(BASE, 'penerima.json')

# Kotak batas Sumatera bagian utara; dipakai untuk memvalidasi dan memperbaiki koordinat.
LAT_MIN, LAT_MAKS = -3.0, 6.5
LNG_MIN, LNG_MAKS = 94.5, 101.5


def angka(v):
    s = re.sub(r'[^0-9.\-]', '', str(v if v is not None else ''))
    if s in ('', '-', '.'):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def dalam_kotak(la, lo):
    return LAT_MIN <= la <= LAT_MAKS and LNG_MIN <= lo <= LNG_MAKS


def perbaiki_koordinat(la, lo):
    """
    Sebagian baris kehilangan titik desimalnya (mis. lat 3047075 untuk 3.047075,
    lng 97131078 untuk 97.131078) - khas hasil ekspor spreadsheet. Nilai dibagi
    10 berulang kali sampai PASANGANNYA masuk kotak batas Sumatera. Berhenti di
    "asal < 200" tidak cukup: 3047075 akan berhenti di 30.47075 yang masih salah.
    """
    if la is None or lo is None:
        return None
    if dalam_kotak(la, lo):
        return (la, lo)

    def kandidat(v):
        hasil, x = [], abs(v)
        tanda = -1 if v < 0 else 1
        for _ in range(10):
            hasil.append(tanda * x)
            x /= 10.0
        return hasil

    for a in kandidat(la):
        for b in kandidat(lo):
            if dalam_kotak(a, b):
                return (a, b)
    return None


def bersih(v):
    """Rapikan teks: buang spasi ganda, tanda derajat, dan penanda kosong."""
    s = str(v if v is not None else '').replace('°', '').replace('�', '')
    s = re.sub(r'\s+', ' ', s).strip()
    return '' if s.lower() in ('', '-', 'none', 'nan', 'null') else s


def judul(s):
    """Samakan kapitalisasi supaya filter tidak pecah jadi banyak nilai."""
    return ' '.join(w.capitalize() if w.islower() or w.isupper() else w for w in s.split())


def normal_kerusakan(v):
    """'Rusak Sedang', 'sedang', 'Sedang' -> satu nilai."""
    s = bersih(v).lower()
    if not s:
        return ''
    if 'berat' in s:
        return 'Berat'
    if 'sedang' in s:
        return 'Sedang'
    if 'ringan' in s:
        return 'Ringan'
    return judul(bersih(v))


def normal_status(v):
    """Rapikan 'Belum DItangani', 'Belum ada penanganan', dll."""
    s = bersih(v).lower()
    if not s:
        return ''
    if 'sudah' in s or 'ditangani sementara' in s:
        return 'Sudah ditangani'
    if 'belum' in s:
        return 'Belum ditangani'
    return judul(bersih(v))


def normal_provinsi(v):
    s = bersih(v).lower()
    if s.startswith('sumbar') or 'sumatera barat' in s:
        return 'Sumatera Barat'
    if s.startswith('sumut') or 'sumatera utara' in s:
        return 'Sumatera Utara'
    if 'aceh' in s:
        return 'Aceh'
    return judul(bersih(v))


def normal_kab(v):
    s = bersih(v)
    s = re.sub(r'^(Kab\.?|Kabupaten)\s+', '', s, flags=re.I)
    return judul(s)


statistik = Counter()


def catat(rec, la, lo):
    """Simpan satu titik bila koordinatnya sah; kembalikan True kalau dipakai."""
    baik = perbaiki_koordinat(la, lo)
    if not baik:
        statistik['koordinat tidak sah'] += 1
        return None
    if not dalam_kotak(la if la else 0, lo if lo else 0):
        statistik['koordinat diperbaiki'] += 1
    rec['lat'] = round(baik[0], 6)
    rec['lng'] = round(baik[1], 6)
    # NIK sengaja TIDAK disertakan - lihat catatan di bawah berkas ini.
    return rec


hasil = []

# ---------------------------------------------------------------- Aceh (CSV)
with io.open(os.path.join(BASE, 'ACEH_FIX_USED.csv'), encoding='utf-8', errors='replace') as f:
    for r in csv.DictReader(f):
        rec = {
            'prov': normal_provinsi(r.get('Provinsi')),
            'kab': normal_kab(r.get('Kabupaten/Kota')),
            'kec': judul(bersih(r.get('Kecamatan'))),
            'desa': judul(bersih(r.get('Desa/Kelurahan'))),
            'fasilitas': bersih(r.get('Nama Fasilitas Perikanan terdampak')),
            'nama': bersih(r.get('Nama')),
            'alamat': bersih(r.get('Alamat')),
            'jenis': bersih(r.get('Jenis Sarana/Prasarana Terdampak')),
            'jumlah': bersih(r.get('Jumlah')),
            'satuan': bersih(r.get('Satuan')),
            'kerusakan': normal_kerusakan(r.get('Tingkat Kerusakan')),
            'status': normal_status(r.get('Status Penanganan')),
            'wewenang': judul(bersih(r.get('Tingkat Kewenangan'))),
            'foto': bersih(r.get('Foto pascabencana')),
        }
        p = catat(rec, angka(r.get('Latitude')), angka(r.get('Longitude')))
        if p:
            hasil.append(p)
            statistik['Aceh'] += 1

# ------------------------------------------------------------ Sumbar & Sumut
GEO = [
    ('Json_Sumbar.geojson', 'Lat_baru', 'Long_baru', 'Jumlah_ker'),
    ('Json_Sumut.geojson', 'Latitude', 'Longitude', 'Jumlah'),
]

for berkas, latk, lngk, jumk in GEO:
    with io.open(os.path.join(BASE, berkas), encoding='utf-8') as f:
        fitur = json.load(f).get('features', [])

    for x in fitur:
        p = x.get('properties') or {}
        la, lo = angka(p.get(latk)), angka(p.get(lngk))

        # Cadangan: ambil dari geometry bila kolom lat/lng kosong.
        if (la is None or lo is None) and x.get('geometry'):
            g = x['geometry']
            koor = g.get('coordinates')
            if g.get('type') == 'MultiPoint' and koor:
                koor = koor[0]
            if isinstance(koor, (list, tuple)) and len(koor) >= 2:
                lo, la = angka(koor[0]), angka(koor[1])

        rec = {
            'prov': normal_provinsi(p.get('Provinsi')),
            'kab': normal_kab(p.get('Kabupaten_')),
            'kec': judul(bersih(p.get('Kecamatan'))),
            'desa': judul(bersih(p.get('Desa_Kelur'))),
            'fasilitas': bersih(p.get('Nama_Fasil')),
            'nama': bersih(p.get('Nama')),
            'alamat': bersih(p.get('Alamat')),
            'jenis': bersih(p.get('Jenis_Sara')),
            'jumlah': bersih(p.get(jumk)),
            'satuan': bersih(p.get('Satuan')),
            'kerusakan': normal_kerusakan(p.get('Tingkat_Ke')),
            'status': normal_status(p.get('Status_Pen')),
            'wewenang': judul(bersih(p.get('Tingkat__1'))),
            'foto': bersih(p.get('Foto_pasca')),
        }
        rr = catat(rec, la, lo)
        if rr:
            hasil.append(rr)
            statistik[rr['prov'] or berkas] += 1

# ---------------------------------------------------------------- pemadatan
# Sebagai JSON biasa berkasnya >5 MB - terlalu berat untuk dimuat di browser.
# Nilainya sangat berulang (satu orang punya banyak baris, satu tautan foto
# dipakai bersama), jadi tiap kolom teks disimpan sekali di "kamus" dan barisnya
# hanya menyimpan nomor indeks. Ukurannya turun drastis tanpa kehilangan data.
KOLOM = ['prov', 'kab', 'kec', 'desa', 'fasilitas', 'nama', 'alamat',
         'jenis', 'jumlah', 'satuan', 'kerusakan', 'status', 'wewenang', 'foto']

kamus = {k: [] for k in KOLOM}
indeks = {k: {} for k in KOLOM}


def kode(kolom, nilai):
    """Nomor indeks nilai pada kamus kolom; -1 untuk nilai kosong."""
    if nilai == '':
        return -1
    peta = indeks[kolom]
    if nilai not in peta:
        peta[nilai] = len(kamus[kolom])
        kamus[kolom].append(nilai)
    return peta[nilai]


baris = [[kode(k, r.get(k, '')) for k in KOLOM] + [r['lat'], r['lng']] for r in hasil]

with io.open(KELUARAN, 'w', encoding='utf-8') as f:
    json.dump({
        'jumlah': len(baris),
        'kolom': KOLOM,          # urutan kolom pada tiap baris; dua terakhir lat, lng
        'kamus': kamus,
        'data': baris,
    }, f, ensure_ascii=False, separators=(',', ':'))

ukuran = os.path.getsize(KELUARAN) / 1024 / 1024
print('penerima.json  : %d titik, %.2f MB' % (len(hasil), ukuran))
for k, v in sorted(statistik.items()):
    print('  %-22s %d' % (k, v))

# Catatan privasi: kolom NIK ada di ketiga sumber tetapi TIDAK ikut ditulis
# ke penerima.json. Berkas ini disajikan ke publik lewat dashboard, dan NIK
# adalah identitas kependudukan yang tidak boleh tersebar.
