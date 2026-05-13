let html5QrCode = new Html5Qrcode("reader");
let currentScannedNik = "";

// Inisialisasi: Load data dari LocalStorage saat web dibuka
document.addEventListener("DOMContentLoaded", renderTable);

function startScanner() {
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };
    html5QrCode.start({ facingMode: "environment" }, config, (text) => {
        currentScannedNik = text;
        showModal(text);
        stopScanner(); // Matikan kamera saat modal muncul agar tidak scan terus
    }).catch(err => console.error("Kamera Error:", err));
}

function stopScanner() {
    if (html5QrCode.isScanning) {
        html5QrCode.stop();
    }
}

function showModal(nik) {
    document.getElementById('displayNik').innerText = "NIK: " + nik;
    document.getElementById('checkRedflag').checked = false;
    document.getElementById('modalRedflag').style.display = "flex";
}

function saveScreeningResult() {
    const isRedflag = document.getElementById('checkRedflag').checked ? "REDFLAG" : "NORMAL";
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // 1. Ambil data lama dari LocalStorage
    let history = JSON.parse(localStorage.getItem('screening_history') || "[]");

    // 2. Tambah data baru
    history.unshift({
        time: timestamp,
        nik: currentScannedNik,
        status: isRedflag
    });

    // 3. Simpan kembali ke LocalStorage
    localStorage.setItem('screening_history', JSON.stringify(history));

    // 4. Update Tampilan & Reset
    renderTable();
    document.getElementById('modalRedflag').style.display = "none";
    
    // 5. Jalankan kembali scanner untuk pasien berikutnya
    setTimeout(startScanner, 500);
}

function renderTable() {
    const history = JSON.parse(localStorage.getItem('screening_history') || "[]");
    const tbody = document.getElementById('recapBody');
    tbody.innerHTML = "";

    history.forEach(item => {
        const badge = item.status === "REDFLAG" ? `<span class="redflag-label">REDFLAG</span>` : "Normal";
        tbody.innerHTML += `
            <tr>
                <td>${item.time}</td>
                <td>${item.nik}</td>
                <td>${badge}</td>
            </tr>
        `;
    });
}

// FUNGSI COPY UNTUK GOOGLE SHEETS
function copyToClipboard() {
    const history = JSON.parse(localStorage.getItem('screening_history') || "[]");
    if (history.length === 0) return alert("Belum ada data untuk dicopy.");

    // Buat format Tab-Separated Values (TSV) agar pas masuk ke kolom GSheet
    let tsvContent = "Waktu\tNIK\tStatus\n"; // Header
    history.forEach(item => {
        tsvContent += `${item.time}\t${item.nik}\t${item.status}\n`;
    });

    navigator.clipboard.writeText(tsvContent).then(() => {
        alert("Data berhasil dicopy! Silakan buka Google Sheets dan tekan Ctrl+V di sel yang diinginkan.");
    });
}

function clearHistory() {
    if (confirm("Hapus semua rekap pemeriksaan hari ini?")) {
        localStorage.removeItem('screening_history');
        renderTable();
    }
}

// Jalankan scanner otomatis saat start
startScanner();

// Matikan kamera jika tab tidak aktif (hemat baterai)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopScanner();
    else if (!document.getElementById('modalRedflag').style.display === "flex") startScanner();
});