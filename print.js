const urlParams = new URLSearchParams(window.location.search);

if (urlParams.has('nik')) {
    const nik = urlParams.get('nik').trim();
    const nama = urlParams.get('nama').toUpperCase();

    // --- LOGIKA PARSING NIK ---
    // Digit 7-8 (index 6 dan 7)
    let tgl = parseInt(nik.substring(6, 8));
    let jk = "Laki-laki";

    if (tgl > 40) {
        jk = "Perempuan";
        tgl = tgl - 40; // Kurangi 40 untuk mendapatkan tanggal lahir asli
    }

    // Digit 9-10 (Bulan)
    const blnDigit = nik.substring(8, 10);
    const namaBulan = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const bulan = namaBulan[parseInt(blnDigit)] || blnDigit;

    // Digit 11-12 (Tahun)
    let thnDigit = parseInt(nik.substring(10, 12));
    // Asumsi: Jika <= 26 maka 2000-an, jika > 26 maka 1900-an
    let tahun = thnDigit <= 26 ? 2000 + thnDigit : 1900 + thnDigit;

    const ttlString = `${tgl} ${bulan} ${tahun}`;

    // --- ISI DATA KE HTML ---
    document.getElementById('pNik').innerText = nik;
    document.getElementById('pNama').innerText = nama;
    document.getElementById('pJk').innerText = jk;
    document.getElementById('pTtl').innerText = ttlString;

    // --- GENERATE BARCODE ---
    JsBarcode("#barcodeCanvas", nik + "_" + nama, {
        format: "CODE128",
        width: 2,
        height: 30,
        displayValue: false,
        margin: 0
    });

    // --- AUTO PRINT & CLOSE ---
    let printerMode = 'auto'; // Default ke auto

    if (printerMode === 'auto') {
        setTimeout(() => {
            var printer = new Recta('1689628176', '1811')
            printer.open().then(function () {
                printer.align('center')
                    .bold(true)
                    .text('Screening RHD')
                    .bold(false)
                    .barcode('CODE128', nik + "_" + nama)
                    .cut()
                    .print()
            })

            // window.print();

            // Karena dibuka dari Google Sheets, window.close() mungkin butuh izin.
            // Kita beri delay agar proses spooling printer selesai.
            setTimeout(() => {
                // window.close();
                // Fallback jika window.close diblokir browser:
                // alert("Selesai! Silakan tutup tab ini dan kembali ke Google Sheets.");
            }, 1000);
        }, 500);
    } else
        if (printerMode === 'semi-auto') {
            const element = document.getElementById('printArea');

            // 1. Define your exact barcode label size (e.g., 50mm x 30mm)
            // Change these numbers to match your physical label roll measurements!
            const labelWidth = 48;
            const labelHeight = 100;

            const opt = {
                margin: 0, // Force zero margins so it doesn't cut off
                filename: 'barcode.pdf',
                image: { type: 'jpeg', quality: 1 }, // Maximum quality for scannable barcodes
                html2canvas: {
                    scale: 3,      // Increase scale for crisp, scannable lines (crucial for barcodes)
                    useCORS: true
                },
                jsPDF: {
                    unit: 'mm',
                    format: [labelWidth, labelHeight], // Force PDF page to match your label size
                    orientation: 'landscape'
                }
            };

            // 2. Generate and open in a new window
            html2pdf()
                .set(opt)
                .from(element)
                .output('blob')
                .then(function (pdfBlob) {
                    const blobUrl = URL.createObjectURL(pdfBlob);
                    const printWindow = window.open(blobUrl, '_blank');

                    if (printWindow) {
                        printWindow.onload = function () {
                            setTimeout(() => {
                                printWindow.focus();
                                printWindow.print();
                                printWindow.close();
                                URL.revokeObjectURL(blobUrl);
                            }, 300);
                        };
                    } else {
                        alert("Please allow pop-ups to print.");
                    }
                });
        }
}