// --- KONFIGURASI STATE UTAMA ---
let configSession = {};
let masterRecords = [];
let currentEditId = null;
const modeID = "5 digit"; // Default mode ID, bisa diubah ke "5 digit" jika ingin pakai format ID pendek internal
const echoAbnormalFields = [
    'vMitralRestricted', 'vMitralProlapse', 'vMitralStenosis', 'vMitralRegurgitasi', 'vMitralPansistolic',
    'vAortaRestricted', 'vAortaProlapse', 'vAortaStenosis', 'vAortaRegurgitasi',
    'vTrikuspidRegurgitasi', 'vPulmonalRegurgitasi', 'vTrikuspidStenosis', 'vPulmonalStenosis'
];
const recordLabel = {
    redflag: ["Red Flag", "fRedflag", "checkbox"],
    keterangan: ["Keterangan", "fKeterangan", "text"],
    mitralrestricted: ["Mitral Restricted", "vMitralRestricted", "checkbox"],
    mitralprolapse: ["Mitral Prolapse", "vMitralProlapse", "checkbox"],
    mitralstenosis: ["Mitral Stenosis", "vMitralStenosis", "checkbox"],
    mitralregurgitasi: ["Mitral Regurgitasi", "vMitralRegurgitasi", "checkbox"],
    mitraljet: ["Panjang Jet Mitral (mm)", "vMitralJet", "text"],
    mitralpansistolic: ["Mitral Pansistolic", "vMitralPansistolic", "checkbox"],
    aortarestricted: ["Aorta Restricted", "vAortaRestricted", "checkbox"],
    aortaprolapse: ["Aorta Prolapse", "vAortaProlapse", "checkbox"],
    aortastenosis: ["Aorta Stenosis", "vAortaStenosis", "checkbox"],
    aortaregurgitasi: ["Aorta Regurgitasi", "vAortaRegurgitasi", "checkbox"],
    trikuspidregurgitasi: ["Trikuspid Regurgitasi", "vTrikuspidRegurgitasi", "checkbox"],
    pulmonalregurgitasi: ["Pulmonal Regurgitasi", "vPulmonalRegurgitasi", "checkbox"],
    trikuspidstenosis: ["Trikuspid Stenosis", "vTrikuspidStenosis", "checkbox"],
    pulmonalstenosis: ["Pulmonal Stenosis", "vPulmonalStenosis", "checkbox"],
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

    // // Pasang pendeteksi perubahan di setiap checkbox katup
    // echoAbnormalFields.forEach(fieldId => {
    //     const el = document.getElementById(fieldId);
    //     if (el) {
    //         el.addEventListener('change', () => {
    //             // Cek apakah ada minimal salah satu checkbox katup abnormal yang aktif
    //             const anyAbnormal = echoAbnormalFields.some(id => document.getElementById(id).checked);

    //             // Jika ada temuan katup abnormal, otomatis centang PASIEN REDFLAG
    //             if (anyAbnormal) {
    //                 document.getElementById('fRedflag').checked = true;
    //             }
    //         });
    //     }
    // });
    document.getElementById('fRedflag').addEventListener('change', function () {
        const subRedflag = document.getElementById('subRedflag');
        if (this.checked) {
            subRedflag.style.display = 'block';
        } else {
            subRedflag.style.display = 'none';
        }
    });

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
        if (record) {
            document.getElementById("fId").value = record.id;
            document.getElementById("fNamaSingkat").value = record.namaSingkat;
            document.getElementById("fId").disabled = true;
            document.getElementById("fNamaSingkat").disabled = true;
        }
    } else {
        document.getElementById("fId").disabled = false;
        document.getElementById("fId").focus();
    }

    if (record) {
        for (const [key, [label, fieldId, fieldType]] of Object.entries(recordLabel)) {
            if (fieldType === "checkbox") {
                document.getElementById(fieldId).checked = record[key] === "Ya";
            } else {
                document.getElementById(fieldId).value = record[key] ? record[key] : "";
            }
        }
    }

    const subRedflag = document.getElementById('subRedflag');
    if (document.getElementById("fRedflag").checked) {
        subRedflag.style.display = 'block';
    } else {
        subRedflag.style.display = 'none';
    }

    document.getElementById("formSection").scrollIntoView({ behavior: 'smooth' });
}

function hideFormSection() {
    document.getElementById("formSection").style.display = "none";
    currentEditId = null;
    isNewDraft = false;
    kosongkanFormInput();
    renderTableRows();
}

function confirmAndDeleteRecord() {
    const id = document.getElementById("fId").value.trim();
    if (confirm("⚠️ Apakah Anda yakin ingin menghapus data ID: " + id + "? Tindakan ini tidak dapat dibatalkan!")) {
        masterRecords = masterRecords.filter(r => r.id !== id);
        localStorage.setItem("doctor_records", JSON.stringify(masterRecords));
    }
    document.getElementById("formSection").style.display = "none";
    currentEditId = null;
    isNewDraft = false;
    kosongkanFormInput();
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
    };

    function rekapKeterangan() {
        let temuanKatup = [];

        // Evaluasi temuan Mitral
        if (document.getElementById('vMitralRestricted').checked) temuanKatup.push("Mitral: Restricted");
        if (document.getElementById('vMitralProlapse').checked) temuanKatup.push("Mitral: Prolapse");
        if (document.getElementById('vMitralStenosis').checked) temuanKatup.push("Mitral: Stenosis");
        if (document.getElementById('vMitralRegurgitasi').checked) temuanKatup.push("Mitral: Regurgitasi Signifikan");
        if (document.getElementById('vMitralPansistolic').checked) temuanKatup.push("Mitral: Pansistolic MR");
        const mJet = document.getElementById('vMitralJet').value.trim();
        if (mJet) temuanKatup.push(`Mitral Jet: ${mJet}mm`);

        // Evaluasi temuan Aorta
        if (document.getElementById('vAortaRestricted').checked) temuanKatup.push("Aorta: Restricted");
        if (document.getElementById('vAortaProlapse').checked) temuanKatup.push("Aorta: Prolapse");
        if (document.getElementById('vAortaStenosis').checked) temuanKatup.push("Aorta: Stenosis");
        if (document.getElementById('vAortaRegurgitasi').checked) temuanKatup.push("Aorta: Regurgitasi Signifikan");

        // Evaluasi Kanan (Trikuspid & Pulmonal)
        if (document.getElementById('vTrikuspidRegurgitasi').checked) temuanKatup.push("TR");
        if (document.getElementById('vPulmonalRegurgitasi').checked) temuanKatup.push("PR");
        if (document.getElementById('vTrikuspidStenosis').checked) temuanKatup.push("TS");
        if (document.getElementById('vPulmonalStenosis').checked) temuanKatup.push("PS");

        // Gabungkan temuan checklist dan ketikan manual dokter
        const ketManual = document.getElementById('fKeterangan').value.trim();
        let rekapKlinisAkhir = "";

        if (temuanKatup.length > 0) {
            rekapKlinisAkhir += `[Temuan Echo: ${temuanKatup.join(', ')}] `;
        }
        if (ketManual) {
            rekapKlinisAkhir += ketManual;
        }

        return rekapKlinisAkhir || "-";
    }

    for (let key in recordLabel) {
        if (key === "keterangan") {
            record[key] = document.getElementById(recordLabel[key][1]).value.trim();
        } else if (recordLabel[key][2] === "checkbox") {
            record[key] = document.getElementById(recordLabel[key][1]).checked ? "Ya" : "Tidak";
        } else {
            record[key] = document.getElementById(recordLabel[key][1]).value.trim() || "";
        }
    }

    const index = masterRecords.findIndex(r => r.id === idValue);
    if (index !== -1) {
        masterRecords[index] = record; // Ganti draft/data eksis dengan data final
    } else {
        masterRecords.unshift(record);
    }
    console.log(index);
    console.log(masterRecords);

    localStorage.setItem("doctor_records", JSON.stringify(masterRecords));
    currentEditId = null;

    document.getElementById("formSection").style.display = "none";
    renderTableRows();
    kosongkanFormInput();
    // alert("✅ Data berhasil disimpan di LocalStorage perangkat!");
}

function kosongkanFormInput() {
    document.getElementById("fId").value = "";
    document.getElementById("fNamaSingkat").value = "";
    for (const [key, [label, fieldId, fieldType]] of Object.entries(recordLabel)) {
        if (fieldType === "checkbox") {
            document.getElementById(fieldId).checked = false;
        } else {
            document.getElementById(fieldId).value = "";
        }
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

    const validRecords = masterRecords;

    if (validRecords.length === 0) {
        const totalColumns = document.getElementById("tableHeaders").children.length;
        tbody.innerHTML = `<tr><td colspan="${totalColumns}" style="text-align:center; color:#999; font-style:italic;">Belum ada entri data pasien di sesi ini.</td></tr>`;
        return;
    }

    validRecords.forEach(rec => {
        const tr = document.createElement("tr");
        tr.style.textAlign = "center";

        // Desain tombol aksi menjadi simbol kecil hemat ruang
        let actionContent = `<button onclick="loadRecordToEdit('${rec.id}')" title="Edit Data" style="border:none; background:none; cursor:pointer; font-size:15px; margin-right:4px;">✏️</button>`;

        let shownId = rec.id;

        let rowCells = [
            `<td>${actionContent}</td>`,
            `<td><strong>${shownId}</strong></td>`,
            `<td>${rec.namaSingkat}</td>`
        ];

        for (let key in recordLabel) {
            if (key === "redflag") {
                rowCells.push(`<td style="color:${rec[key] === "Ya" ? "red" : "#555"}; font-weight: ${rec[key] === "Ya" ? "bold" : "normal"};">${rec[key]}</td>`);
            } else {
                rowCells.push(`<td>${rec[key] || "-"}</td>`);
            }
        }

        tr.innerHTML = rowCells.join("");
        tbody.appendChild(tr);
    });
}

async function uploadDataToCloud() {
    const GAS_URL = localStorage.getItem("GAS_URL");
    if (!GAS_URL) {
        return alert("🚨 Error: Google Apps Script URL belum dikonfigurasi. Hubungi administrator.");
    }

    // Ambil rekap data paling valid dan singkirkan draft kosong
    const validRecords = masterRecords;
    const kodeakses = document.getElementById("fAccessCodeCloud").value.trim();
    if (validRecords.length === 0) return alert("❌ Tidak ada data valid yang bisa diupload saat ini.");
    const namaDokter = document.getElementById("fNamaDokter").value.trim();
    if (!kodeakses) return alert("⚠️ Kode Akses wajib diisi untuk otorisasi unggah data ke Google Sheets!");
    if (!namaDokter) return alert("⚠️ Nama Dokter wajib diisi untuk keperluan dokumentasi di Google Sheets!");

    if (!navigator.onLine) return alert("🌐 Koneksi Gagal: Perangkat Anda sedang offline. Cari sinyal internet dahulu!");

    if (confirm(`Apakah Anda yakin ingin mengunggah ${validRecords.length} data pasien saat ini ke Google Sheets Cloud?`)) {
        const btnUpload = document.querySelector("#btnUploadCloudReal");
        const originalText = btnUpload.innerText;


        // Kunci tombol agar tidak di-klik dua kali (Double Post Prevention)
        btnUpload.disabled = true;
        btnUpload.innerText = "⏳ Sedang Mengunggah Data...";

        try {
            // Tembak data ke Google Apps Script menggunakan metode POST JSON
            const response = await fetch(GAS_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8" // Avoids CORS preflight
                },
                body: JSON.stringify({
                    action: "redflag",
                    kodeakses: kodeakses,
                    namadokter: namaDokter,
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
                document.getElementById("linkVerifikasiSheets").href = result.url;

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