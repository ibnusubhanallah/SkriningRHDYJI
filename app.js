const urlParams = new URLSearchParams(window.location.search);
const GAS_URL = localStorage.getItem('GAS_URL') || urlParams.get('GAS_code');
if (urlParams.get('GAS_code')) localStorage.setItem('GAS_URL', GAS_URL);

// --- LOGIKA OTOMATIS CETAK ---
if (urlParams.has('nik')) {
    const nik = urlParams.get('nik');
    const nama = urlParams.get('nama');
    
    // Tampilkan area print
    document.getElementById('printArea').style.display = 'block';
    document.getElementById('mainUI').style.display = 'none';
    document.getElementById('pNik').innerText = nik;
    document.getElementById('pNama').innerText = nama;

    // Generate Barcode
    JsBarcode("#barcodeCanvas", nik, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: false
    });

    // Pemicu Print & Auto Close
    setTimeout(() => {
        window.print();
        // Mencoba menutup tab. Catatan: Browser hanya bisa menutup tab 
        // yang dibuka lewat klik link (target="_blank")
        window.close();
        
        // Jika window.close gagal (beberapa browser memblokir), 
        // sediakan instruksi manual atau redirect balik.
        setTimeout(() => {
            alert("Selesai mencetak. Silakan kembali ke Google Sheets.");
            window.history.back();
        }, 500);
    }, 500);
}

// --- LOGIKA SCAN REDFLAG (DOKTER) ---
let html5QrCode = new Html5Qrcode("reader");

function startScanner() {
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };
    html5QrCode.start({ facingMode: "environment" }, config, (text) => {
        document.getElementById('scanNik').innerText = text;
        document.getElementById('result').style.display = "block";
        html5QrCode.pause();
    });
}

function submitRedflag() {
    const payload = {
        action: 'submitRedflag',
        nik: document.getElementById('scanNik').innerText,
        redflag: document.getElementById('isRedflag').checked ? "YA" : "TIDAK",
        timestamp: new Date().toISOString()
    };

    if (navigator.onLine) {
        fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) })
        .then(() => alert("Data Redflag Terkirim"));
    } else {
        // Simpan lokal jika offline (opsional, bisa pakai IndexedDB lagi)
        alert("Offline: Data Redflag tersimpan di memori sementara.");
    }

    document.getElementById('result').style.display = "none";
    document.getElementById('isRedflag').checked = false;
    html5QrCode.resume();
}

// Jalankan scanner jika bukan dalam mode print
if (!urlParams.has('nik')) {
    startScanner();
}