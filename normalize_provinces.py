import json
from datetime import datetime

# Read seed-data.js
with open('seed-data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse data
js = content.split('const seedData = ')[1].rstrip(';\n')
data = json.loads(js)

# Normalize province names
def normalize_province(name):
    name = name.strip()
    if 'Aceh' in name:
        return 'Aceh'
    elif 'Sumatera Utara' in name or 'Sumut' in name:
        return 'Sumatera Utara'
    elif 'Sumatera Barat' in name or 'Sumbar' in name:
        return 'Sumatera Barat'
    return name

# Update data
for entry in data:
    entry['provinsi'] = normalize_province(entry['provinsi'])

# Write back
with open('seed-data.js', 'w', encoding='utf-8') as f:
    f.write('// Seed data untuk Dashboard Monitoring Dampak Bencana Sumatera\n')
    f.write('// Generated from PDF: KEMENTERIAN KELAUTAN DAN PERIKANAN rekap (1).pdf\n')
    f.write(f'// Updated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n')
    f.write('// Provinces normalized to: Aceh, Sumatera Utara, Sumatera Barat\n\n')
    f.write('const seedData = ')
    f.write(json.dumps(data, ensure_ascii=False, indent=4))
    f.write(';\n')

# Verify
provs = set(e['provinsi'] for e in data)
print('=== Provinces after normalization ===')
for p in sorted(provs):
    print(f'  - {p}')
print(f'\nTotal: {len(provs)} provinces (should be 3)')
