const GAS_URL = localStorage.getItem("GAS_URL");
let html5QrCode = new Html5Qrcode("reader");
let currentScanned = []; // Array untuk menyimpan hasil scan sementara (NIK dan Nama)
let isEditing = false; // Flag untuk menandai apakah sedang dalam mode edit atau input baru

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
    if (!html5QrCode.isScanning) {
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (text) => {
                currentScanned = text.split("_"); // Ambil NIK dari hasil scan (asumsi format "NIK|Nama")
                checkDuplicate(currentScanned);
                stopScanner(); // Matikan kamera saat modal muncul agar tidak scan terus
                if (navigator.vibrate) navigator.vibrate(100); // Getarkan perangkat sebagai feedback
            }).catch(err => alert("Kamera Error:" + err));
    }
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
    return [`${d}/${m}/${y} ${hh}:${mm}`, (Number(now) / 1000 / 60 / 60 / 24) + (70 * 365.25) + 2 - (5 / 24), Number(now)];
}

function checkDuplicate(data) {
    const [id, name] = data;
    let history = JSON.parse(localStorage.getItem('doctor_records') || "[]");
    const existing = history.find(item => item.id === id);

    if (existing) {
        if (confirm(`Data ID ${id} sudah ada (Status: ${existing.status}). Ingin EDIT data ini?`)) {
            showModal(existing, true);
        } else {
            startScanner(); // Batal, balik scan
        }
    } else {
        showModal({ id: id, name: name, status: "NORMAL", note: "" }, false);
    }
}

function openEntryModal(data, isEdit) {
    iseditting = isEdit; // Set flag mode edit atau input baru
    document.getElementById('entryTitle').innerText = isEdit ? "Edit Data Screening" : "Input Baru";
    document.getElementById('displayId').innerText = "ID: " + data.id; // Tampilkan ID
    document.getElementById('displayName').innerText = "Nama: " + data.name; // Tampilkan Nama
    document.getElementById('checkRedflag').checked = (data.status === "REDFLAG");
    document.getElementById('inputNote').value = data.note === "-" ? "" : data.note;
    document.getElementById('modalEntry').style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
    startScanner();
}

function saveToLocal() {
    const isRedflag = document.getElementById('checkRedflag').checked ? "REDFLAG" : "NORMAL";
    const keterangan = document.getElementById('inputNote').value.trim(); // Ambil keterangan (jika ada)
    const timestamp = getFormattedDate(); // Ambil waktu dalam format yang sudah ditentukan

    // 1. Ambil data lama dari LocalStorage
    let history = JSON.parse(localStorage.getItem('doctor_records') || "[]");

    // 2. Tambah data baru
    if (isEditMode) {
        const index = history.findIndex(i => i.id === currentScanned[0]);
        history[index] = { ...history[index], status: isRedflag, note: keterangan };
    } else {
        history.unshift({
            time: timestamp[0],
            timeGsheet: timestamp[1], // Simpan timestamp untuk sorting jika diperlukan
            timeJS: timestamp[2], // Simpan timestamp asli untuk referensi
            id: currentScanned[0], // Ambil NIK dari array hasil scan (karena format "NIK|Nama")
            name: currentScanned[1], // Ambil Nama dari array hasil scan
            status: isRedflag,
            note: keterangan || "-" // Simpan keterangan, jika kosong isi dengan "-"
        });
    }

    // 3. Simpan kembali ke LocalStorage
    localStorage.setItem('doctor_records', JSON.stringify(history));

    // 4. Update Tampilan & Reset
    renderTable();
    document.getElementById('modalEntry').style.display = "none";

    // 5. Jalankan kembali scanner untuk pasien berikutnya
    setTimeout(startScanner, 500);
}

function renderTable() {
    const history = JSON.parse(localStorage.getItem('doctor_records') || "[]");
    const tbody = document.getElementById('recapBody');
    tbody.innerHTML = "";

    history.forEach(item => {
        const badge = item.status === "REDFLAG" ? `<span class="redflag-label">REDFLAG</span>` : "Normal";
        tbody.innerHTML += `
            <tr>
                <td>${item.time}</td>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>${badge}</td>
                <td>${item.note}</td>
                <td><button onclick="editManual('${item.id}')">Edit</button></td>
            </tr>
        `;
    });

}

function editManual(id) {
    currentId = id;
    const history = JSON.parse(localStorage.getItem('doctor_records') || "[]");
    openEntryModal(history.find(i => i.id === id), true);
}

// // FUNGSI COPY UNTUK GOOGLE SHEETS
// function copyToClipboard() {
//     const history = JSON.parse(localStorage.getItem('doctor_records') || "[]");
//     if (history.length === 0) return alert("Belum ada data untuk dicopy.");

//     // Buat format Tab-Separated Values (TSV) agar pas masuk ke kolom GSheet
//     let tsvContent = "Waktu\tNIK\tNama\tStatus\tKeterangan\n"; // Header
//     history.forEach(item => {
//         tsvContent += `${item.timestampSortable}\t${item.id}\t${item.name}\t${item.status}\t${item.note}\n`;
//     });

//     navigator.clipboard.writeText(tsvContent).then(() => {
//         alert("Data berhasil dicopy! Silakan buka Google Sheets dan tekan Ctrl+V di sel yang diinginkan.");
//     });
// }

// --- UPLOAD FLOW ---
function openUploadForm() {
    document.getElementById('modalVerify').style.display = "none";
    document.getElementById('modalUpload').style.display = "flex";
    document.getElementById('uploadError').style.display = "none";
}

async function performUpload() {
    const doctor = document.getElementById('doctorName').value;
    const code = document.getElementById('accessCode').value;
    const history = JSON.parse(localStorage.getItem('doctor_records') || "[]");

    if (!doctor || !code) return alert("Nama Dokter dan Kode Akses wajib diisi!");

    const btn = document.getElementById('btnDoUpload');
    btn.disabled = true; btn.innerText = "Mengirim...";

    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({
                accessCode: code,
                doctorName: doctor,
                payload: history
            })
        });

        const result = await response.json();

        if (result.status === "success") {
            document.getElementById('sheetLink').href = result.url;
            document.getElementById('modalUpload').style.display = "none";
            document.getElementById('modalVerify').style.display = "flex";
        } else {
            document.getElementById('uploadError').innerText = result.message;
            document.getElementById('uploadError').style.display = "block";
        }
    } catch (e) {
        alert("Gagal koneksi ke server. Pastikan internet aktif.");
    } finally {
        btn.disabled = false; btn.innerText = "Mulai Upload Sekarang";
    }
}

function clearData() {
    if (confirm("Data lokal akan dihapus permanen. Lanjut?")) {
        localStorage.removeItem('doctor_records');
        renderTable();
        closeModal('modalVerify');
        alert("Data dibersihkan. Siap untuk sesi berikutnya.");
        location.reload();
    }
}

// Jalankan scanner otomatis saat start
startScanner();

// Matikan kamera jika tab tidak aktif (hemat baterai)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopScanner();
    else if (
        !document.getElementById('modalEntry').style.display === "flex" ||
        !document.getElementById('modalUpload').style.display === "flex" ||
        !document.getElementById('modalVerify').style.display === "flex"
    ) startScanner();
});