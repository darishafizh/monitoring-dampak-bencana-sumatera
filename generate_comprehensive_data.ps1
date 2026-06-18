Import-Module ImportExcel
$excelPath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$sheetData = Import-Excel -Path $excelPath -WorksheetName "Matriks Aksi" -NoHeader

$items = @()
$currentNo = ""
$currentIsu = ""
$currentProgram = ""
$currentSektor = ""
$currentRO = ""
$currentProvinsi = ""

$currentRencanaAksi = ""
$currentSasaran = ""

function parseDouble($val) {
    if ($null -ne $val) {
        $strVal = ([string]$val).Replace(".", "")
        if ($strVal -match "^[\d]+$") { return [double]$strVal }
    }
    return 0
}

function safeString($val) {
    if ($null -ne $val) { return ([string]$val).Trim() }
    return ""
}

$idCounter = 1

foreach ($row in $sheetData) {
    $rencanaAksi = safeString($row.P6)
    
    # We consider it a data row if it has an Output or Anggaran, or a valid Lokasi
    $kabKota = safeString($row.P8)
    $ang26Raw = safeString($row.P13)
    $ang27Raw = safeString($row.P15)
    
    if ($kabKota -ne "" -or $ang26Raw -ne "" -or $ang27Raw -ne "") {
        
        if ($rencanaAksi -match "Rencana Aksi" -or $rencanaAksi -match "Total") { continue }
        
        # Update current grouped values if they exist
        $p1Str = safeString($row.P1)
        if ($p1Str -ne "") {
            $currentNo = $p1Str
            $currentIsu = safeString($row.P2)
            $currentProgram = safeString($row.P3)
            $currentSektor = safeString($row.P4)
            $currentRO = safeString($row.P5)
            $currentProvinsi = safeString($row.P7)
        }
        
        $prov = safeString($row.P7)
        if ($prov -ne "") { $currentProvinsi = $prov }
        
        if ($rencanaAksi -ne "") { $currentRencanaAksi = $rencanaAksi }
        
        $kecamatan = safeString($row.P9)
        $desa = safeString($row.P10)
        
        $sasaran = safeString($row.P11)
        if ($sasaran -ne "") { $currentSasaran = $sasaran }
        
        $out26 = safeString($row.P12)
        $ang26 = parseDouble($row.P13)
        $out27 = safeString($row.P14)
        $ang27 = parseDouble($row.P15)
        $out28 = safeString($row.P16)
        $ang28 = parseDouble($row.P17)
        
        $totalAng = parseDouble($row.P18)
        
        $sumber = safeString($row.P19)
        $skema = safeString($row.P20)
        $mitra = safeString($row.P21)

        $items += @{
            id = "item-$idCounter"
            isu = $currentIsu
            program = $currentProgram
            sektor = $currentSektor
            ro = $currentRO
            rencanaAksi = $currentRencanaAksi
            sasaran = $currentSasaran
            lokasi = @{
                provinsi = $currentProvinsi
                kabupaten = $kabKota
                kecamatan = $kecamatan
                desa = $desa
            }
            tahun2026 = @{ output = $out26; anggaran = $ang26 }
            tahun2027 = @{ output = $out27; anggaran = $ang27 }
            tahun2028 = @{ output = $out28; anggaran = $ang28 }
            totalAnggaran = $totalAng
            sumberDana = $sumber
            skemaPelaksanaan = $skema
            mitra = $mitra
        }
        $idCounter++
    }
}

$jsContent = "// Comprehensive Data extracted from Matriks Aksi`n"
$jsContent += "const comprehensiveData = " + ($items | ConvertTo-Json -Depth 5) + ";`n"

Set-Content -Path "c:\development\bencana_sumatera\comprehensive-data.js" -Value $jsContent -Encoding UTF8
Write-Host "Generated comprehensive-data.js with $($items.Count) items."
