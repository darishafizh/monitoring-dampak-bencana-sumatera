import pandas as pd
import json

BASE = r'c:\Users\daris\OneDrive\Documents\Magang Biro Perencanaan KKP\dashboard_bencana_sumatera_v2'

result = {}

# ===== Rencana Induk =====
xl = pd.ExcelFile(BASE + r'\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_Final.xlsx')
result['rencana_sheets'] = xl.sheet_names

for s in xl.sheet_names:
    # Try to read with header detection
    df_raw = xl.parse(s, header=None, nrows=20)
    rows_raw = []
    for i, row in df_raw.iterrows():
        r = [str(v) for v in row.tolist()]
        rows_raw.append(r)
    result[f'rencana_raw_{s}'] = rows_raw

# ===== BNBA =====
xl2 = pd.ExcelFile(BASE + r'\Rekap data BNBA.xlsx')
result['bnba_sheets'] = xl2.sheet_names

for s in xl2.sheet_names:
    df_raw = xl2.parse(s, header=None, nrows=20)
    rows_raw = []
    for i, row in df_raw.iterrows():
        r = [str(v) for v in row.tolist()]
        rows_raw.append(r)
    result[f'bnba_raw_{s}'] = rows_raw

# Save to smaller individual files
for key, val in result.items():
    if key.startswith('rencana_raw_') or key.startswith('bnba_raw_'):
        fname = key.replace(' ', '_').replace('/', '_')
        with open(BASE + f'\\preview_{fname}.json', 'w', encoding='utf-8') as f:
            json.dump(val, f, ensure_ascii=False, indent=2)

# Save sheet names
with open(BASE + r'\preview_sheets.json', 'w', encoding='utf-8') as f:
    json.dump({'rencana': result['rencana_sheets'], 'bnba': result['bnba_sheets']}, f, ensure_ascii=False, indent=2)

print("Done!")
print("Rencana sheets:", result['rencana_sheets'])
print("BNBA sheets:", result['bnba_sheets'])
