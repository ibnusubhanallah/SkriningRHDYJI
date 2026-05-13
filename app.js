let html5QrCode = new Html5Qrcode("reader");
let currentScanned = []; // Array untuk menyimpan hasil scan sementara (NIK dan Nama)

// Inisialisasi: Load data dari LocalStorage saat web dibuka
document.addEventListener("DOMContentLoaded", renderTable);

function startScanner() {
    const config = {
        fps: 20,
        qrbox: { width: 300, height: 150 },
        videoConstraints: {
            facingMode: "environment",
            focusMode: "continuous" // Coba aktifkan continuous focus jika didukung
        }
    };
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (text) => {
            currentScanned = text.split("_"); // Ambil NIK dari hasil scan (asumsi format "NIK|Nama")
            showModal(currentScanned);
            stopScanner(); // Matikan kamera saat modal muncul agar tidak scan terus
            if (navigator.vibrate) navigator.vibrate(100); // Getarkan perangkat sebagai feedback
        }).catch(err => console.error("Kamera Error:", err));
}

function stopScanner() {
    if (html5QrCode.isScanning) {
        html5QrCode.stop();
    }
}

function getFormattedDate() {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0'); // Januari itu 0
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return [`${d}/${m}/${y} ${hh}:${mm}`, (Number(now)/1000/60/60/24) + (70*365.25) + 2 - (5/24)];
}

function showModal(currentScanned) {
    document.getElementById('displayNik').innerText = "NIK: " + currentScanned[0]; // Tampilkan NIK
    document.getElementById('displayName').innerText = "Nama: " + currentScanned[1]; // Tampilkan Nama
    document.getElementById('checkRedflag').checked = false;
    document.getElementById('inputKeterangan').value = ""; // Reset textarea keterangan
    document.getElementById('modalRedflag').style.display = "flex";
}

function saveScreeningResult() {
    const isRedflag = document.getElementById('checkRedflag').checked ? "REDFLAG" : "NORMAL";
    const keterangan = document.getElementById('inputKeterangan').value.trim(); // Ambil keterangan (jika ada)
    const timestamp = getFormattedDate()[0]; // Ambil waktu dalam format yang sudah ditentukan

    // 1. Ambil data lama dari LocalStorage
    let history = JSON.parse(localStorage.getItem('screening_history') || "[]");

    // 2. Tambah data baru
    history.unshift({
        time: timestamp,
        timestampSortable: getFormattedDate()[1], // Simpan timestamp untuk sorting jika diperlukan
        nik: currentScanned[0], // Ambil NIK dari array hasil scan (karena format "NIK|Nama")
        name: currentScanned[1], // Ambil Nama dari array hasil scan
        status: isRedflag,
        note: keterangan || "-" // Simpan keterangan, jika kosong isi dengan "-"
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
                <td>${item.name}</td>
                <td>${badge}</td>
                <td>${item.note}</td>
            </tr>
        `;
    });
}

// FUNGSI COPY UNTUK GOOGLE SHEETS
function copyToClipboard() {
    const history = JSON.parse(localStorage.getItem('screening_history') || "[]");
    if (history.length === 0) return alert("Belum ada data untuk dicopy.");

    // Buat format Tab-Separated Values (TSV) agar pas masuk ke kolom GSheet
    let tsvContent = "Waktu\tNIK\tNama\tStatus\tKeterangan\n"; // Header
    history.forEach(item => {
        tsvContent += `${item.timestampSortable}\t${item.nik}\t${item.name}\t${item.status}\t${item.note}\n`;
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