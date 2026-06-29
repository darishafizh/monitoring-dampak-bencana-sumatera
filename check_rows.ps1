Import-Module ImportExcel

$filePath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$sheetName = "Matriks Bappenas"

$package = Open-ExcelPackage -Path $filePath
$ws = $package.Workbook.Worksheets[$sheetName]

# Check rows 75-110
Write-Host "=== ROWS 75-110 ==="
for ($r = 75; $r -le 110; $r++) {
    $hasData = $false
    $rowStr = "Row $r : "
    for ($c = 1; $c -le 21; $c++) {
        $val = $ws.Cells[$r, $c].Text.Trim()
        if ($val -ne "") {
            $hasData = $true
            $short = if ($val.Length -gt 60) { $val.Substring(0,60) + "..." } else { $val }
            $rowStr += "C${c}=[${short}] | "
        }
    }
    if ($hasData) {
        Write-Host $rowStr
    }
}

Close-ExcelPackage $package -NoSave
