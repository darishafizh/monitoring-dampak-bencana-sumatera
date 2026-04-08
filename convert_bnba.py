import pandas as pd
import json
import re

BASE = r'c:\Users\daris\OneDrive\Documents\Magang Biro Perencanaan KKP\dashboard_bencana_sumatera_v2'

def clean_str(v):
    if v is None or (isinstance(v, float) and str(v) == 'nan'):
        return ''
    return str(v).strip()

def clean_num(v):
    if v is None or (isinstance(v, float) and str(v) == 'nan'):
        return 0
    try:
        return float(v)
    except:
        return 0

# ============================================================
# 1. BACA BNBA DJPK (Petambak Garam)
# ============================================================
print("Reading BNBA DJPK...")
xl_bnba = pd.ExcelFile(BASE + r'\Rekap data BNBA.xlsx')

# DJPK - header di baris ke-7 (index 6)
df_djpk = xl_bnba.parse('DJPK', header=6)
print(f"DJPK total rows: {len(df_djpk)}")
print(f"DJPK columns: {df_djpk.columns.tolist()}")

djpk_data = []
for _, row in df_djpk.iterrows():
    no = clean_str(row.iloc[0]) if pd.notna(row.iloc[0]) else ''
    prov = clean_str(row.iloc[1]) if pd.notna(row.iloc[1]) else ''
    # Skip rows yang tidak ada No atau Propinsi
    if not prov or (not no and not prov):
        continue
    
    item = {
        'no': clean_str(row.iloc[0]),
        'provinsi': clean_str(row.iloc[1]),
        'kab_kota': clean_str(row.iloc[2]),
        'kecamatan': clean_str(row.iloc[3]),
        'desa': clean_str(row.iloc[4]),
        'kelompok': clean_str(row.iloc[5]),
        'nama': clean_str(row.iloc[6]),
        'nik': clean_str(row.iloc[7]),
        'jk': clean_str(row.iloc[8]),
        'luas_lahan': clean_num(row.iloc[9]),
        'metode_produksi': clean_str(row.iloc[10]),
        'nilai_kerusakan': clean_num(row.iloc[11]),
        'ket': clean_str(row.iloc[12]) if len(row) > 12 else '',
        'jenis': 'garam'
    }
    djpk_data.append(item)

print(f"DJPK valid records: {len(djpk_data)}")

# ============================================================
# 2. BACA BNBA PDS (Pelaku Usaha Perikanan)
# ============================================================
print("\nReading BNBA PDS sheets...")

pds_all = []

for sheet_name in ['PDS ACEH', 'PDS SUMUT', 'PDS SUMBAR']:
    print(f"  Reading {sheet_name}...")
    
    # Baca raw untuk cee struktur
    df_raw = xl_bnba.parse(sheet_name, header=None)
    
    # Row 0 = header utama, Row 1 = sub-header (tingkat kerusakan)
    # Data mulai dari baris 2
    header_row = df_raw.iloc[0].tolist()
    sub_header = df_raw.iloc[1].tolist()
    
    # Cari kolom tingkat kerusakan
    # Header utama kolom 15 = 'Tingkat Kerusakan', subheader cols 15-18 = RR, RS, RB, H
    # Kita mapping manual berdasarkan struktur yang sudah kita baca
    
    df_data = df_raw.iloc[2:].reset_index(drop=True)
    df_data.columns = range(len(df_data.columns))
    
    count = 0
    for _, row in df_data.iterrows():
        no = clean_str(row.get(0, ''))
        prov = clean_str(row.get(2, ''))
        nama = clean_str(row.get(10, ''))
        
        # Skip baris kosong
        if not prov and not nama:
            continue
        if not no and not nama:
            continue
        
        # Tingkat kerusakan: col 15=RR, 16=RS, 17=RB, 18=Hilang
        rr = 1 if clean_str(row.get(15, '')) in ['X', 'x', '√', 'v'] else 0
        rs = 1 if clean_str(row.get(16, '')) in ['X', 'x', '√', 'v'] else 0
        rb = 1 if clean_str(row.get(17, '')) in ['X', 'x', '√', 'v'] else 0
        hl = 1 if clean_str(row.get(18, '')) in ['X', 'x', '√', 'v'] else 0
        
        # Tentukan tingkat kerusakan
        if rb or hl:
            tingkat = 'Rusak Berat' if rb else 'Hilang'
        elif rs:
            tingkat = 'Rusak Sedang'
        elif rr:
            tingkat = 'Rusak Ringan'
        else:
            tingkat = '-'
        
        item = {
            'no': no,
            'id_wilayah': clean_str(row.get(1, '')),
            'provinsi': prov,
            'kab_kota': clean_str(row.get(4, '')),
            'kecamatan': clean_str(row.get(6, '')),
            'desa': clean_str(row.get(8, '')),
            'nama': nama,
            'nomor_kusuka': clean_str(row.get(11, '')),
            'fasilitas': clean_str(row.get(12, '')),
            'jumlah_kerusakan': clean_str(row.get(13, '')),
            'alamat': clean_str(row.get(14, '')),
            'tingkat_kerusakan': tingkat,
            'rusak_ringan': rr,
            'rusak_sedang': rs,
            'rusak_berat': rb,
            'hilang': hl,
            'status': clean_str(row.get(19, '')),
            'kewenangan': clean_str(row.get(20, '')),
            'longitude': clean_str(row.get(21, '')),
            'latitude': clean_str(row.get(22, '')),
            'foto': clean_str(row.get(23, '')),
            'jenis': 'perikanan',
            'sheet': sheet_name
        }
        pds_all.append(item)
        count += 1
    
    print(f"    {sheet_name}: {count} records")

print(f"Total PDS records: {len(pds_all)}")
print(f"Total DJPK records: {len(djpk_data)}")

# ============================================================
# 3. BACA RENCANA INDUK FINAL - update highlightRekap
# ============================================================
print("\nReading Rencana Induk Final (Highlight rekap)...")
xl_ri = pd.ExcelFile(BASE + r'\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_Final.xlsx')
print("Sheets:", xl_ri.sheet_names)

# Baca Highlight rekap sheet
df_hr = xl_ri.parse('Highlight rekap', header=None)
print("Highlight rekap shape:", df_hr.shape)

# Berdasarkan preview: row 1 adalah header program/tahun, row 3 adalah sub-sub header
# Data program mulai dari row 4
# Kolom: No | Program/Kegiatan | [Tahun 2026: Aceh(kab,unit,rp), Sumut(kab,unit,rp), Sumbar(kab,unit,rp), Total] | [Tahun 2027: sama] | [Tahun 2028: sama] | Total | ...

highlight_data = []
for i, row in df_hr.iterrows():
    no_val = row.iloc[0]
    prog_val = row.iloc[1]
    
    # Skip header rows dan rows tanpa nomor
    if pd.isna(no_val):
        continue
    
    try:
        no_int = int(float(no_val))
    except:
        continue
    
    if pd.isna(prog_val) or str(prog_val).strip() in ['Program/Kegiatan', 'nan', '']:
        continue
    
    def safe_num(v):
        try:
            if pd.isna(v): return 0
            return int(float(v))
        except:
            return 0
    
    item = {
        'no': no_int,
        'program': str(prog_val).strip(),
        't2026_aceh_kab': safe_num(row.iloc[2]),
        't2026_aceh_unit': safe_num(row.iloc[3]),
        't2026_aceh_rp': safe_num(row.iloc[4]),
        't2026_sumut_kab': safe_num(row.iloc[5]),
        't2026_sumut_unit': safe_num(row.iloc[6]),
        't2026_sumut_rp': safe_num(row.iloc[7]),
        't2026_sumbar_kab': safe_num(row.iloc[8]),
        't2026_sumbar_unit': safe_num(row.iloc[9]),
        't2026_sumbar_rp': safe_num(row.iloc[10]),
        't2026_total_kab': safe_num(row.iloc[11]),
        't2026_total_unit': safe_num(row.iloc[12]),
        't2026_total_rp': safe_num(row.iloc[13]),
        't2027_aceh_kab': safe_num(row.iloc[14]),
        't2027_aceh_unit': safe_num(row.iloc[15]),
        't2027_aceh_rp': safe_num(row.iloc[16]),
        't2027_sumut_kab': safe_num(row.iloc[17]),
        't2027_sumut_unit': safe_num(row.iloc[18]),
        't2027_sumut_rp': safe_num(row.iloc[19]),
        't2027_sumbar_kab': safe_num(row.iloc[20]),
        't2027_sumbar_unit': safe_num(row.iloc[21]),
        't2027_sumbar_rp': safe_num(row.iloc[22]),
        't2027_total_kab': safe_num(row.iloc[23]),
        't2027_total_unit': safe_num(row.iloc[24]),
        't2027_total_rp': safe_num(row.iloc[25]),
        't2028_aceh_kab': safe_num(row.iloc[26]),
        't2028_aceh_unit': safe_num(row.iloc[27]),
        't2028_aceh_rp': safe_num(row.iloc[28]),
        't2028_sumut_kab': safe_num(row.iloc[29]),
        't2028_sumut_unit': safe_num(row.iloc[30]),
        't2028_sumut_rp': safe_num(row.iloc[31]),
        't2028_sumbar_kab': safe_num(row.iloc[32]),
        't2028_sumbar_unit': safe_num(row.iloc[33]),
        't2028_sumbar_rp': safe_num(row.iloc[34]),
        't2028_total_kab': safe_num(row.iloc[35]),
        't2028_total_unit': safe_num(row.iloc[36]),
        't2028_total_rp': safe_num(row.iloc[37]),
    }
    highlight_data.append(item)

print(f"Highlight rekap valid rows: {len(highlight_data)}")
for h in highlight_data:
    print(f"  {h['no']}. {h['program'][:60]} - 2026 total: {h['t2026_total_rp']:,}")

# ============================================================
# 4. SIMPAN KE FILE JS
# ============================================================
print("\nGenerating BNBA data JS file...")

# Buat summary stats
total_pds = len(pds_all)
total_djpk = len(djpk_data)

# Ringkasan per provinsi PDS
prov_pds = {}
for item in pds_all:
    p = item['provinsi']
    if p not in prov_pds:
        prov_pds[p] = {'total':0,'rr':0,'rs':0,'rb':0,'hl':0}
    prov_pds[p]['total'] += 1
    prov_pds[p]['rr'] += item['rusak_ringan']
    prov_pds[p]['rs'] += item['rusak_sedang']
    prov_pds[p]['rb'] += item['rusak_berat']
    prov_pds[p]['hl'] += item['hilang']

# Ringkasan per provinsi DJPK
prov_djpk = {}
for item in djpk_data:
    p = item['provinsi']
    if p not in prov_djpk:
        prov_djpk[p] = {'total':0,'luas_total':0,'nilai_total':0}
    prov_djpk[p]['total'] += 1
    prov_djpk[p]['luas_total'] += item['luas_lahan']
    prov_djpk[p]['nilai_total'] += item['nilai_kerusakan']

print("PDS by provinsi:", {k: v['total'] for k,v in prov_pds.items()})
print("DJPK by provinsi:", {k: v['total'] for k,v in prov_djpk.items()})

# Tulis file JS BNBA
bnba_js = f"""// Auto-generated BNBA data from Excel
const BNBA_DATA = {{
  pds: {json.dumps(pds_all, ensure_ascii=False, indent=None)},
  djpk: {json.dumps(djpk_data, ensure_ascii=False, indent=None)},
  summary: {{
    total_pds: {total_pds},
    total_djpk: {total_djpk},
    total_penerima: {total_pds + total_djpk},
    prov_pds: {json.dumps(prov_pds, ensure_ascii=False)},
    prov_djpk: {json.dumps(prov_djpk, ensure_ascii=False)}
  }}
}};
"""

with open(BASE + r'\js\bnba_data.js', 'w', encoding='utf-8') as f:
    f.write(bnba_js)

print(f"Saved bnba_data.js ({len(bnba_js):,} bytes)")

# Update highlight rekap jika berhasil baca
if highlight_data:
    print(f"\nHighlight rekap updated: {len(highlight_data)} programs")
    print("New highlight data ready for data.js update")
    # Save new highlight to separate JSON for review
    with open(BASE + r'\new_highlight_rekap.json', 'w', encoding='utf-8') as f:
        json.dump(highlight_data, f, ensure_ascii=False, indent=2)

print("\nDone! Files generated:")
print(f"  - js/bnba_data.js ({total_pds + total_djpk} total penerima bantuan)")
