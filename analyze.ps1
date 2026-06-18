Import-Module ImportExcel
$excelPath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$d = Import-Excel $excelPath -WorksheetName "Matriks Aksi" -NoHeader
$b = Import-Excel $excelPath -WorksheetName "Matriks Bappenas" -NoHeader

Write-Host "Aksi rows: " $d.Count
Write-Host "Bappenas rows: " $b.Count

# Check for 2029 in Aksi
$has2029 = $false
foreach ($row in $d) {
    foreach ($prop in $row.psobject.properties) {
        if ($prop.Value -match "2029") {
            $has2029 = $true
            Write-Host "Found 2029 in row:" $row.P1 "Col:" $prop.Name
            break
        }
    }
    if ($has2029) { break }
}
if (-not $has2029) { Write-Host "No 2029 found in Matriks Aksi" }
