Import-Module ImportExcel
$pkg = Open-ExcelPackage 'Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx'
$ws = $pkg.Workbook.Worksheets['Matriks Bappenas']
$count = 0
for($r=7; $r -le 200; $r++){
    $col6 = $ws.Cells[$r, 6].Text.Trim()
    if($col6 -ne ""){
        $count++
        Write-Host "Data Row ${count} (Excel Row ${r}): ${col6}"
    }
}
Close-ExcelPackage $pkg -NoSave
