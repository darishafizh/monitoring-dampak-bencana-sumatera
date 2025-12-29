// ===== Export Functions =====

// Helper function to load image as base64
function loadImageAsBase64(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            console.warn('Could not load image:', imagePath);
            resolve(null);
        };
        img.src = imagePath;
    });
}

// Export to PDF - Enhanced with KKP Logo and Cost Breakdown
async function exportToPDF() {
    showToast('Membuat PDF...', 'warning');
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const data = getFilteredData();
    
    if (data.length === 0) {
        showToast('Tidak ada data untuk di-export!', 'error');
        return;
    }
    
    // Load KKP Logo
    const logoBase64 = await loadImageAsBase64('assets/logo-kkp.png');
    
    // Calculate statistics with cost breakdown
    const stats = data.reduce((acc, item) => {
        acc.tambak += parseFloat(item.tambakRusak) || 0;
        acc.biayaTambak += parseFloat(item.biayaTambak) || 0;
        acc.kolam += parseFloat(item.kolamRusak) || 0;
        acc.biayaKolam += parseFloat(item.biayaKolam) || 0;
        acc.kja += parseInt(item.kjaRusak) || 0;
        acc.biayaKja += parseFloat(item.biayaKja) || 0;
        acc.saluran += parseFloat(item.saluran) || 0;
        acc.biayaSaluran += parseFloat(item.biayaSaluran) || 0;
        acc.pintuAir += parseInt(item.pintuAir) || 0;
        acc.biayaPintuAir += parseFloat(item.biayaPintuAir) || 0;
        acc.jalanProduksi += parseInt(item.jalanProduksi) || 0;
        acc.biayaJalan += parseFloat(item.biayaJalan) || 0;
        acc.rehabBBI += parseInt(item.rehabBBI) || 0;
        acc.biayaBBI += parseFloat(item.biayaBBI) || 0;
        return acc;
    }, { 
        tambak: 0, biayaTambak: 0, 
        kolam: 0, biayaKolam: 0, 
        kja: 0, biayaKja: 0, 
        saluran: 0, biayaSaluran: 0, 
        pintuAir: 0, biayaPintuAir: 0, 
        jalanProduksi: 0, biayaJalan: 0, 
        rehabBBI: 0, biayaBBI: 0 
    });
    
    const totalBiaya = stats.biayaTambak + stats.biayaKolam + stats.biayaKja + 
                       stats.biayaSaluran + stats.biayaPintuAir + stats.biayaJalan + stats.biayaBBI;
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    
    // KKP Blue color
    const kkpBlue = { r: 47, g: 49, b: 139 };
    
    // ===== PAGE 1: Cover with Logo =====
    // Header with KKP Blue
    doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Add KKP Logo
    if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, 5, 25, 25);
    }
    
    // Title - adjusted position for logo
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN DAMPAK BENCANA SUMATERA', pageWidth / 2 + 10, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Kementerian Kelautan dan Perikanan Republik Indonesia', pageWidth / 2 + 10, 23, { align: 'center' });
    
    const filterText = currentFilter ? `Provinsi: ${currentFilter}` : 'Semua Provinsi';
    doc.setFontSize(10);
    doc.text(filterText, pageWidth / 2 + 10, 30, { align: 'center' });
    
    // Summary Section - Ringkasan Kerusakan
    let yPos = 45;
    doc.setTextColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RINGKASAN KERUSAKAN DAN ESTIMASI BIAYA REHABILITASI', margin, yPos);
    
    yPos += 8;
    
    // Create summary table with cost breakdown
    const summaryTableData = [
        ['No', 'Jenis Infrastruktur', 'Jumlah Kerusakan', 'Satuan', 'Estimasi Biaya Rehabilitasi']
    ];
    
    const infraItems = [
        { name: 'Tambak', value: stats.tambak.toFixed(2), unit: 'Ha', biaya: stats.biayaTambak },
        { name: 'Kolam', value: stats.kolam.toFixed(2), unit: 'Ha', biaya: stats.biayaKolam },
        { name: 'KJA (Keramba Jaring Apung)', value: stats.kja.toString(), unit: 'Unit', biaya: stats.biayaKja },
        { name: 'Saluran', value: stats.saluran.toFixed(2), unit: 'm³', biaya: stats.biayaSaluran },
        { name: 'Pintu Air', value: stats.pintuAir.toString(), unit: 'm²', biaya: stats.biayaPintuAir },
        { name: 'Jalan Produksi', value: stats.jalanProduksi.toString(), unit: 'M', biaya: stats.biayaJalan },
        { name: 'Rehab BBI', value: stats.rehabBBI.toString(), unit: 'm²', biaya: stats.biayaBBI }
    ];
    
    infraItems.forEach((item, idx) => {
        summaryTableData.push([
            (idx + 1).toString(),
            item.name,
            formatNumber(item.value),
            item.unit,
            formatCurrency(item.biaya)
        ]);
    });
    
    // Total row
    summaryTableData.push([
        '',
        'TOTAL ESTIMASI BIAYA REHABILITASI',
        '',
        '',
        formatCurrency(totalBiaya)
    ]);
    
    // Draw summary table
    const summaryColWidths = [10, 60, 40, 25, 60];
    const summaryRowHeight = 8;
    
    summaryTableData.forEach((row, rowIdx) => {
        let xPos = margin;
        const isHeader = rowIdx === 0;
        const isTotal = rowIdx === summaryTableData.length - 1;
        
        // Row background
        if (isHeader) {
            doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
        } else if (isTotal) {
            doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
        } else if (rowIdx % 2 === 0) {
            doc.setFillColor(240, 242, 255);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, yPos, summaryColWidths.reduce((a, b) => a + b, 0), summaryRowHeight, 'F');
        
        // Draw border
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, yPos, summaryColWidths.reduce((a, b) => a + b, 0), summaryRowHeight, 'S');
        
        // Row text
        row.forEach((cell, cellIdx) => {
            if (isHeader || isTotal) {
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
            } else {
                doc.setTextColor(51, 51, 51);
                doc.setFont('helvetica', 'normal');
            }
            doc.setFontSize(9);
            
            // Right align cost column
            if (cellIdx === 4 && !isHeader) {
                doc.text(cell, xPos + summaryColWidths[cellIdx] - 2, yPos + 5.5, { align: 'right' });
            } else if (cellIdx === 0 || cellIdx === 2 || cellIdx === 3) {
                doc.text(cell, xPos + summaryColWidths[cellIdx] / 2, yPos + 5.5, { align: 'center' });
            } else {
                doc.text(cell, xPos + 2, yPos + 5.5);
            }
            xPos += summaryColWidths[cellIdx];
        });
        
        yPos += summaryRowHeight;
    });
    
    // Add data info
    yPos += 10;
    doc.setTextColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Data: ${formatNumber(data.length)} | Total Kabupaten/Kota: ${formatNumber(new Set(data.map(d => d.kabupaten)).size)}`, margin, yPos);
    
    // Footer for page 1
    addPDFFooter(doc, pageWidth, pageHeight, margin, 1);
    
    // ===== PAGE 2+: Detailed Data per Kabupaten with Cost Breakdown =====
    doc.addPage();
    let currentPage = 2;
    yPos = 20;
    
    // Function to add header on each page
    function addPageHeader(pageNum) {
        // Header bar
        doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
        doc.rect(0, 0, pageWidth, 20, 'F');
        
        // Logo smaller on data pages
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', margin, 2, 16, 16);
        }
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DATA KERUSAKAN DAN ESTIMASI BIAYA REHABILITASI PER KABUPATEN/KOTA', pageWidth / 2 + 10, 10, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${filterText} | Halaman ${pageNum}`, pageWidth / 2 + 10, 16, { align: 'center' });
    }
    
    addPageHeader(currentPage);
    yPos = 25;
    
    // Define detailed table columns with cost for each infrastructure
    const detailHeaders = [
        'No', 'Provinsi', 'Kabupaten/Kota',
        'Tambak (Ha)', 'Biaya Tambak',
        'Kolam (Ha)', 'Biaya Kolam',
        'KJA', 'Biaya KJA',
        'BBI (m²)', 'Biaya BBI'
    ];
    const detailColWidths = [7, 25, 35, 18, 28, 18, 28, 12, 28, 15, 28];
    const detailRowHeight = 7;
    
    // Draw table header
    function drawDetailTableHeader() {
        let xPos = margin;
        doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
        doc.rect(margin, yPos, detailColWidths.reduce((a, b) => a + b, 0), detailRowHeight, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        
        detailHeaders.forEach((header, i) => {
            const headerText = header.length > 12 ? header.substring(0, 10) + '..' : header;
            doc.text(headerText, xPos + 1, yPos + 5);
            xPos += detailColWidths[i];
        });
        
        yPos += detailRowHeight;
    }
    
    drawDetailTableHeader();
    
    // Data rows
    data.forEach((item, index) => {
        // Check if we need a new page
        if (yPos > pageHeight - 25) {
            addPDFFooter(doc, pageWidth, pageHeight, margin, currentPage);
            doc.addPage();
            currentPage++;
            yPos = 20;
            addPageHeader(currentPage);
            yPos = 25;
            drawDetailTableHeader();
        }
        
        // Row background
        if (index % 2 === 0) {
            doc.setFillColor(240, 242, 255);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, yPos, detailColWidths.reduce((a, b) => a + b, 0), detailRowHeight, 'F');
        
        // Border
        doc.setDrawColor(220, 220, 220);
        doc.rect(margin, yPos, detailColWidths.reduce((a, b) => a + b, 0), detailRowHeight, 'S');
        
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        
        const rowData = [
            (index + 1).toString(),
            (item.provinsi || '-').substring(0, 15),
            (item.kabupaten || '-').substring(0, 20),
            formatNumber(item.tambakRusak || 0),
            formatCurrencyShort(item.biayaTambak || 0),
            formatNumber(item.kolamRusak || 0),
            formatCurrencyShort(item.biayaKolam || 0),
            formatNumber(item.kjaRusak || 0),
            formatCurrencyShort(item.biayaKja || 0),
            formatNumber(item.rehabBBI || 0),
            formatCurrencyShort(item.biayaBBI || 0)
        ];
        
        let xPos = margin;
        rowData.forEach((cell, i) => {
            const cellText = cell.length > 15 ? cell.substring(0, 13) + '..' : cell;
            doc.text(cellText, xPos + 1, yPos + 5);
            xPos += detailColWidths[i];
        });
        
        yPos += detailRowHeight;
    });
    
    addPDFFooter(doc, pageWidth, pageHeight, margin, currentPage);
    
    // ===== PAGE: Additional Infrastructure Details (Saluran, Pintu Air, Jalan) =====
    doc.addPage();
    currentPage++;
    yPos = 20;
    
    // Header for this page
    doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
    doc.rect(0, 0, pageWidth, 20, 'F');
    
    if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, 2, 16, 16);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA INFRASTRUKTUR PENDUKUNG - SALURAN, PINTU AIR, DAN JALAN PRODUKSI', pageWidth / 2 + 10, 10, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${filterText} | Halaman ${currentPage}`, pageWidth / 2 + 10, 16, { align: 'center' });
    
    yPos = 25;
    
    // Define infrastructure table columns
    const infraHeaders = [
        'No', 'Provinsi', 'Kabupaten/Kota',
        'Saluran (m³)', 'Biaya Saluran',
        'Pintu Air (m²)', 'Biaya Pintu Air',
        'Jalan (M)', 'Biaya Jalan',
        'Total Biaya'
    ];
    const infraColWidths = [7, 25, 38, 20, 30, 22, 30, 18, 30, 35];
    
    // Draw infrastructure table header
    let xPos = margin;
    doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
    doc.rect(margin, yPos, infraColWidths.reduce((a, b) => a + b, 0), detailRowHeight, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    
    infraHeaders.forEach((header, i) => {
        const headerText = header.length > 14 ? header.substring(0, 12) + '..' : header;
        doc.text(headerText, xPos + 1, yPos + 5);
        xPos += infraColWidths[i];
    });
    
    yPos += detailRowHeight;
    
    // Data rows for infrastructure
    data.forEach((item, index) => {
        // Check if we need a new page
        if (yPos > pageHeight - 25) {
            addPDFFooter(doc, pageWidth, pageHeight, margin, currentPage);
            doc.addPage();
            currentPage++;
            yPos = 20;
            
            // Repeat header
            doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
            doc.rect(0, 0, pageWidth, 20, 'F');
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', margin, 2, 16, 16);
            }
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('DATA INFRASTRUKTUR PENDUKUNG (LANJUTAN)', pageWidth / 2 + 10, 10, { align: 'center' });
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`${filterText} | Halaman ${currentPage}`, pageWidth / 2 + 10, 16, { align: 'center' });
            
            yPos = 25;
            
            // Redraw table header
            xPos = margin;
            doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
            doc.rect(margin, yPos, infraColWidths.reduce((a, b) => a + b, 0), detailRowHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            infraHeaders.forEach((header, i) => {
                const headerText = header.length > 14 ? header.substring(0, 12) + '..' : header;
                doc.text(headerText, xPos + 1, yPos + 5);
                xPos += infraColWidths[i];
            });
            yPos += detailRowHeight;
        }
        
        const itemTotalBiaya = (parseFloat(item.biayaSaluran) || 0) +
                               (parseFloat(item.biayaPintuAir) || 0) +
                               (parseFloat(item.biayaJalan) || 0);
        
        // Row background
        if (index % 2 === 0) {
            doc.setFillColor(240, 242, 255);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        doc.rect(margin, yPos, infraColWidths.reduce((a, b) => a + b, 0), detailRowHeight, 'F');
        
        doc.setDrawColor(220, 220, 220);
        doc.rect(margin, yPos, infraColWidths.reduce((a, b) => a + b, 0), detailRowHeight, 'S');
        
        doc.setTextColor(51, 51, 51);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        
        const infraRowData = [
            (index + 1).toString(),
            (item.provinsi || '-').substring(0, 15),
            (item.kabupaten || '-').substring(0, 22),
            formatNumber(item.saluran || 0),
            formatCurrencyShort(item.biayaSaluran || 0),
            formatNumber(item.pintuAir || 0),
            formatCurrencyShort(item.biayaPintuAir || 0),
            formatNumber(item.jalanProduksi || 0),
            formatCurrencyShort(item.biayaJalan || 0),
            formatCurrencyShort(itemTotalBiaya)
        ];
        
        xPos = margin;
        infraRowData.forEach((cell, i) => {
            const cellText = cell.length > 16 ? cell.substring(0, 14) + '..' : cell;
            doc.text(cellText, xPos + 1, yPos + 5);
            xPos += infraColWidths[i];
        });
        
        yPos += detailRowHeight;
    });
    
    addPDFFooter(doc, pageWidth, pageHeight, margin, currentPage);
    
    // Save PDF
    const fileName = `Laporan_Dampak_Bencana_${currentFilter || 'Semua'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    showToast('PDF berhasil dibuat!', 'success');
}

// Helper function for short currency format in tables
function formatCurrencyShort(value) {
    if (!value || value === 0) return '-';
    const num = parseFloat(value);
    if (num >= 1000000000000) {
        return 'Rp ' + (num / 1000000000000).toFixed(1) + ' T';
    } else if (num >= 1000000000) {
        return 'Rp ' + (num / 1000000000).toFixed(1) + ' M';
    } else if (num >= 1000000) {
        return 'Rp ' + (num / 1000000).toFixed(1) + ' Jt';
    } else if (num >= 1000) {
        return 'Rp ' + (num / 1000).toFixed(0) + ' Rb';
    }
    return 'Rp ' + formatNumber(num);
}

// Helper function to add footer to PDF pages
function addPDFFooter(doc, pageWidth, pageHeight, margin, pageNum) {
    const kkpBlue = { r: 47, g: 49, b: 139 };
    
    doc.setFillColor(kkpBlue.r, kkpBlue.g, kkpBlue.b);
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const currentDate = new Date().toLocaleDateString('id-ID', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    doc.text(`Dicetak: ${currentDate} | Halaman ${pageNum}`, margin, pageHeight - 4);
    doc.text('© 2024 Kementerian Kelautan dan Perikanan RI', pageWidth - margin, pageHeight - 4, { align: 'right' });
}

// Export to PowerPoint - Premium Design
async function exportToPPT() {
    showToast('Membuat PowerPoint...', 'warning');
    
    const data = getFilteredData();
    
    if (data.length === 0) {
        showToast('Tidak ada data untuk di-export!', 'error');
        return;
    }
    
    // Calculate statistics
    const stats = data.reduce((acc, item) => {
        acc.tambak += parseFloat(item.tambakRusak) || 0;
        acc.kolam += parseFloat(item.kolamRusak) || 0;
        acc.kja += parseInt(item.kjaRusak) || 0;
        acc.saluran += parseFloat(item.saluran) || 0;
        acc.pintuAir += parseInt(item.pintuAir) || 0;
        acc.jalanProduksi += parseInt(item.jalanProduksi) || 0;
        acc.rehabBBI += parseInt(item.rehabBBI) || 0;
        acc.biaya += (parseFloat(item.biayaTambak) || 0) +
                     (parseFloat(item.biayaKolam) || 0) +
                     (parseFloat(item.biayaKja) || 0) +
                     (parseFloat(item.biayaSaluran) || 0) +
                     (parseFloat(item.biayaPintuAir) || 0) +
                     (parseFloat(item.biayaJalan) || 0) +
                     (parseFloat(item.biayaBBI) || 0);
        return acc;
    }, { tambak: 0, kolam: 0, kja: 0, saluran: 0, pintuAir: 0, jalanProduksi: 0, rehabBBI: 0, biaya: 0 });
    
    const pptx = new PptxGenJS();
    pptx.author = 'Kementerian Kelautan dan Perikanan';
    pptx.title = 'Laporan Dampak Bencana Sumatera';
    pptx.subject = 'Data Kerusakan Infrastruktur';
    pptx.company = 'Kementerian Kelautan dan Perikanan RI';
    
    // Color Palette - Ocean Theme
    const colors = {
        primary: '0369A1',
        primaryDark: '0C4A6E',
        primaryLight: '0EA5E9',
        accent: '06B6D4',
        accentLight: '22D3EE',
        cyan: '0891B2',
        teal: '0D9488',
        white: 'FFFFFF',
        lightBg: 'F0F9FF',
        darkText: '0F172A',
        grayText: '64748B',
        gold: 'F59E0B',
        orange: 'EA580C'
    };
    
    const filterText = currentFilter ? `Provinsi: ${currentFilter}` : 'Semua Provinsi';
    const currentDate = new Date().toLocaleDateString('id-ID', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    });
    
    // Helper function to add footer
    function addSlideFooter(slide, pageNum = null) {
        // Bottom accent bar
        slide.addShape('rect', {
            x: 0, y: 5.1, w: '100%', h: 0.15,
            fill: { color: colors.accentLight }
        });
        
        // Footer text
        slide.addText('Kementerian Kelautan dan Perikanan RI', {
            x: 0.3, y: 5.3, w: 5, h: 0.25,
            fontSize: 8,
            fontFace: 'Arial',
            color: colors.grayText
        });
        
        if (pageNum) {
            slide.addText(pageNum, {
                x: 8.5, y: 5.3, w: 1, h: 0.25,
                fontSize: 8,
                fontFace: 'Arial',
                color: colors.grayText,
                align: 'right'
            });
        }
    }
    
    // Helper function to add decorative wave pattern
    function addWaveDecoration(slide) {
        // Curved wave effect using multiple shapes
        slide.addShape('ellipse', {
            x: -2, y: 4, w: 6, h: 3,
            fill: { color: colors.accent, transparency: 85 }
        });
        slide.addShape('ellipse', {
            x: 7, y: -1, w: 5, h: 3,
            fill: { color: colors.primaryLight, transparency: 90 }
        });
    }
    
    // ===== SLIDE 1: Title Slide - Premium Design =====
    let slide = pptx.addSlide();
    
    // Gradient background simulation with layered shapes
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: colors.primaryDark }
    });
    
    // Decorative wave patterns
    slide.addShape('ellipse', {
        x: -3, y: 3.5, w: 8, h: 4,
        fill: { color: colors.primary, transparency: 50 }
    });
    slide.addShape('ellipse', {
        x: 6, y: -2, w: 6, h: 4,
        fill: { color: colors.cyan, transparency: 60 }
    });
    slide.addShape('ellipse', {
        x: 8, y: 4, w: 4, h: 3,
        fill: { color: colors.accentLight, transparency: 70 }
    });
    
    // Bottom accent wave
    slide.addShape('rect', {
        x: 0, y: 4.8, w: '100%', h: 0.8,
        fill: { color: colors.accent, transparency: 30 }
    });
    slide.addShape('rect', {
        x: 0, y: 5.2, w: '100%', h: 0.4,
        fill: { color: colors.accentLight }
    });
    
    // Logo placeholder circle
    slide.addShape('ellipse', {
        x: 4.25, y: 0.5, w: 1.5, h: 1.5,
        fill: { color: colors.white, transparency: 20 },
        line: { color: colors.white, width: 2 }
    });
    
    slide.addText('🐟', {
        x: 4.25, y: 0.7, w: 1.5, h: 1.2,
        fontSize: 40,
        align: 'center'
    });
    
    // Main title with shadow effect
    slide.addText('LAPORAN DAMPAK BENCANA', {
        x: 0, y: 2.2, w: 10, h: 0.7,
        fontSize: 32,
        fontFace: 'Arial',
        color: colors.white,
        bold: true,
        align: 'center'
    });
    
    slide.addText('SUMATERA', {
        x: 0, y: 2.85, w: 10, h: 0.7,
        fontSize: 44,
        fontFace: 'Arial',
        color: colors.accentLight,
        bold: true,
        align: 'center'
    });
    
    // Subtitle
    slide.addText('Kementerian Kelautan dan Perikanan', {
        x: 0, y: 3.6, w: 10, h: 0.4,
        fontSize: 16,
        fontFace: 'Arial',
        color: colors.white,
        align: 'center'
    });
    
    slide.addText('Republik Indonesia', {
        x: 0, y: 3.95, w: 10, h: 0.3,
        fontSize: 14,
        fontFace: 'Arial',
        color: colors.white,
        align: 'center',
        italic: true
    });
    
    // Filter and date badge
    slide.addShape('roundRect', {
        x: 3, y: 4.5, w: 4, h: 0.5,
        fill: { color: colors.white, transparency: 80 },
        rectRadius: 0.1
    });
    
    slide.addText(`${filterText}  •  ${currentDate}`, {
        x: 3, y: 4.55, w: 4, h: 0.4,
        fontSize: 10,
        fontFace: 'Arial',
        color: colors.white,
        align: 'center'
    });
    
    // ===== SLIDE 2: Executive Summary =====
    slide = pptx.addSlide();
    
    // Header with gradient effect
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 1.2,
        fill: { color: colors.primaryDark }
    });
    slide.addShape('rect', {
        x: 0, y: 1.1, w: '100%', h: 0.15,
        fill: { color: colors.accentLight }
    });
    
    // Decorative elements
    addWaveDecoration(slide);
    
    // Title
    slide.addText('📊 Ringkasan Eksekutif', {
        x: 0.4, y: 0.35, w: 9, h: 0.6,
        fontSize: 28,
        fontFace: 'Arial',
        color: colors.white,
        bold: true
    });
    
    slide.addText(filterText, {
        x: 0.4, y: 0.85, w: 9, h: 0.3,
        fontSize: 12,
        fontFace: 'Arial',
        color: colors.accentLight
    });
    
    // Key metrics - 2 large cards at top
    const topMetrics = [
        { 
            icon: '📈', 
            label: 'Total Data Tercatat', 
            value: formatNumber(data.length),
            sublabel: 'Entri kerusakan',
            color: colors.primary
        },
        { 
            icon: '🗺️', 
            label: 'Kabupaten/Kota Terdampak', 
            value: formatNumber(new Set(data.map(d => d.kabupaten)).size),
            sublabel: 'Wilayah teridentifikasi',
            color: colors.cyan
        }
    ];
    
    topMetrics.forEach((metric, index) => {
        const x = 0.4 + (index * 4.8);
        
        // Card background with shadow effect
        slide.addShape('roundRect', {
            x: x + 0.05, y: 1.55, w: 4.5, h: 1.3,
            fill: { color: '94A3B8', transparency: 70 },
            rectRadius: 0.15
        });
        slide.addShape('roundRect', {
            x: x, y: 1.5, w: 4.5, h: 1.3,
            fill: { color: metric.color },
            rectRadius: 0.15
        });
        
        // Icon circle
        slide.addShape('ellipse', {
            x: x + 0.2, y: 1.65, w: 0.7, h: 0.7,
            fill: { color: colors.white, transparency: 80 }
        });
        slide.addText(metric.icon, {
            x: x + 0.2, y: 1.75, w: 0.7, h: 0.5,
            fontSize: 20,
            align: 'center'
        });
        
        slide.addText(metric.label, {
            x: x + 1, y: 1.6, w: 3.3, h: 0.35,
            fontSize: 11,
            fontFace: 'Arial',
            color: colors.white
        });
        
        slide.addText(metric.value, {
            x: x + 1, y: 1.95, w: 3.3, h: 0.5,
            fontSize: 32,
            fontFace: 'Arial',
            color: colors.white,
            bold: true
        });
        
        slide.addText(metric.sublabel, {
            x: x + 1, y: 2.45, w: 3.3, h: 0.25,
            fontSize: 9,
            fontFace: 'Arial',
            color: colors.white,
            italic: true
        });
    });
    
    // Infrastructure damage cards - 3x2 grid
    const infraCards = [
        { icon: '🏞️', label: 'Tambak Rusak', value: `${formatNumber(stats.tambak.toFixed(1))} Ha`, color: colors.primaryDark },
        { icon: '🏊', label: 'Kolam Rusak', value: `${formatNumber(stats.kolam.toFixed(1))} Ha`, color: colors.primary },
        { icon: '🎣', label: 'KJA Rusak', value: `${formatNumber(stats.kja)} Unit`, color: colors.cyan },
        { icon: '🚿', label: 'Saluran', value: `${formatNumber(stats.saluran.toFixed(1))} m³`, color: colors.teal },
        { icon: '🚪', label: 'Pintu Air', value: `${formatNumber(stats.pintuAir)} m²`, color: colors.accent },
        { icon: '🛤️', label: 'Jalan Produksi', value: `${formatNumber(stats.jalanProduksi)} M`, color: colors.primaryLight }
    ];
    
    infraCards.forEach((card, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const x = 0.4 + (col * 3.15);
        const y = 3.0 + (row * 1.0);
        
        slide.addShape('roundRect', {
            x: x, y: y, w: 3, h: 0.85,
            fill: { color: card.color },
            rectRadius: 0.1
        });
        
        slide.addText(card.icon, {
            x: x + 0.1, y: y + 0.15, w: 0.6, h: 0.5,
            fontSize: 18
        });
        
        slide.addText(card.label, {
            x: x + 0.7, y: y + 0.1, w: 2.2, h: 0.3,
            fontSize: 9,
            fontFace: 'Arial',
            color: colors.white
        });
        
        slide.addText(card.value, {
            x: x + 0.7, y: y + 0.4, w: 2.2, h: 0.35,
            fontSize: 16,
            fontFace: 'Arial',
            color: colors.white,
            bold: true
        });
    });
    
    addSlideFooter(slide, '2');
    
    // ===== SLIDE 3: Total Budget - Hero Slide =====
    slide = pptx.addSlide();
    
    // Full background
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: colors.lightBg }
    });
    
    // Header accent
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 0.1,
        fill: { color: colors.primary }
    });
    
    // Decorative circles
    slide.addShape('ellipse', {
        x: -1, y: 3, w: 4, h: 4,
        fill: { color: colors.primary, transparency: 90 }
    });
    slide.addShape('ellipse', {
        x: 8, y: -1, w: 3, h: 3,
        fill: { color: colors.accentLight, transparency: 85 }
    });
    
    // Main content card
    slide.addShape('roundRect', {
        x: 1, y: 1.2, w: 8, h: 3.5,
        fill: { color: colors.white },
        shadow: { type: 'outer', blur: 10, offset: 3, angle: 45, color: '000000', opacity: 0.15 },
        rectRadius: 0.2
    });
    
    // Accent stripe
    slide.addShape('rect', {
        x: 1, y: 1.2, w: 0.15, h: 3.5,
        fill: { color: colors.primary }
    });
    
    slide.addText('💰', {
        x: 1.5, y: 1.5, w: 1, h: 0.8,
        fontSize: 40
    });
    
    slide.addText('Total Estimasi Biaya Rehabilitasi', {
        x: 2.6, y: 1.6, w: 6, h: 0.5,
        fontSize: 18,
        fontFace: 'Arial',
        color: colors.grayText
    });
    
    slide.addText(formatCurrency(stats.biaya), {
        x: 1.5, y: 2.4, w: 7, h: 1,
        fontSize: 42,
        fontFace: 'Arial',
        color: colors.primaryDark,
        bold: true
    });
    
    // Breakdown mini stats
    const budgetBreakdown = [
        { label: 'Tambak', value: formatCurrency(stats.tambak * 50000000), pct: '35%' },
        { label: 'Infrastruktur', value: formatCurrency(stats.biaya * 0.4), pct: '40%' },
        { label: 'Lainnya', value: formatCurrency(stats.biaya * 0.25), pct: '25%' }
    ];
    
    slide.addShape('rect', {
        x: 1.5, y: 3.6, w: 7, h: 0.02,
        fill: { color: colors.grayText, transparency: 70 }
    });
    
    slide.addText(`📍 ${filterText}  •  ${currentDate}`, {
        x: 1.5, y: 3.8, w: 7, h: 0.3,
        fontSize: 10,
        fontFace: 'Arial',
        color: colors.grayText
    });
    
    slide.addText(`${formatNumber(data.length)} data dari ${formatNumber(new Set(data.map(d => d.kabupaten)).size)} kabupaten/kota`, {
        x: 1.5, y: 4.1, w: 7, h: 0.3,
        fontSize: 10,
        fontFace: 'Arial',
        color: colors.grayText
    });
    
    addSlideFooter(slide, '3');
    
    // ===== SLIDE 4: Provincial Distribution =====
    slide = pptx.addSlide();
    
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 1.0,
        fill: { color: colors.primaryDark }
    });
    slide.addShape('rect', {
        x: 0, y: 0.9, w: '100%', h: 0.15,
        fill: { color: colors.accentLight }
    });
    
    slide.addText('🗺️ Distribusi per Provinsi', {
        x: 0.4, y: 0.3, w: 9, h: 0.5,
        fontSize: 26,
        fontFace: 'Arial',
        color: colors.white,
        bold: true
    });
    
    // Calculate province data
    const provinsiData = {};
    data.forEach(item => {
        if (!provinsiData[item.provinsi]) {
            provinsiData[item.provinsi] = {
                count: 0,
                biaya: 0,
                kabupaten: new Set()
            };
        }
        provinsiData[item.provinsi].count++;
        provinsiData[item.provinsi].kabupaten.add(item.kabupaten);
        provinsiData[item.provinsi].biaya += (parseFloat(item.biayaTambak) || 0) +
                                             (parseFloat(item.biayaKolam) || 0) +
                                             (parseFloat(item.biayaKja) || 0) +
                                             (parseFloat(item.biayaSaluran) || 0) +
                                             (parseFloat(item.biayaPintuAir) || 0) +
                                             (parseFloat(item.biayaJalan) || 0) +
                                             (parseFloat(item.biayaBBI) || 0);
    });
    
    const provColorPalette = [colors.primary, colors.cyan, colors.teal];
    const provIconPalette = ['🔵', '🟢', '🔷'];
    let provIndex = 0;
    
    Object.entries(provinsiData).forEach(([prov, provData], index) => {
        const y = 1.3 + (index * 1.2);
        
        // Card with shadow
        slide.addShape('roundRect', {
            x: 0.45, y: y + 0.05, w: 9.1, h: 1.0,
            fill: { color: '94A3B8', transparency: 80 },
            rectRadius: 0.12
        });
        slide.addShape('roundRect', {
            x: 0.4, y: y, w: 9.1, h: 1.0,
            fill: { color: colors.white },
            rectRadius: 0.12
        });
        
        // Left color accent
        slide.addShape('roundRect', {
            x: 0.4, y: y, w: 0.15, h: 1.0,
            fill: { color: provColorPalette[provIndex % 3] },
            rectRadius: 0.08
        });
        
        // Province icon
        slide.addShape('ellipse', {
            x: 0.7, y: y + 0.15, w: 0.7, h: 0.7,
            fill: { color: provColorPalette[provIndex % 3], transparency: 85 }
        });
        slide.addText(provIconPalette[provIndex % 3], {
            x: 0.7, y: y + 0.25, w: 0.7, h: 0.5,
            fontSize: 18,
            align: 'center'
        });
        
        // Province name
        slide.addText(prov, {
            x: 1.55, y: y + 0.15, w: 3.5, h: 0.4,
            fontSize: 18,
            fontFace: 'Arial',
            color: colors.darkText,
            bold: true
        });
        
        // Stats
        slide.addText(`${provData.kabupaten.size} Kabupaten/Kota  •  ${provData.count} Data`, {
            x: 1.55, y: y + 0.55, w: 3.5, h: 0.3,
            fontSize: 10,
            fontFace: 'Arial',
            color: colors.grayText
        });
        
        // Budget amount
        slide.addText(formatCurrency(provData.biaya), {
            x: 5.5, y: y + 0.25, w: 3.8, h: 0.5,
            fontSize: 22,
            fontFace: 'Arial',
            color: provColorPalette[provIndex % 3],
            bold: true,
            align: 'right'
        });
        
        provIndex++;
    });
    
    addSlideFooter(slide, '4');
    
    // ===== SLIDE 5+: Data Tables with Premium Design =====
    const itemsPerSlide = 7;
    const totalPages = Math.ceil(data.length / itemsPerSlide);
    
    for (let page = 0; page < totalPages; page++) {
        slide = pptx.addSlide();
        
        // Header
        slide.addShape('rect', {
            x: 0, y: 0, w: '100%', h: 1.0,
            fill: { color: colors.primaryDark }
        });
        slide.addShape('rect', {
            x: 0, y: 0.9, w: '100%', h: 0.15,
            fill: { color: colors.accentLight }
        });
        
        slide.addText(`📋 Data Kerusakan per Kabupaten/Kota`, {
            x: 0.4, y: 0.25, w: 7, h: 0.5,
            fontSize: 24,
            fontFace: 'Arial',
            color: colors.white,
            bold: true
        });
        
        // Page indicator badge
        slide.addShape('roundRect', {
            x: 8.3, y: 0.3, w: 1.2, h: 0.4,
            fill: { color: colors.accentLight },
            rectRadius: 0.1
        });
        slide.addText(`${page + 1} / ${totalPages}`, {
            x: 8.3, y: 0.35, w: 1.2, h: 0.3,
            fontSize: 12,
            fontFace: 'Arial',
            color: colors.primaryDark,
            bold: true,
            align: 'center'
        });
        
        const pageData = data.slice(page * itemsPerSlide, (page + 1) * itemsPerSlide);
        
        // Table with premium styling
        const tableRows = [
            [
                { text: 'No', options: { bold: true, fill: { color: colors.primary }, color: colors.white, fontSize: 9, align: 'center' } },
                { text: 'Provinsi', options: { bold: true, fill: { color: colors.primary }, color: colors.white, fontSize: 9 } },
                { text: 'Kabupaten/Kota', options: { bold: true, fill: { color: colors.primary }, color: colors.white, fontSize: 9 } },
                { text: 'Tambak (Ha)', options: { bold: true, fill: { color: colors.primary }, color: colors.white, fontSize: 9, align: 'center' } },
                { text: 'Kolam (Ha)', options: { bold: true, fill: { color: colors.primary }, color: colors.white, fontSize: 9, align: 'center' } },
                { text: 'KJA (Unit)', options: { bold: true, fill: { color: colors.primary }, color: colors.white, fontSize: 9, align: 'center' } },
                { text: 'Total Estimasi', options: { bold: true, fill: { color: colors.primary }, color: colors.white, fontSize: 9, align: 'right' } }
            ]
        ];
        
        pageData.forEach((item, index) => {
            const totalBiaya = (parseFloat(item.biayaTambak) || 0) +
                              (parseFloat(item.biayaKolam) || 0) +
                              (parseFloat(item.biayaKja) || 0) +
                              (parseFloat(item.biayaSaluran) || 0) +
                              (parseFloat(item.biayaPintuAir) || 0) +
                              (parseFloat(item.biayaJalan) || 0) +
                              (parseFloat(item.biayaBBI) || 0);
            
            const bgColor = index % 2 === 0 ? colors.lightBg : colors.white;
            
            tableRows.push([
                { text: ((page * itemsPerSlide) + index + 1).toString(), options: { fill: { color: bgColor }, fontSize: 9, color: colors.darkText, align: 'center' } },
                { text: item.provinsi || '-', options: { fill: { color: bgColor }, fontSize: 9, color: colors.grayText } },
                { text: item.kabupaten, options: { fill: { color: bgColor }, fontSize: 9, color: colors.darkText, bold: true } },
                { text: formatNumber(item.tambakRusak || 0), options: { fill: { color: bgColor }, fontSize: 9, color: colors.darkText, align: 'center' } },
                { text: formatNumber(item.kolamRusak || 0), options: { fill: { color: bgColor }, fontSize: 9, color: colors.darkText, align: 'center' } },
                { text: formatNumber(item.kjaRusak || 0), options: { fill: { color: bgColor }, fontSize: 9, color: colors.darkText, align: 'center' } },
                { text: formatCurrency(totalBiaya), options: { fill: { color: bgColor }, fontSize: 9, color: colors.primary, bold: true, align: 'right' } }
            ]);
        });
        
        slide.addTable(tableRows, {
            x: 0.3, y: 1.2, w: 9.4,
            colW: [0.4, 1.4, 2.2, 1.1, 1.1, 0.9, 2.3],
            border: { pt: 0.5, color: 'E2E8F0' },
            fontFace: 'Arial'
        });
        
        addSlideFooter(slide, `${4 + page + 1}`);
    }
    
    // ===== FINAL SLIDE: Thank You - Premium =====
    slide = pptx.addSlide();
    
    // Gradient background
    slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: '100%',
        fill: { color: colors.primaryDark }
    });
    
    // Decorative elements
    slide.addShape('ellipse', {
        x: -2, y: 3, w: 6, h: 5,
        fill: { color: colors.primary, transparency: 50 }
    });
    slide.addShape('ellipse', {
        x: 7, y: -2, w: 5, h: 4,
        fill: { color: colors.cyan, transparency: 60 }
    });
    slide.addShape('ellipse', {
        x: 8, y: 4, w: 3, h: 3,
        fill: { color: colors.accentLight, transparency: 70 }
    });
    
    // Wave accent
    slide.addShape('rect', {
        x: 0, y: 4.6, w: '100%', h: 0.08,
        fill: { color: colors.accentLight }
    });
    slide.addShape('rect', {
        x: 0, y: 4.75, w: '100%', h: 0.85,
        fill: { color: colors.accent, transparency: 40 }
    });
    
    // Center circle decoration
    slide.addShape('ellipse', {
        x: 3.75, y: 1.2, w: 2.5, h: 2.5,
        fill: { color: colors.white, transparency: 90 },
        line: { color: colors.accentLight, width: 3 }
    });
    
    slide.addText('✓', {
        x: 3.75, y: 1.7, w: 2.5, h: 1.5,
        fontSize: 60,
        fontFace: 'Arial',
        color: colors.accentLight,
        bold: true,
        align: 'center'
    });
    
    slide.addText('Terima Kasih', {
        x: 0, y: 3.8, w: 10, h: 0.8,
        fontSize: 44,
        fontFace: 'Arial',
        color: colors.white,
        bold: true,
        align: 'center'
    });
    
    slide.addText('Kementerian Kelautan dan Perikanan', {
        x: 0, y: 4.9, w: 10, h: 0.35,
        fontSize: 14,
        fontFace: 'Arial',
        color: colors.white,
        align: 'center'
    });
    
    slide.addText('Republik Indonesia', {
        x: 0, y: 5.2, w: 10, h: 0.3,
        fontSize: 12,
        fontFace: 'Arial',
        color: colors.accentLight,
        align: 'center',
        italic: true
    });
    
    // Save PowerPoint
    const fileName = `Laporan_Dampak_Bencana_${currentFilter || 'Semua'}_${new Date().toISOString().split('T')[0]}`;
    pptx.writeFile({ fileName: fileName })
        .then(() => {
            showToast('PowerPoint berhasil dibuat!', 'success');
        })
        .catch(err => {
            console.error('Error creating PPT:', err);
            showToast('Gagal membuat PowerPoint!', 'error');
        });
}
