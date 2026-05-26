// --- KONFIGURASI STATE UTAMA ---
let configSession = {};
let masterRecords = [];
let currentEditId = null;
const modeID = "5 digit"; // Default mode ID, bisa diubah ke "5 digit" jika ingin pakai format ID pendek internal

/** 
 * kalau ada perubahan form, fungsi2 berikut ini harus ikut berubah:
 * createAndReserveNewPatient check
 * loadRecordToEdit check
 * handleFormSubmit check
 * buildTableHeaders check
 * renderTableRows check
 * 
 * yeeey udah ga harus ngubah semuanya wkwk
 * */
const recordLabel = {
    redflag: ["Red Flag", "fRedflag"],
    keterangan: ["Keterangan", "fKeterangan"],
}

// Sinkronisasi Data Awal dari LocalStorage
document.addEventListener("DOMContentLoaded", () => {
    const savedRecords = localStorage.getItem("doctor_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    document.getElementById("fId").addEventListener("blur", function (e) {
        if (this.value.length > 0 && (modeID == "7 digit" ? this.value.length !== 7 : this.value.length !== 5) && e.relatedTarget.id !== "cancelBtn") {
            alert("⚠️ Kesalahan Input: ID harus tepat " + (modeID == "7 digit" ? "7" : "5") + " digit!");
            setTimeout(() => this.focus(), 10);
        }
    });

    document.getElementById("maxNameLength").innerText = modeID === "7 digit" ? "6" : "8"; // Update teks batas maksimal karakter nama singkat sesuai dengan atribut maxlength
    document.getElementById("fId").setAttribute("minlength", modeID === "7 digit" ? "7" : "5");
    document.getElementById("fId").setAttribute("maxlength", modeID === "7 digit" ? "7" : "5");
    document.getElementById("fNamaSingkat").setAttribute("maxlength", modeID === "7 digit" ? "6" : "8");

    if (!localStorage.getItem("doctor_records")) {
        localStorage.setItem("doctor_records", JSON.stringify([]));
    }

    buildTableHeaders();
    renderTableRows();
});

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeId5digit(id) {
    /**
     * Mengubah angka desimal (Base 10) menjadi string Crockford's Base 32.
     * @param {number} num - Angka positif yang akan di-encode.
     * @returns {string} String hasil encode Crockford's Base 32.
     */
    function encodeCrockford32(num) {
        if (num === 0) return "0";
        if (typeof num !== "number" || num < 0 || isNaN(num)) {
            throw new Error("Input harus berupa angka bulat positif.");
        }

        let result = "";
        let n = Math.floor(num);

        while (n > 0) {
            let remainder = n % 32;
            result = CROCKFORD_ALPHABET.charAt(remainder) + result;
            n = Math.floor(n / 32);
        }

        return result;
    }

    id = id.toString(); // 7 digit
    // 101 -> 11 (1-1 = 0 *30 +10 = 1*32 + 1 = 11)
    // 195 -> 3Z (1-1 = 0 *30 +10 = 1*32 + 95 = 3Z)
    // 201 -> 41 (41 - 40 = 1) (2 -> 40 how? 2-1 *30 +10 = 40)
    // 295 -> 4Z (4Z - 40 = 2Z -> 95)
    // 495 -> CZ  (4-1 = 3 *30 +10 = 100 + 95 = 195)
    const d1_2 = encodeCrockford32(((((parseInt(id.substring(0, 1)) - 1) * 3) + 1) * 32) + parseInt(id.substring(1, 3)));
    const d3 = id.substring(3, 4);
    const d4_5 = encodeCrockford32(parseInt(id.substring(4, 7))).padStart(2, '0');
    return `${d1_2}${d3}${d4_5}`; //hasilnya 5 digit
}

function decodeId5digit(id) {
    /**
     * Mengubah string Crockford's Base 32 kembali menjadi angka desimal.
     * @param {string} inputStr - String Crockford's Base 32 yang akan di-decode.
     * @returns {number} Angka desimal hasil decode.
     */
    function decodeCrockford32(inputStr) {
        if (typeof inputStr !== "string" || inputStr.trim() === "") {
            throw new Error("Input harus berupa string tidak kosong.");
        }

        // 1. Normalisasi: Ubah ke huruf besar, ganti I/L -> 1, O -> 0, hapus tanda hubung jika ada
        let normalized = inputStr
            .toUpperCase()
            .replace(/-/g, "") // Menghapus tanda hubung (-) yang biasa dipakai di id panjang
            .replace(/[IL]/g, "1")
            .replace(/O/g, "0");

        let result = 0;

        // 2. Hitung nilai desimalnya
        for (let i = 0; i < normalized.length; i++) {
            let char = normalized.charAt(i);
            let value = CROCKFORD_ALPHABET.indexOf(char);

            // Jika ada karakter ilegal yang bukan bagian dari Base 32
            if (value === -1) {
                throw new Error(`Karakter tidak valid ditemukan: "${char}"`);
            }

            result = result * 32 + value;
        }

        return result;
    }

    id = id.toString()
    const d1 = Math.floor((decodeCrockford32(id.substring(0, 1)) - 1) / 3) + 1;
    const d2_3 = (decodeCrockford32(id.substring(0, 2)) - ((((d1 - 1) * 3) + 1) * 32)).toString().padStart(2, '0');
    const d4 = id.substring(2, 3);
    const d5_7 = decodeCrockford32(id.substring(3, 5)).toString().padStart(3, '0');
    return `${d1}${d2_3}${d4}${d5_7}`;
}


function loadRecordToEdit(id = null) {
    // Ambil data paling fresh dari storage sebelum memuat ke form
    const savedRecords = localStorage.getItem("doctor_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    let record = null;
    let shownId = null;
    document.getElementById("formSection").style.display = "block";
    if (id) {
        record = masterRecords.find(r => r.id === id);
    } else {
        document.getElementById("fId").disabled = false;
        document.getElementById("fId").focus();
    }

    if (record) {
        for (const [key, [label, fieldId]] of Object.entries(recordLabel)) {
            document.getElementById(fieldId).value = record[key] ? record[key] : "";
        }
    }

    document.getElementById("formSection").scrollIntoView({ behavior: 'smooth' });
}

function hideFormSection() {
    document.getElementById("formSection").style.display = "none";
    currentEditId = null;
    isNewDraft = false;
    renderTableRows();
}

// --- HANDLER SUBMIT DATA ---
function handleFormSubmit(e) {
    e.preventDefault();

    // Pastikan kita mengambil data storage paling baru lagi untuk menghindari overwriting tab lain
    const savedRecords = localStorage.getItem("doctor_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    const idValue = document.getElementById("fId").value;

    const record = {
        id: idValue,
        timestamp: Number(new Date()),
        namaSingkat: (document.getElementById("fNamaSingkat").value).toUpperCase().trim(),
        isDraft: false, // Setiap submit berarti data sudah final, bukan draft lagi

        // nik: document.getElementById("fNik").value || "",
        // namaLengkap: document.getElementById("fNamaLengkap").value.trim() || "",
        // namaSekolah: document.getElementById("fNamaSekolah").value.trim() || "",
        // jk: document.getElementById("fJk").value || "",
        // ttl: document.getElementById("fTtl").value || "",
        // ortu: document.getElementById("fOrtu").value.trim() || "",
        // nikOrtu: document.getElementById("fNikOrtu").value.trim() || "",
        // pekerjaan: document.getElementById("fPekerjaan").value.trim() || "",
        // hp: document.getElementById("fHp").value.trim() || "",

        // bb: document.getElementById("fBb").value.trim() || "",
        // tb: document.getElementById("fTb").value.trim() || "",
        // td: document.getElementById("fTd").value.trim() || "",
        // hr: document.getElementById("fHr").value.trim() || "",

        demam: document.getElementById("fDemam").value || "",
        demamNote: document.getElementById("fDemamNote").value.trim() || "",
        tenggorokan: document.getElementById("fTenggorokan").value || "",
        tenggorokanNote: document.getElementById("fTenggorokanNote").value.trim() || "",
        obat: document.getElementById("fObat").value || "",
        obatNote: document.getElementById("fObatNote").value.trim() || "",
        rs: document.getElementById("fRs").value || "",
        rsNote: document.getElementById("fRsNote").value.trim() || ""
    };

    for (let key in recordLabel.regis) {
        record[key] = document.getElementById(recordLabel.regis[key][1]).value.trim() || "";

    }

    for (let key in recordLabel.antro) {
        record[key] = document.getElementById(recordLabel.antro[key][1]).value.trim() || "";

    }

    const index = masterRecords.findIndex(r => r.id === (modeID == "7 digit" ? idValue : decodeId5digit(idValue))); // ini bener karena fungsi decode itu untuk mengubah id 5 digit di input jadi 7 digit di records
    if (index !== -1) {
        masterRecords[index] = record; // Ganti draft/data eksis dengan data final
    } else {
        masterRecords.unshift(record);
    }

    localStorage.setItem("doctor_records", JSON.stringify(masterRecords));
    isNewDraft = false;
    currentEditId = null;

    document.getElementById("formSection").style.display = "none";
    renderTableRows();
    kosongkanFormInput();
    // alert("✅ Data berhasil disimpan di LocalStorage perangkat!");
}

function kosongkanFormInput() {
    document.getElementById("fId").value = "";
    document.getElementById("fNamaSingkat").value = "";
    for (const [key, [label, fieldId]] of Object.entries(recordLabel.regis)) {
        document.getElementById(fieldId).value = "";
    }
    for (const [key, [label, fieldId]] of Object.entries(recordLabel.antro)) {
        document.getElementById(fieldId).value = "";
    }
}

// --- TABEL DYNAMIC DISPLAY ---
function buildTableHeaders() {
    const tr = document.getElementById("tableHeaders");
    // Urutan Baru: Aksi (Kiri), ID, Nama Singkat
    let headers = [
        "<th>Aksi</th>",
        "<th>ID Peserta</th>",
        "<th>Nama Singkat</th>"
    ];


    for (let key in recordLabel) {
        headers.push(`<th>${recordLabel[key][0]}</th>`);
    }

    tr.innerHTML = headers.join("");
}

function renderTableRows() {
    const savedRecords = localStorage.getItem("doctor_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    const validRecords = masterRecords.filter(r => !r.isDraft);

    if (validRecords.length === 0) {
        const totalColumns = document.getElementById("tableHeaders").children.length;
        tbody.innerHTML = `<tr><td colspan="${totalColumns}" style="text-align:center; color:#999; font-style:italic;">Belum ada entri data pasien di sesi ini.</td></tr>`;
        return;
    }

    validRecords.forEach(rec => {
        const tr = document.createElement("tr");

        // Desain tombol aksi menjadi simbol kecil hemat ruang
        let actionContent = `<button onclick="loadRecordToEdit('${rec.id}')" title="Edit Data" style="border:none; background:none; cursor:pointer; font-size:15px; margin-right:4px;">✏️</button>`;

        let shownId = modeID == '7 digit' ? rec.id : rec.id_5

        let rowCells = [
            `<td>${actionContent}</td>`,
            `<td><strong>${shownId}</strong></td>`,
            `<td>${rec.namaSingkat}</td>`
        ];

        if (configSession.modReg) {
            for (let key in recordLabel.regis) {
                rowCells.push(`<td>${rec[key] || "-"}</td>`);
            }
        }
        if (configSession.modAntro) {
            for (let key in recordLabel.antro) {
                rowCells.push(`<td>${rec[key] || "-"}</td>`);
            }
            rowCells.push(
                `<td>${rec.demam === "Ya" ? "Ya (" + rec.demamNote + ")" : rec.demam || "-"}</td>`,
                `<td>${rec.tenggorokan === "Ya" ? "Ya (" + rec.tenggorokanNote + ")" : rec.tenggorokan || "-"}</td>`,
                `<td>${rec.obat === "Ya" ? "Ya (" + rec.obatNote + ")" : rec.obat || "-"}</td>`,
                `<td>${rec.rs === "Ya" ? "Ya (" + rec.rsNote + ")" : rec.rs || "-"}</td>`
            );
        }

        tr.innerHTML = rowCells.join("");
        tbody.appendChild(tr);
    });
}

// --- FUNCTION UPLOAD (PLACEHOLDER INTEGRASI CLOUD) ---
const GOOGLE_APPS_SCRIPT_URL = localStorage.getItem("GAS_URL");

async function uploadDataToCloud() {
    // Ambil rekap data paling valid dan singkirkan draft kosong
    const validRecords = masterRecords.filter(r => !r.isDraft);
    const kodeakses = document.getElementById("fAccessCodeCloud").value.trim();
    if (validRecords.length === 0) return alert("❌ Tidak ada data valid yang bisa diupload saat ini.");

    if (!navigator.onLine) return alert("🌐 Koneksi Gagal: Perangkat Anda sedang offline. Cari sinyal internet dahulu!");

    if (confirm(`Apakah Anda yakin ingin mengunggah ${validRecords.length} data pasien saat ini ke Google Sheets Cloud?`)) {
        const btnUpload = document.querySelector("#modalAkhiriSesi .btn-cloud");
        const originalText = btnUpload.innerText;

        // Kunci tombol agar tidak di-klik dua kali (Double Post Prevention)
        btnUpload.disabled = true;
        btnUpload.innerText = "⏳ Sedang Mengunggah Data...";

        try {
            // Tembak data ke Google Apps Script menggunakan metode POST JSON
            const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8" // Avoids CORS preflight
                },
                body: JSON.stringify({
                    action: "regist",
                    kodeakses: kodeakses,
                    config: configSession,
                    payload: validRecords
                })
            });

            const result = await response.json();

            if (result.status === "success") {
                // --- ALUR MODAL BERTINGKAT BERMAIN DI SINI ---
                // 1. Sembunyikan Modal Awal (Upload)
                document.getElementById("modalAkhiriSesi").style.display = "none";

                // 2. Isi pesan verifikasi dengan info baris ter-append
                document.getElementById("txtVerifikasiStatus").innerHTML = `<strong>Sistem Berhasil!</strong> ${validRecords.length} data pasien telah sukses ditambahkan di Google Sheets.`;

                // 3. Inject URL Lembar Sheets dengan parameter baris agar langsung menyorot area data baru
                // Menambahkan komponen &range=A[startRow] agar saat diklik, browser langsung meng-highlight baris data barunya
                document.getElementById("linkVerifikasiSheets").href = result.spreadsheetUrl;

                // 4. Buka Modal Verifikasi
                document.getElementById("modalVerifikasiCloud").style.display = "flex";
            } else {
                alert("🚨 Gagal Upload: " + result.message);
            }
        } catch (error) {
            alert("🚨 Terjadi gangguan koneksi internet/CORS pada Apps Script saat mengunggah. Mohon dicoba beberapa saat lagi.");
            console.error(error);
        } finally {
            btnUpload.disabled = false;
            btnUpload.innerText = originalText;
        }
    }

    document.getElementById("fAccessCodeCloud").value = ""; // Kosongkan input setelah proses upload
}

// FUNGSI OPSI 1: JIKA DATA SUDAH DICEK DAN AMAN
function executeResetLokalSempurna(t) {
    if (confirm(t || "Apakah Dokter sudah memastikan datanya masuk utuh di Google Sheets?\nTindakan ini akan menghapus memori lokal tablet untuk persiapan sesi berikutnya.")) {
        localStorage.removeItem("doctor_records");
        location.reload();
    }
}

// FUNGSI OPSI 2: JIKA INGIN KEMBALI KARENA INGIN UPLOAD ULANG
function rollbackToUploadMenu() {
    // Tutup modal verifikasi, balikkan ke modal input kode akses awal
    document.getElementById("modalVerifikasiCloud").style.display = "none";
    document.getElementById("modalAkhiriSesi").style.display = "flex";
}

function openAkhiriSesiModal() {
    document.getElementById("modalAkhiriSesi").style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

// Daftar element ID checklist echo abnormal yang memicu status Redflag
const echoAbnormalFields = [
    'vMitralRestricted', 'vMitralProlapse', 'vMitralStenosis', 'vMitralRegurgitasi', 'vMitralPansistolic',
    'vAortaRestricted', 'vAortaProlapse', 'vAortaStenosis', 'vAortaRegurgitasi',
    'vTrikuspidRegurgitasi', 'vPulmonalRegurgitasi', 'vTrikuspidStenosis', 'vPulmonalStenosis'
];

// Pasang pendeteksi perubahan di setiap checkbox katup
echoAbnormalFields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) {
        el.addEventListener('change', () => {
            // Cek apakah ada minimal salah satu checkbox katup abnormal yang aktif
            const anyAbnormal = echoAbnormalFields.some(id => document.getElementById(id).checked);

            // Jika ada temuan katup abnormal, otomatis centang PASIEN REDFLAG
            if (anyAbnormal) {
                document.getElementById('fRedflag').checked = true;
            }
        });
    }
});

let isTorchOn = false;
let idScannerInstance = null;

function openScannerIdModal() {
    document.getElementById("modalScannerId").style.display = "flex";
    isTorchOn = false;
    document.getElementById("btnToggleTorch").innerText = "💡 Nyalakan Senter";
    idScannerInstance = new Html5Qrcode("idReader");
    const config = { fps: 20, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 };

    idScannerInstance.start(
        { facingMode: "environment" },
        config,
        (scannedText) => {
            turnOffTorchIfActive();
            // Masukkan hasil scan langsung ke field ID Peserta
            const id = scannedText.split("_")[0]; // Asumsi format QR: ID5digit_NamaSingkat
            document.getElementById("fId").value = id;
            document.getElementById("fId").disabled = true;
            document.getElementById("fNamaSingkat").value = scannedText.split("_")[1] || ""; // Ambil nama singkat dari QR jika ada
            document.getElementById("fNamaSingkat").disabled = true;
            // Pemicu pengecekan otomatis apakah ID ini sudah ada rekap draft-nya di localstorage
            loadRecordToEdit(id);
            closeScannerIdModal();
        }
    ).catch(err => console.error("Kamera ID Error: ", err));
}

function closeScannerIdModal() {
    if (idScannerInstance && idScannerInstance.isScanning) {
        idScannerInstance.stop().then(() => {
            document.getElementById("idReader").innerHTML = "";
            document.getElementById("modalScannerId").style.display = "none";
            idScannerInstance = null;
        });
    } else {
        document.getElementById("modalScannerId").style.display = "none";
    }
}

function toggleScannerTorch() {
    if (!idScannerInstance || !idScannerInstance.isScanning) return;

    isTorchOn = !isTorchOn;
    const btnTorch = document.getElementById("btnToggleTorch");

    idScannerInstance.applyVideoConstraints({
        advanced: [{ torch: isTorchOn }]
    }).then(() => {
        if (isTorchOn) {
            btnTorch.innerText = "🔇 Matikan Senter";
            btnTorch.style.background = "#212529";
            btnTorch.style.color = "#fff";
        } else {
            btnTorch.innerText = "💡 Nyalakan Senter";
            btnTorch.style.background = "#ffc107";
            btnTorch.style.color = "#212529";
        }
    }).catch(err => {
        console.error("Gagal mengontrol senter:", err);
        isTorchOn = !isTorchOn; // Revert state jika gagal
    });
}

function turnOffTorchIfActive() {
    if (isTorchOn && idScannerInstance) {
        idScannerInstance.applyVideoConstraints({ advanced: [{ torch: false }] }).catch(() => { });
        isTorchOn = false;
    }
}