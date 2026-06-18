Import-Module ImportExcel
$excelPath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"

$data1 = Import-Excel $excelPath -WorksheetName "Matriks Bappenas" -NoHeader
$data1 | Select-Object -First 15 | ConvertTo-Csv -NoTypeInformation > c:\development\bencana_sumatera\preview_matriks_bappenas.csv

$data2 = Import-Excel $excelPath -WorksheetName "Matriks Aksi" -NoHeader
$data2 | Select-Object -First 15 | ConvertTo-Csv -NoTypeInformation > c:\development\bencana_sumatera\preview_matriks_aksi.csv
