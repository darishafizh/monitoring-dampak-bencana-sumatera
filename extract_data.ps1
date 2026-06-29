Import-Module ImportExcel

$filePath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$sheetName = "Matriks Bappenas"

$package = Open-ExcelPackage -Path $filePath
$ws = $package.Workbook.Worksheets[$sheetName]

$rows = $ws.Dimension.Rows

# Collect JSON entries
$entries = @()

$currentIsu = ""
$currentProgram = ""
$currentSektor = ""
$currentRO = ""
$currentProvinsi = ""
$currentSasaran = ""
$currentSumberDana = ""
$currentSkema = ""
$currentMitra = ""
$currentTotalAnggaran = ""
$currentKabKota = ""
$currentOutput2026 = ""
$currentAnggaran2026 = ""
$currentOutput2027 = ""
$currentAnggaran2027 = ""
$currentOutput2028 = ""
$currentAnggaran2028 = ""

$sectionHeaders = @()

function EscapeJson($s) {
    if ($null -eq $s) { return "" }
    $s = $s -replace '\\', '\\\\'
    $s = $s -replace '"', '\"'
    $s = $s -replace "`r`n", ' '
    $s = $s -replace "`n", ' '
    $s = $s -replace "`r", ''
    $s = $s -replace "`t", ' '
    return $s.Trim()
}

for ($r = 7; $r -le [Math]::Min($rows, 129); $r++) {
    $col1 = if ($ws.Cells[$r, 1].Text) { $ws.Cells[$r, 1].Text.Trim() } else { "" }
    $col2 = if ($ws.Cells[$r, 2].Text) { $ws.Cells[$r, 2].Text.Trim() } else { "" }
    $col3 = if ($ws.Cells[$r, 3].Text) { $ws.Cells[$r, 3].Text.Trim() } else { "" }
    $col4 = if ($ws.Cells[$r, 4].Text) { $ws.Cells[$r, 4].Text.Trim() } else { "" }
    $col5 = if ($ws.Cells[$r, 5].Text) { $ws.Cells[$r, 5].Text.Trim() } else { "" }
    $col6 = if ($ws.Cells[$r, 6].Text) { $ws.Cells[$r, 6].Text.Trim() } else { "" }
    $col7 = if ($ws.Cells[$r, 7].Text) { $ws.Cells[$r, 7].Text.Trim() } else { "" }
    $col8 = if ($ws.Cells[$r, 8].Text) { $ws.Cells[$r, 8].Text.Trim() } else { "" }
    $col9 = if ($ws.Cells[$r, 9].Text) { $ws.Cells[$r, 9].Text.Trim() } else { "" }
    $col10 = if ($ws.Cells[$r, 10].Text) { $ws.Cells[$r, 10].Text.Trim() } else { "" }
    $col11 = if ($ws.Cells[$r, 11].Text) { $ws.Cells[$r, 11].Text.Trim() } else { "" }
    $col12 = if ($ws.Cells[$r, 12].Text) { $ws.Cells[$r, 12].Text.Trim() } else { "" }
    $col13 = if ($ws.Cells[$r, 13].Text) { $ws.Cells[$r, 13].Text.Trim() } else { "" }
    $col14 = if ($ws.Cells[$r, 14].Text) { $ws.Cells[$r, 14].Text.Trim() } else { "" }
    $col15 = if ($ws.Cells[$r, 15].Text) { $ws.Cells[$r, 15].Text.Trim() } else { "" }
    $col16 = if ($ws.Cells[$r, 16].Text) { $ws.Cells[$r, 16].Text.Trim() } else { "" }
    $col17 = if ($ws.Cells[$r, 17].Text) { $ws.Cells[$r, 17].Text.Trim() } else { "" }
    $col18 = if ($ws.Cells[$r, 18].Text) { $ws.Cells[$r, 18].Text.Trim() } else { "" }
    $col19 = if ($ws.Cells[$r, 19].Text) { $ws.Cells[$r, 19].Text.Trim() } else { "" }
    $col20 = if ($ws.Cells[$r, 20].Text) { $ws.Cells[$r, 20].Text.Trim() } else { "" }
    $col21 = if ($ws.Cells[$r, 21].Text) { $ws.Cells[$r, 21].Text.Trim() } else { "" }

    # Section header (e.g., "Rencana Aksi Rehabilitasi...")
    if ($col1 -match "^Rencana Aksi") {
        $sectionHeaders += @{ row = $r; name = $col1 }
        continue
    }

    # Skip completely empty rows
    $allEmpty = ($col1 -eq "" -and $col2 -eq "" -and $col3 -eq "" -and $col6 -eq "" -and $col8 -eq "" -and $col12 -eq "" -and $col13 -eq "")
    if ($allEmpty) { continue }

    # Skip total/summary rows (only have anggaran values, no descriptive data)
    if ($col1 -eq "" -and $col2 -eq "" -and $col3 -eq "" -and $col6 -eq "" -and $col8 -eq "" -and ($col13 -ne "" -or $col15 -ne "" -or $col17 -ne "")) {
        continue
    }

    # Carry forward merged cell values
    if ($col2 -ne "") { $currentIsu = $col2 }
    if ($col3 -ne "") { $currentProgram = $col3 }
    if ($col4 -ne "") { $currentSektor = $col4 }
    if ($col5 -ne "") { $currentRO = $col5 }
    if ($col7 -ne "") { $currentProvinsi = $col7 }
    if ($col11 -ne "") { $currentSasaran = $col11 }
    if ($col18 -ne "") { $currentTotalAnggaran = $col18 }
    if ($col19 -ne "") { $currentSumberDana = $col19 }
    if ($col20 -ne "") { $currentSkema = $col20 }
    if ($col21 -ne "") { $currentMitra = $col21 }

    # Skip rows with no rencana aksi AND no kab/kota AND no output data (truly empty continuation rows)
    if ($col6 -eq "" -and $col8 -eq "" -and $col12 -eq "" -and $col13 -eq "") { continue }

    $entry = @{
        no = $col1
        isu = EscapeJson $currentIsu
        program = EscapeJson $currentProgram
        sektor = EscapeJson $currentSektor
        ro = EscapeJson $currentRO
        rencanaAksi = EscapeJson $col6
        provinsi = EscapeJson $currentProvinsi
        kabKota = EscapeJson $col8
        kecamatan = EscapeJson $col9
        desa = EscapeJson $col10
        sasaran = EscapeJson $currentSasaran
        output2026 = EscapeJson $col12
        anggaran2026 = EscapeJson $col13
        output2027 = EscapeJson $col14
        anggaran2027 = EscapeJson $col15
        output2028 = EscapeJson $col16
        anggaran2028 = EscapeJson $col17
        totalAnggaran = EscapeJson $currentTotalAnggaran
        sumberDana = EscapeJson $currentSumberDana
        skema = EscapeJson $currentSkema
        mitra = EscapeJson $currentMitra
    }
    
    $entries += $entry
}

# Build JSON
$jsonLines = @()
$jsonLines += "const matriksBappenasData = ["

for ($i = 0; $i -lt $entries.Count; $i++) {
    $e = $entries[$i]
    $comma = if ($i -lt $entries.Count - 1) { "," } else { "" }
    $jsonLines += "  {"
    $jsonLines += "    `"no`": `"$($e.no)`","
    $jsonLines += "    `"isu`": `"$($e.isu)`","
    $jsonLines += "    `"program`": `"$($e.program)`","
    $jsonLines += "    `"sektor`": `"$($e.sektor)`","
    $jsonLines += "    `"ro`": `"$($e.ro)`","
    $jsonLines += "    `"rencanaAksi`": `"$($e.rencanaAksi)`","
    $jsonLines += "    `"provinsi`": `"$($e.provinsi)`","
    $jsonLines += "    `"kabKota`": `"$($e.kabKota)`","
    $jsonLines += "    `"kecamatan`": `"$($e.kecamatan)`","
    $jsonLines += "    `"desa`": `"$($e.desa)`","
    $jsonLines += "    `"sasaran`": `"$($e.sasaran)`","
    $jsonLines += "    `"output2026`": `"$($e.output2026)`","
    $jsonLines += "    `"anggaran2026`": `"$($e.anggaran2026)`","
    $jsonLines += "    `"output2027`": `"$($e.output2027)`","
    $jsonLines += "    `"anggaran2027`": `"$($e.anggaran2027)`","
    $jsonLines += "    `"output2028`": `"$($e.output2028)`","
    $jsonLines += "    `"anggaran2028`": `"$($e.anggaran2028)`","
    $jsonLines += "    `"totalAnggaran`": `"$($e.totalAnggaran)`","
    $jsonLines += "    `"sumberDana`": `"$($e.sumberDana)`","
    $jsonLines += "    `"skema`": `"$($e.skema)`","
    $jsonLines += "    `"mitra`": `"$($e.mitra)`""
    $jsonLines += "  }$comma"
}

$jsonLines += "];"

# Also add section headers as metadata
$jsonLines += ""
$jsonLines += "const sectionHeaders = ["
for ($i = 0; $i -lt $sectionHeaders.Count; $i++) {
    $sh = $sectionHeaders[$i]
    $comma = if ($i -lt $sectionHeaders.Count - 1) { "," } else { "" }
    $jsonLines += "  `"$(EscapeJson $sh.name)`"$comma"
}
$jsonLines += "];"

$jsonLines -join "`n" | Out-File -FilePath "c:\development\bencana_sumatera\data.js" -Encoding UTF8

Write-Host "Extracted $($entries.Count) data entries"
Write-Host "Section headers: $($sectionHeaders.Count)"
Write-Host "Sections: $($sectionHeaders | ForEach-Object { $_.name })"

Close-ExcelPackage $package -NoSave
