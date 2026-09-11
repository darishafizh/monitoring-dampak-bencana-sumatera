# -*- coding: utf-8 -*-
"""
Gabungkan data penerima bantuan dari assets/geo menjadi satu berkas ringkas
yang siap dibaca dashboard: assets/geo/penerima.json

Sumbernya tiga GeoJSON hasil ekspor QGIS dengan penamaan kolom berbeda:
  - Json_Aceh.geojson   nama kolom panjang & apa adanya ("Kabupaten/Kota")
  - Json_Sumbar.geojson nama kolom dipotong 10 huruf     ("Kabupaten_")
  - Json_Sumut.geojson  dipotong juga, tapi sebagian kolom beda dari Sumbar

Perbedaan itu ditangani lewat daftar SUMBER di bawah: tiap kolom keluaran
punya beberapa nama kandidat, dipakai yang pertama ditemukan.

Jalankan ulang setiap kali berkas sumbernya diperbarui:
    python tools/build-penerima.py
"""
import io
import json
import os
import re
from collections import Counter

BASE = os.path.join(os.path.dirname(__file__), '..', 'assets', 'geo')
KELUARAN = os.path.join(BASE, 'penerima.json')

# Kotak batas Sumatera bagian utara; dipakai memvalidasi dan memperbaiki koordinat.
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
    return (la is not None and lo is not None
            and LAT_MIN <= la <= LAT_MAKS and LNG_MIN <= lo <= LNG_MAKS)


def perbaiki_koordinat(la, lo):
    """
    Kembalikan pasangan (lat, lng) yang masuk akal, atau None.

    Dua kerusakan yang ditemukan pada data survei:
    1. Titik desimal hilang - lat 3047075 untuk 3.047075, lng 97131078 untuk
       97.131078. Nilainya dibagi 10 sampai PASANGANNYA masuk kotak batas.
       Berhenti di "asal < 200" tidak cukup: 3047075 akan berhenti di 30.47075
       yang masih di luar Sumatera.
    2. Lintang dan bujur tertukar - lat 96.981478 dengan lng 5.247419.
    """
    if la is None or lo is None:
        return None
    if dalam_kotak(la, lo):
        return (la, lo)
    if dalam_kotak(lo, la):
        return (lo, la)

    def kandidat(v):
        out, x, tanda = [], abs(v), (-1 if v < 0 else 1)
        for _ in range(10):
            out.append(tanda * x)
            x /= 10.0
        return out

    for a in kandidat(la):
        for b in kandidat(lo):
            if dalam_kotak(a, b):
                return (a, b)
            if dalam_kotak(b, a):
                return (b, a)
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
    # "ringa" (1 baris) jelas salah ketik "ringan"; nilai lain seperti
    # "Hilang" atau "Tidak Terdampak" dibiarkan apa adanya karena memang
    # kategori tersendiri, bukan variasi penulisan.
    if 'ringan' in s or s == 'ringa':
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
    s = re.sub(r'^(Kab\.?|Kabupaten)\s+', '', bersih(v), flags=re.I)
    return judul(s)


# Nama kolom kandidat per kolom keluaran; dipakai yang pertama ditemukan.
# Menyatukan ketiga skema dalam satu tabel supaya penambahan provinsi baru
# cukup menambah nama kolomnya di sini, bukan menulis blok pembaca baru.
KANDIDAT = {
    'prov':      ['Provinsi'],
    'kab':       ['Kabupaten/Kota', 'Kabupaten_'],
    'kec':       ['Kecamatan'],
    'desa':      ['Desa/Kelurahan', 'Desa_Kelur'],
    'fasilitas': ['Nama Fasilitas Perikanan terdampak', 'Nama_Fasil'],
    'nama':      ['Nama'],
    'alamat':    ['Alamat'],
    'jenis':     ['Jenis Sarana/Prasarana Terdampak', 'Jenis_Sara'],
    'jumlah':    ['Jumlah', 'Jumlah_ker'],
    'satuan':    ['Satuan'],
    'kerusakan': ['Tingkat Kerusakan', 'Tingkat_Ke'],
    'status':    ['Status Penanganan', 'Status_Pen'],
    'wewenang':  ['Tingkat Kewenangan', 'Tingkat__1'],
    'foto':      ['Foto pascabencana', 'Foto_pasca'],
}

# Kolom lintang/bujur; Sumbar punya kolom "_baru" hasil pembersihan di QGIS
# yang lebih bersih daripada kolom aslinya (yang masih memuat tanda derajat).
KANDIDAT_LAT = ['Lat_baru', 'Latitude']
KANDIDAT_LNG = ['Long_baru', 'Longitude']

NORMALISATOR = {
    'prov': normal_provinsi,
    'kab': normal_kab,
    'kec': lambda v: judul(bersih(v)),
    'desa': lambda v: judul(bersih(v)),
    'kerusakan': normal_kerusakan,
    'status': normal_status,
    'wewenang': lambda v: judul(bersih(v)),
}

SUMBER = ['Json_Aceh.geojson', 'Json_Sumbar.geojson', 'Json_Sumut.geojson']

statistik = Counter()
hasil = []


def ambil(props, nama_kandidat):
    for n in nama_kandidat:
        if n in props and props[n] is not None:
            return props[n]
    return ''


for berkas in SUMBER:
    jalur = os.path.join(BASE, berkas)
    if not os.path.exists(jalur):
        print('  ! lewati (tidak ada): ' + berkas)
        continue

    with io.open(jalur, encoding='utf-8') as f:
        fitur = json.load(f).get('features', [])

    for x in fitur:
        p = x.get('properties') or {}

        la = angka(ambil(p, KANDIDAT_LAT))
        lo = angka(ambil(p, KANDIDAT_LNG))

        # Cadangan: koordinat dari geometry bila kolomnya kosong atau rusak.
        if not dalam_kotak(la, lo):
            g = x.get('geometry') or {}
            koor = g.get('coordinates')
            if g.get('type') == 'MultiPoint' and koor:
                koor = koor[0]
            if isinstance(koor, (list, tuple)) and len(koor) >= 2:
                gla, glo = angka(koor[1]), angka(koor[0])
                if dalam_kotak(gla, glo):
                    statistik['koordinat diambil dari geometry'] += 1
                    la, lo = gla, glo

        baik = perbaiki_koordinat(la, lo)
        if not baik:
            statistik['dibuang: koordinat tidak sah'] += 1
            continue
        if not dalam_kotak(la, lo):
            statistik['koordinat diperbaiki'] += 1

        rec = {}
        for kunci, nama_kandidat in KANDIDAT.items():
            mentah = ambil(p, nama_kandidat)
            rec[kunci] = NORMALISATOR.get(kunci, bersih)(mentah)
        rec['lat'] = round(baik[0], 6)
        rec['lng'] = round(baik[1], 6)
        # NIK ada di ketiga sumber tetapi SENGAJA tidak disertakan - lihat
        # catatan privasi di akhir berkas ini.

        hasil.append(rec)
        statistik[rec['prov'] or berkas] += 1

# ---------------------------------------------------------------- pemadatan
# Sebagai JSON biasa berkasnya >5 MB - terlalu berat untuk dimuat di browser.
# Nilainya sangat berulang (satu orang punya banyak baris, satu tautan foto
# dipakai bersama), jadi tiap kolom teks disimpan sekali di "kamus" dan barisnya
# hanya menyimpan nomor indeks. Ukurannya turun drastis tanpa kehilangan data.
KOLOM = list(KANDIDAT.keys())

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
print('penerima.json  : %d titik, %.2f MB' % (len(baris), ukuran))
for k, v in sorted(statistik.items()):
    print('  %-32s %d' % (k, v))

# Catatan privasi: kolom NIK ada di ketiga sumber tetapi TIDAK ikut ditulis ke
# penerima.json. Berkas ini disajikan ke publik lewat dashboard, dan NIK adalah
# identitas kependudukan yang tidak boleh tersebar.
