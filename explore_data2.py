import pandas as pd
import json

BASE = r'c:\Users\daris\OneDrive\Documents\Magang Biro Perencanaan KKP\dashboard_bencana_sumatera_v2'
result = {}

# ============================
# RENCANA INDUK
# ============================
print("Reading Rencana Induk...")
xl = pd.ExcelFile(BASE + r'\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_Final.xlsx')
result['rencana_sheets'] = xl.sheet_names

rencana_preview = {}
for s in xl.sheet_names:
    df = xl.parse(s, header=None, nrows=12)
    rows = []
    for i, row in df.iterrows():
        vals = [str(v) for v in row.tolist()]
        rows.append(vals)
    rencana_preview[s] = rows

result['rencana_preview'] = rencana_preview

# ============================
# BNBA
# ============================
print("Reading BNBA...")
xl2 = pd.ExcelFile(BASE + r'\Rekap data BNBA.xlsx')
result['bnba_sheets'] = xl2.sheet_names

bnba_preview = {}
for s in xl2.sheet_names[:5]:
    df2 = xl2.parse(s, header=None, nrows=8)
    rows = []
    for i, row in df2.iterrows():
        vals = [str(v) for v in row.tolist()]
        rows.append(vals)
    bnba_preview[s] = rows

result['bnba_preview'] = bnba_preview

# Save JSON
with open(BASE + r'\data_preview.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("Done! Saved to data_preview.json")
print("Rencana sheets:", xl.sheet_names)
print("BNBA sheets:", xl2.sheet_names)
