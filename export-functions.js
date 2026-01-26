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

// Optimized Export to PDF
async function exportToPDF() {
    showToast('Membuat PDF...', 'warning');
    
    // Check if jsPDF is loaded
    if (!window.jspdf) {
        showToast('Library PDF belum dimuat. Mohon tunggu.', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    
    // Performance optimization: Avoid large allocations if possible
    // Use simpler coordinate tracking
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const data = getFilteredData();
    
    if (data.length === 0) {
        showToast('Tidak ada data untuk di-export!', 'error');
        return;
    }
    
    // Load logo once
    const logoBase64 = await loadImageAsBase64('assets/logo-kkp.png');
    
    // Calculate stats in one pass
    let totalBiaya = 0;
    const unitCosts = {};
    
    for (const item of data) {
        totalBiaya += item.totalBiaya;
        for (const subItem of item.items) {
            unitCosts[subItem.unit] = (unitCosts[subItem.unit] || 0) + subItem.biaya;
        }
    }
    
    const PAGE_WIDTH = doc.internal.pageSize.getWidth();
    const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
    const MARGIN = 15;
    const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    
    // Colors
    const COLOR_PRIMARY = [0, 82, 136]; // KKP Blue
    const COLOR_LIGHT = [248, 249, 252]; // Light Gray
    const COLOR_WHITE = [255, 255, 255];
    const COLOR_TEXT = [0, 0, 0];
    
    const currentDate = new Date().toLocaleDateString('id-ID', { dateStyle: 'long' });
    const filterText = (currentProvinsiFilter ? `Provinsi: ${currentProvinsiFilter}` : 'Semua Provinsi') +
                       (currentUnitFilter ? ` | Unit: ${currentUnitFilter}` : '');

    // === PAGE 1: SUMMARY ===
    // Header background
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(0, 0, PAGE_WIDTH, 30, 'F');
    
    if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', MARGIN, 3, 24, 24);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('KEMENTERIAN KELAUTAN DAN PERIKANAN', MARGIN + 32, 12);
    doc.setFontSize(13);
    doc.text('LAPORAN DAMPAK BENCANA SUMATERA', MARGIN + 32, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tanggal Export: ${currentDate}  •  ${filterText}`, MARGIN + 32, 26);
    
    let y = 40;
    
    // Summary Section
    doc.setTextColor(...COLOR_PRIMARY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RINGKASAN ESTIMASI BIAYA PER UNIT KERJA', MARGIN, y);
    y += 8;
    
    // Summary Table Header
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Unit Kerja', MARGIN + 5, y + 5.5);
    doc.text('Total Estimasi Biaya', MARGIN + CONTENT_WIDTH - 5, y + 5.5, { align: 'right' });
    y += 8;
    
    // Summary Rows
    const summaryRows = Object.entries(unitCosts);
    summaryRows.push(['TOTAL', totalBiaya]);
    
    doc.setTextColor(...COLOR_TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(200, 200, 200);
    
    summaryRows.forEach(([unit, cost], i) => {
        const isTotal = i === summaryRows.length - 1;
        if (isTotal) doc.setFont('helvetica', 'bold');
        
        doc.rect(MARGIN, y, CONTENT_WIDTH, 8, 'S');
        doc.text(unit, MARGIN + 5, y + 5.5);
        doc.text(formatCurrency(cost), MARGIN + CONTENT_WIDTH - 5, y + 5.5, { align: 'right' });
        y += 8;
    });
    
    // === PAGE 2+: DETAIL DATA ===
    doc.addPage();
    y = 20; // Start lower on second page
    
    // Configuration for Detail Table
    const headers = ['No', 'Provinsi', 'Kabupaten', 'Unit', 'Kegiatan', 'Biaya'];
    // Optimized widths (sum should ideally match CONTENT_WIDTH)
    // Ratios: No:0.05, Prov:0.15, Kab:0.18, Unit:0.12, Keg:0.35, Cost:0.15
    const widths = [
        CONTENT_WIDTH * 0.05,
        CONTENT_WIDTH * 0.15,
        CONTENT_WIDTH * 0.18,
        CONTENT_WIDTH * 0.12,
        CONTENT_WIDTH * 0.35,
        CONTENT_WIDTH * 0.15
    ];
    
    // Pre-calculate X positions for columns
    const colX = [MARGIN]; // Start at margin
    for (let i = 0; i < widths.length; i++) {
        colX.push(colX[i] + widths[i]);
    }
    
    const ROW_HEIGHT = 7;
    const HEADER_HEIGHT = 8;
    
    // Helper to draw header
    const drawDetailHeader = () => {
        // Check page overflow
        if (y + HEADER_HEIGHT > PAGE_HEIGHT - 10) {
            doc.addPage();
            y = 20;
        }
        
        doc.setFillColor(...COLOR_PRIMARY);
        doc.rect(MARGIN, y, CONTENT_WIDTH, HEADER_HEIGHT, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        
        headers.forEach((h, i) => {
            const align = i === headers.length - 1 ? 'right' : 'left';
            const offset = align === 'right' ? -2 : 2;
            const xPos = align === 'right' ? colX[i+1] : colX[i];
            doc.text(h, xPos + offset, y + 5, { align });
        });
        
        y += HEADER_HEIGHT;
    };
    
    doc.setTextColor(...COLOR_PRIMARY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DETAIL DATA PER LOKASI', MARGIN, y);
    y += 10;
    
    drawDetailHeader();
    
    doc.setTextColor(...COLOR_TEXT);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    let counter = 1;
    
    // Optimization: Batch drawing operations
    // We will draw row backgrounds/borders first, then text
    // Rowspan logic: Keep track of startY for location group
    
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const groupStartY = y;
        const itemCount = item.items.length;
        
        // Check if entire group fits? If not, we handle page break inside item loop
        // Standard approach: iterate items
        
        // To optimize rowspan border drawing:
        // We draw vertical lines for merged columns ONLY at end of page or end of group.
        
        let isFirstInGroup = true;
        
        for (let j = 0; j < itemCount; j++) {
            const subItem = item.items[j];
            
            // Page Break Check
            if (y > PAGE_HEIGHT - 20) {
                // If we are breaking a group, we need to close the bottom of merged cells on current page
                // Draw bottom line for current page
                doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
                
                doc.addPage();
                y = 20;
                drawDetailHeader();
                
                // Reset text settings
                doc.setTextColor(...COLOR_TEXT);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                
                // On new page, we should re-print location info? 
                // User requirement: "rowspan". Usually that implies blank.
                // But for clarity, maybe re-print in lighter color? Or just blank.
                // Let's stick to true rowspan (blank).
                isFirstInGroup = false; // Effectively, it's not first visually on this page, but logic-wise valid
            }
            
            // Draw Row Background (Alternating by LOCATION Group)
            if (i % 2 === 0) {
                doc.setFillColor(...COLOR_WHITE);
            } else {
                doc.setFillColor(...COLOR_LIGHT);
            }
            // Draw rect for the whole row line
            doc.rect(MARGIN, y, CONTENT_WIDTH, ROW_HEIGHT, 'F');
            
            // Draw Merged Column Text (Only if first in group)
            if (isFirstInGroup && j === 0) {
                doc.text(counter.toString(), colX[0] + 2, y + 4.5);
                doc.text(item.provinsi.substring(0, 18), colX[1] + 2, y + 4.5);
                doc.text(item.kabupaten.substring(0, 22), colX[2] + 2, y + 4.5);
            }
            
            // Draw Item Data
            doc.text(subItem.unit, colX[3] + 2, y + 4.5);
            
            // Truncate long text for simplified logic
            // Approx 60 chars max
            const kegDisplay = subItem.kegiatan.length > 55 ? subItem.kegiatan.substring(0, 55) + '...' : subItem.kegiatan;
            doc.text(kegDisplay, colX[4] + 2, y + 4.5);
            
            doc.text(formatCurrencyShort(subItem.biaya), colX[6] - 2, y + 4.5, { align: 'right' });
            
            // Draw Horizontal Line for Data Columns ONLY (Unit, Keg, Biaya) -> Columns 3, 4, 5
            // Start from X of column 3
            const lineStartX = colX[3];
            doc.setDrawColor(200, 200, 200);
            doc.line(lineStartX, y + ROW_HEIGHT, MARGIN + CONTENT_WIDTH, y + ROW_HEIGHT);
            
            y += ROW_HEIGHT;
        }
        
        // End of Group: Draw Full Bottom Line
        // (Override the partial line drawn by last item)
        doc.setDrawColor(200, 200, 200);
        doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
        
        // Draw Vertical Borders for the whole group height
        // This is tricky if it spans multiple pages.
        // Simplified optimization: Draw vertical lines for each row is safer for page breaks.
        // BUT, drawing full-height lines per page is faster.
        // Let's stick to per-row vertical lines for robustness against breaks, but optimize calls.
        // Actually, rect() 'F' fills but no border.
        // We can just draw long vertical lines at the end of the page?
        // Let's assume per-row is fine if we don't draw 1000 lines.
        // Optimization: Draw vertical lines efficiently.
        
        // Better Visualization of Rowspan:
        // Draw 3 vertical lines for the merged section from (GroupStartY to EndY) - BUT page breaks break this.
        // So we draw vertical lines row by row for now, but skipping horizontal lines for merged cols (done above).
        
        // Draw vertical lines for ALL columns, for the block we just processed?
        // No, we must draw them row-by-row inside the loop or calculate segments.
        // Let's rely on outer borders of the page or just minimal vertical dividers.
        
        // Minimalist design: Draw vertical dividers only for main sections?
        // Let's just draw column dividers for EACH row we iterate.
        // It consumes operations but is safe.
        // To speed up: avoid changing colors repeatedly.
        
        counter++;
    }
    
    // Final Vertical Lines Draw (One pass per page could be faster, but complexity high)
    // We already skipped vertical lines in the loop for speed.
    // Let's validly draw vertical lines now for the *last* page? No, too complex.
    
    // Re-iterate to draw vertical lines? No.
    // Let's just accept that without per-cell borders it's cleaner and faster.
    // We only drew horizontal lines.
    // Most modern tables don't need excessive vertical lines.
    // Let's add vertical lines only for the major sections 
    // Data is clearer with whitespace.
    
    doc.save(`Laporan_Bencana_${new Date().toISOString().slice(0,10)}.pdf`);
    showToast('PDF berhasil dibuat!', 'success');
}

// Helper for short currency
function formatCurrencyShort(value) {
    if (!value) return '-';
    return new Intl.NumberFormat('id-ID').format(value);
}

// Export to PowerPoint (Keep existing or optimize?)
// Since user complained about PDF, we focus on PDF.
// PPT logic remains same but we can check if it needs optimization later.
async function exportToPPT() {
    showToast('Membuat PowerPoint...', 'warning');
    // ... (Existing PPT logic)
    const pptx = new PptxGenJS();
    const data = getFilteredData();
    
    if (data.length === 0) {
        showToast('Tidak ada data!', 'error');
        return;
    }
    
    let totalBiaya = 0;
    let units = {};
    data.forEach(item => {
        totalBiaya += item.totalBiaya;
        item.items.forEach(i => {
            units[i.unit] = (units[i.unit] || 0) + i.biaya;
        });
    });

    let slide = pptx.addSlide();
    slide.background = { color: '0369a1' };
    slide.addText('LAPORAN DAMPAK BENCANA SUMATERA', { x: 1, y: 2, fontSize: 32, color: 'FFFFFF', bold: true });
    slide.addText(`Total Estimasi: ${formatCurrency(totalBiaya)}`, { x: 1, y: 3.5, fontSize: 24, color: 'FFD700' });
    slide.addText(new Date().toLocaleDateString('id-ID'), { x: 1, y: 5, fontSize: 14, color: 'CCCCCC' });
    
    slide = pptx.addSlide();
    slide.addText('Ringkasan per Unit Kerja', { x: 0.5, y: 0.5, fontSize: 24, color: '0369a1', bold: true });
    
    const unitRows = [['Unit Kerja', 'Estimasi Biaya']];
    Object.entries(units).forEach(([u, cost]) => {
        unitRows.push([u, formatCurrency(cost)]);
    });
    
    slide.addTable(unitRows, {
        x: 1, y: 1.5, w: 8,
        fill: { color: 'F1F5F9' },
        headerStyles: { fill: { color: '0369a1' }, color: 'FFFFFF', bold: true },
        fontFace: 'Arial'
    });
    
    slide = pptx.addSlide();
    slide.addText('10 Kabupaten Terbesar', { x: 0.5, y: 0.5, fontSize: 24, color: '0369a1', bold: true });
    
    const sortedKab = [...data].sort((a,b) => b.totalBiaya - a.totalBiaya).slice(0, 10);
    const kabRows = [['Kabupaten', 'Provinsi', 'Total Biaya']];
    
    sortedKab.forEach(k => {
        kabRows.push([k.kabupaten, k.provinsi, formatCurrency(k.totalBiaya)]);
    });
    
    slide.addTable(kabRows, {
        x: 0.5, y: 1.5, w: 9,
        fontSize: 12,
        fill: { color: 'F1F5F9' },
        headerStyles: { fill: { color: '0d9488' }, color: 'FFFFFF' }
    });

    pptx.writeFile({ fileName: `Laporan_Bencana_${new Date().toISOString().slice(0,10)}.pptx` });
    showToast('PPT berhasil dibuat!', 'success');
}
