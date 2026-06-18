Import-Module ImportExcel
$excelPath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$sheetData = Import-Excel -Path $excelPath -WorksheetName "Highlight rekap" -NoHeader
$sheetData | Select-Object -First 15 | ConvertTo-Json -Depth 3
