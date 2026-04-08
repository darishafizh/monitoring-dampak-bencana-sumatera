import pandas as pd
import json

BASE = r'c:\Users\daris\OneDrive\Documents\Magang Biro Perencanaan KKP\dashboard_bencana_sumatera_v2'

print("=== RENCANA INDUK: Sheet Names ===")
xl = pd.ExcelFile(BASE + r'\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_Final.xlsx')
print('Sheets:', xl.sheet_names)

for s in xl.sheet_names:
    df = xl.parse(s, header=None, nrows=8)
    print(f'\n--- Sheet: {s} ---')
    for i, row in df.iterrows():
        vals = [str(v) for v in row.tolist() if str(v) != 'nan']
        print(f'  Row {i}: {vals}')

print("\n\n=== BNBA: Sheet Names ===")
xl2 = pd.ExcelFile(BASE + r'\Rekap data BNBA.xlsx')
print('BNBA Sheets:', xl2.sheet_names)

for s in xl2.sheet_names[:3]:
    df2 = xl2.parse(s, header=None, nrows=6)
    print(f'\n--- BNBA Sheet: {s} ---')
    for i, row in df2.iterrows():
        vals = [str(v) for v in row.tolist() if str(v) != 'nan']
        print(f'  Row {i}: {vals}')
