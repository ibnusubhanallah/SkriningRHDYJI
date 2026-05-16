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
    JsBarcode("#barcodeCanvas", nik+"_"+nama, {
        format: "CODE128",
        width: 2,
        height: 80,
        displayValue: false,
        margin: 0
    });

    // --- AUTO PRINT & CLOSE ---
    setTimeout(() => {
        window.print();
        
        // Karena dibuka dari Google Sheets, window.close() mungkin butuh izin.
        // Kita beri delay agar proses spooling printer selesai.
        setTimeout(() => {
            window.close();
            // Fallback jika window.close diblokir browser:
            alert("Selesai! Silakan tutup tab ini dan kembali ke Google Sheets.");
        }, 1000);
    }, 500);
}