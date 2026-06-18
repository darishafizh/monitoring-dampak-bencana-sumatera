Import-Module ImportExcel
$excelPath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$sheetData = Import-Excel -Path $excelPath -WorksheetName "Highlight rekap" -NoHeader

$programs = @()

foreach ($row in $sheetData) {
    if ($row -and $row.P1 -match "^\d+$" -and $row.P2 -and $row.P2.Trim() -ne "") {
        $namaProgram = $row.P2.Trim()
        
        # Aceh
        $aceh2026 = if ($row.P5) { [double]$row.P5 } else { 0 }
        $aceh2027 = if ($row.P17) { [double]$row.P17 } else { 0 }
        $aceh2028 = if ($row.P29) { [double]$row.P29 } else { 0 }
        $acehTotal = ($aceh2026 + $aceh2027 + $aceh2028) * 1000
        
        # Sumut
        $sumut2026 = if ($row.P8) { [double]$row.P8 } else { 0 }
        $sumut2027 = if ($row.P20) { [double]$row.P20 } else { 0 }
        $sumut2028 = if ($row.P32) { [double]$row.P32 } else { 0 }
        $sumutTotal = ($sumut2026 + $sumut2027 + $sumut2028) * 1000
        
        # Sumbar
        $sumbar2026 = if ($row.P11) { [double]$row.P11 } else { 0 }
        $sumbar2027 = if ($row.P23) { [double]$row.P23 } else { 0 }
        $sumbar2028 = if ($row.P35) { [double]$row.P35 } else { 0 }
        $sumbarTotal = ($sumbar2026 + $sumbar2027 + $sumbar2028) * 1000
        
        $totalAnggaran = if ($row.P39) { [double]$row.P39 * 1000 } else { ($acehTotal + $sumutTotal + $sumbarTotal) }
        
        $acehVol2026 = if ($row.P4) { [double]$row.P4 } else { 0 }
        $acehVol2027 = if ($row.P16) { [double]$row.P16 } else { 0 }
        $acehVol2028 = if ($row.P28) { [double]$row.P28 } else { 0 }
        $acehVol = $acehVol2026 + $acehVol2027 + $acehVol2028
        
        $sumutVol2026 = if ($row.P7) { [double]$row.P7 } else { 0 }
        $sumutVol2027 = if ($row.P19) { [double]$row.P19 } else { 0 }
        $sumutVol2028 = if ($row.P31) { [double]$row.P31 } else { 0 }
        $sumutVol = $sumutVol2026 + $sumutVol2027 + $sumutVol2028
        
        $sumbarVol2026 = if ($row.P10) { [double]$row.P10 } else { 0 }
        $sumbarVol2027 = if ($row.P22) { [double]$row.P22 } else { 0 }
        $sumbarVol2028 = if ($row.P34) { [double]$row.P34 } else { 0 }
        $sumbarVol = $sumbarVol2026 + $sumbarVol2027 + $sumbarVol2028

        $progIdStr = [string]$row.P1
        $programs += @{
            id = "prog-" + $progIdStr.Trim()
            program = $namaProgram
            anggaranPerProvinsi = @{
                "Aceh" = $acehTotal
                "Sumatera Utara" = $sumutTotal
                "Sumatera Barat" = $sumbarTotal
            }
            totalAnggaran = $totalAnggaran
            
            volumePerProvinsi = @{
                "Aceh" = $acehVol
                "Sumatera Utara" = $sumutVol
                "Sumatera Barat" = $sumbarVol
            }
        }
    }
}

$jsContent = "// Data dari Highlight Rekap`n"
$jsContent += "const highlightData = " + ($programs | ConvertTo-Json -Depth 5) + ";`n"

Set-Content -Path "c:\development\bencana_sumatera\highlight-data.js" -Value $jsContent -Encoding UTF8
Write-Host "Generated highlight-data.js with $($programs.Count) programs."
