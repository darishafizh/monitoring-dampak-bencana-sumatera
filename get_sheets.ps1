Import-Module ImportExcel
$excelPath = "c:\development\bencana_sumatera\Rencana Induk dan Validasi Data Terdampak_Kementerian Kelautan dan Perikanan_18 May 2026 Update.xlsx"
$excel = Open-ExcelPackage $excelPath
$excel.Workbook.Worksheets.Name
Close-ExcelPackage $excel
