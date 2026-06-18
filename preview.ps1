Import-Module ImportExcel
$excelPath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$data = Import-Excel $excelPath -WorksheetName "Rencana Kegiatan" -NoHeader
$data | Select-Object -First 15 | ConvertTo-Csv -NoTypeInformation > c:\development\bencana_sumatera\preview_rencana.csv
