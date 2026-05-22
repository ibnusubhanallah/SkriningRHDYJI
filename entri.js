// --- KONFIGURASI STATE UTAMA ---
let configSession = {};
let masterRecords = [];
let currentEditId = null;
let isNewDraft = false;

// Sinkronisasi Data Awal dari LocalStorage
document.addEventListener("DOMContentLoaded", () => {
    const savedConfig = localStorage.getItem("skrining_config");
    const savedRecords = localStorage.getItem("skrining_records");

    if (savedConfig) {
        configSession = JSON.parse(savedConfig);
        masterRecords = savedRecords ? JSON.parse(savedRecords) : [];
        showMainDashboard();
    } else {
        document.getElementById("gatewayScreen").style.display = "block";
        document.getElementById("mainScreen").style.display = "none";
    }

    // Listener Validasi NIK saat kursor keluar (Blur Event)
    document.getElementById("fNik").addEventListener("blur", function () {
        if (this.value.length > 0 && this.value.length !== 16) {
            resetAutoNikFields();
            alert("⚠️ Kesalahan Input: NIK harus tepat 16 digit!");
            setTimeout(() => this.focus(), 10);
        }
    });

    document.getElementById("fId").addEventListener("blur", function (e) {
        if (this.value.length > 0 && this.value.length !== 7 && e.relatedTarget.id !== "cancelBtn") {
            alert("⚠️ Kesalahan Input: ID harus tepat 7 digit!");
            setTimeout(() => this.focus(), 10);
        }
    });

    document.getElementById("fNik").addEventListener("input", function () {
        if (this.value.length === 16) {
            parseDataFromNik(this.value);
        }
    });
});

// --- LOGIKA GATEWAY ---
function toggleMejaField() {
    const isRegChecked = document.getElementById("modReg").checked;
    document.getElementById("mejaFieldWrapper").style.display = isRegChecked ? "block" : "none";
}

function togglePrinterField() {
    const isPrinterChecked = document.getElementById("usePrinter").checked;
    document.getElementById("printerFieldWrapper").style.display = isPrinterChecked ? "block" : "none";
}

function initSession() {
    const wilayah = document.getElementById("gwWilayah").value;
    const kodeLokasi = document.getElementById("gwKodeLokasi").value.trim();
    const modReg = document.getElementById("modReg").checked;
    const modAntro = document.getElementById("modAntro").checked;
    const meja = document.getElementById("gwMeja").value.trim();
    const appkey = document.getElementById("gwAppKey").value.trim();
    const appport = document.getElementById("gwAppPort").value.trim();

    if (!wilayah) return alert("Pilih Wilayah terlebih dahulu!");
    if (parseInt(kodeLokasi) > 95 || parseInt(kodeLokasi) < 1) return alert("Kode lokasi harus antara 1-95!");
    if (!modReg && !modAntro) return alert("Pilih minimal satu modul!");
    if (modReg && (!meja || parseInt(meja) < 1)) return alert("Isi nomor Meja Registrasi!");

    configSession = { wilayah, kodeLokasi, modReg, modAntro, meja };
    localStorage.setItem("skrining_config", JSON.stringify(configSession));
    localStorage.setItem("RECTA_KEY", appkey);
    localStorage.setItem("RECTA_PORT", appport);

    if (!localStorage.getItem("skrining_records")) {
        localStorage.setItem("skrining_records", JSON.stringify([]));
        masterRecords = [];
    }

    showMainDashboard();
}

// --- UI RE-VALIDATION ENGINE ---
function showMainDashboard() {
    document.getElementById("gatewayScreen").style.display = "none";
    document.getElementById("mainScreen").style.display = "block";

    document.getElementById("metaWilayah").innerText = "Wilayah: " + configSession.wilayah;
    document.getElementById("metaLokasi").innerText = "Kode Lokasi: " + configSession.kodeLokasi;
    if (configSession.modReg) {
        document.getElementById("metaMeja").innerText = "Meja: " + configSession.meja;
    } else {
        document.getElementById("metaMeja").style.display = "none";
    }
    document.getElementById("metaModul").innerText = `Modul: ${configSession.modReg ? (configSession.modAntro ? 'Regis & Antro' : 'Regis') : 'Antro'}`;

    document.getElementById("btnScanIdPasien").style.display = !configSession.modReg ? "flex" : "none";

    document.getElementById("subFormRegistrasi").style.display = configSession.modReg ? "block" : "none";
    document.getElementById("subFormAntropometri").style.display = configSession.modAntro ? "block" : "none";

    // Tampilkan tombol printer hanya jika meja Registrasi aktif
    document.getElementById("btnSettingPrinter").style.display = configSession.modReg ? "inline-block" : "none";

    // Nama Singkat Wajib Terisi di segala kondisi modul (Konfirmatori)
    document.getElementById("fNamaSingkat").required = true;

    document.getElementById("fJk").required = configSession.modReg;
    document.getElementById("fTtl").required = configSession.modReg;
    document.getElementById("fNamaLengkap").required = configSession.modReg;
    document.getElementById("fBb").required = configSession.modAntro;
    document.getElementById("fTb").required = configSession.modAntro;

    buildTableHeaders();
    renderTableRows();
}

// --- VALIDATION INPUT FILTERS ---
function handleThreeDigitLimit(input) {
    // Hanya angka, maksimal 3 digit bersih
    input.value = input.value.replace(/\D/g, '').substring(0, 3);
}

function handleDateMask(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);

    // Cegah angka impossible pada Hari (1-31)
    if (v.length >= 2) {
        let day = parseInt(v.substring(0, 2));
        if (day > 31 || day === 0) {
            alert("⚠️ Tanggal tidak valid! Gunakan rentang (01-31).");
            input.value = ""; return;
        }
    }
    // Cegah angka impossible pada Bulan (1-12)
    if (v.length >= 4) {
        let month = parseInt(v.substring(2, 4));
        if (month > 12 || month === 0) {
            alert("⚠️ Bulan tidak valid! Gunakan rentang (01-12).");
            input.value = v.substring(0, 2); return;
        }
    }

    if (v.length >= 5) {
        input.value = v.substring(0, 2) + '-' + v.substring(2, 4) + '-' + v.substring(4);
    } else if (v.length >= 3) {
        input.value = v.substring(0, 2) + '-' + v.substring(2);
    } else {
        input.value = v;
    }
}

// --- PARSER DATA NIK ---
function parseDataFromNik(nik) {
    const jkSelect = document.getElementById("fJk");
    const ttlInput = document.getElementById("fTtl");
    const noteJk = document.getElementById("noteJk");
    const noteTtl = document.getElementById("noteTtl");

    let rawTgl = parseInt(nik.substring(6, 8));
    const rawBln = parseInt(nik.substring(8, 10));
    const rawThn = parseInt(nik.substring(10, 12));

    if (rawTgl === 0 || rawTgl === 40 || rawTgl > 71) {
        alert("🚨 NIK Tidak Valid: Digit tanggal lahir (" + rawTgl + ") menyalahi aturan!");
        resetAutoNikFields(); return;
    }
    if (rawBln < 1 || rawBln > 12) {
        alert("🚨 NIK Tidak Valid: Digit bulan lahir (" + rawBln + ") mustahil!");
        resetAutoNikFields(); return;
    }

    let gender = "Laki-laki";
    if (rawTgl > 40) {
        gender = "Perempuan";
        rawTgl -= 40;
    }

    const currentYearShort = new Date().getFullYear() % 100;
    let fullYear = rawThn > currentYearShort ? 1900 + rawThn : 2000 + rawThn;

    jkSelect.value = gender;
    jkSelect.disabled = true;
    noteJk.innerText = "Terisi otomatis dari NIK, mohon verifikasi.";

    const padTgl = String(rawTgl).padStart(2, '0');
    const padBln = String(rawBln).padStart(2, '0');
    ttlInput.value = `${padTgl}-${padBln}-${fullYear}`;
    ttlInput.disabled = true;
    noteTtl.innerText = "Terisi otomatis dari NIK, mohon verifikasi.";
}

function resetAutoNikFields() {
    document.getElementById("fJk").disabled = false;
    document.getElementById("fJk").value = "";
    document.getElementById("fTtl").disabled = false;
    document.getElementById("fTtl").value = "";
    document.getElementById("noteJk").innerText = "";
    document.getElementById("noteTtl").innerText = "";
}

function toggleAnamnesisNote(selectId, noteId) {
    const val = document.getElementById(selectId).value;
    document.getElementById(noteId).style.display = (val === "Ya") ? "block" : "none";
}

const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

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

let modeID = "7 digit"; // Default mode ID

// --- MULTI-TAB SAFE ID GENERATOR ---
function generateSequentialID() {
    if (modeID === "7 digit") {
        const wMap = { "Malang": 1, "Bekasi": 2, "Lampung": 3, "Minahasa Utara": 4 };
        const d1 = wMap[configSession.wilayah] || 0;
        const d2_3 = String(configSession.kodeLokasi).padStart(2, '0');
        const d4 = configSession.modReg ? configSession.meja : "0"; // 0 jika modul reg mati
        const prefix = `${d1}${d2_3}${d4}`;

        let currentCounter = 1;
        masterRecords.forEach(rec => {
            if (rec.id && rec.id.startsWith(prefix)) {
                const lastThree = parseInt(rec.id.substring(4, 7));
                if (lastThree >= currentCounter) {
                    currentCounter = lastThree + 1;
                }
            }
        });

        return `${prefix}${String(currentCounter).padStart(3, '0')}`;
    } else if (modeID === "5 digit") {
        const wMap = { "Malang": 1, "Lampung": 4, "Bekasi": 7, "Minahasa Utara": 10 };
        const d1_2 = encodeCrockford32((wMap[configSession.wilayah] || 0) * 32) + (parseInt(configSession.kodeLokasi) || 0);
        const d3 = configSession.modReg ? String(configSession.meja) : "0"; // 0 jika modul reg mati
        const prefix = `${d1_2}${d3}`;

        let currentCounter = 1;
        masterRecords.forEach(rec => {
            if (rec.id && rec.id.startsWith(prefix)) {
                const lastTwo = decodeCrockford32(rec.id.substring(3, 5));
                if (lastTwo >= currentCounter) {
                    currentCounter = lastTwo + 1;
                }
            }
        });
    }
}

// ALUR BARU: Klik Tambah Langsung Amankan ID Ke LocalStorage (Mencegah Tab Balapan)
function createAndReserveNewPatient() {
    if (configSession.modReg) {
        // 1. Ambil data segar dari localStorage dulu (Cek aktivitas tab sebelah)
        const savedRecords = localStorage.getItem("skrining_records");
        masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

        // 2. Buat ID unik berdasarkan data paling update
        const newId = generateSequentialID();

        // 3. Buat draft kosong
        const newDraft = {
            id: newId, namaSingkat: "DRAFT KOSONG", isDraft: true,
            nik: "", jk: "", ttl: "", namaLengkap: "", ortu: "", hp: "", pekerjaan: "",
            bb: "", tb: "", td: "", hr: "", demam: "", demamNote: "",
            tenggorokan: "", tenggorokanNote: "", obat: "", obatNote: "", rs: "", rsNote: ""
        };

        // 4. Langsung kunci ke Storage utama
        masterRecords.unshift(newDraft);
        localStorage.setItem("skrining_records", JSON.stringify(masterRecords));

        // 5. Buka form dalam mode edit untuk ID draft tersebut
        isNewDraft = true;
        loadRecordToEdit(newId);
    } else {
        loadRecordToEdit(); // Mode input baru tanpa ID khusus jika modul Registrasi mati
    }
}

function loadRecordToEdit(id = null) {
    // Ambil data paling fresh dari storage sebelum memuat ke form
    const savedRecords = localStorage.getItem("skrining_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    let record = null;
    if (id) {
        record = masterRecords.find(r => r.id === id);
        if (!record) return;

        currentEditId = id;
        document.getElementById("formTitle").innerText = record.isDraft ? "Form Pasien Baru (ID: " + id + ")" : "Edit Data Pasien (ID: " + id + ")";
        document.getElementById("formSection").style.display = "block";

        document.getElementById("fId").value = record.id;
        document.getElementById("fNamaSingkat").focus();
    } else {
        if (!record) {
            document.getElementById("fId").disabled = false;
        }
        document.getElementById("formTitle").innerText = "Form Antropometri Pasien";
        document.getElementById("formSection").style.display = "block";
        document.getElementById("fId").focus();
    }

    if (configSession.modReg) {
        document.getElementById("fNamaSingkat").value = record.isDraft ? "" : record.namaSingkat;
        document.getElementById("fNik").value = record.nik;
        document.getElementById("fJk").value = record.jk;
        document.getElementById("fTtl").value = record.ttl;
        document.getElementById("fNamaLengkap").value = record.isDraft ? "" : record.namaLengkap;
        document.getElementById("fOrtu").value = record.ortu;
        document.getElementById("fHp").value = record.hp;
        document.getElementById("fPekerjaan").value = record.pekerjaan;

        if (record.nik && record.nik.length === 16) {
            document.getElementById("fJk").disabled = true;
            document.getElementById("fTtl").disabled = true;
        } else {
            document.getElementById("fJk").disabled = false;
            document.getElementById("fTtl").disabled = false;
        }
    }

    if (configSession.modAntro && record) {
        document.getElementById("fBb").value = record.bb;
        document.getElementById("fTb").value = record.tb;
        document.getElementById("fTd").value = record.td;
        document.getElementById("fHr").value = record.hr;

        document.getElementById("fDemam").value = record.demam;
        document.getElementById("fDemamNote").value = record.demamNote === "-" ? "" : record.demamNote;
        toggleAnamnesisNote('fDemam', 'fDemamNote');

        document.getElementById("fTenggorokan").value = record.tenggorokan;
        document.getElementById("fTenggorokanNote").value = record.tenggorokanNote === "-" ? "" : record.tenggorokanNote;
        toggleAnamnesisNote('fTenggorokan', 'fTenggorokanNote');

        document.getElementById("fObat").value = record.obat;
        document.getElementById("fObatNote").value = record.obatNote === "-" ? "" : record.obatNote;
        toggleAnamnesisNote('fObat', 'fObatNote');

        document.getElementById("fRs").value = record.rs;
        document.getElementById("fRsNote").value = record.rsNote === "-" ? "" : record.rsNote;
        toggleAnamnesisNote('fRs', 'fRsNote');
    }

    document.getElementById("formSection").scrollIntoView({ behavior: 'smooth' });
}

function hideFormSection() {
    // Jika user menekan batal saat baru membuat data baru, hapus draft kosong dari storage
    if (isNewDraft && currentEditId) {
        masterRecords = masterRecords.filter(r => r.id !== currentEditId);
        localStorage.setItem("skrining_records", JSON.stringify(masterRecords));
    }
    document.getElementById("formSection").style.display = "none";
    currentEditId = null;
    isNewDraft = false;
    renderTableRows();
}

// --- HANDLER SUBMIT DATA ---
function handleFormSubmit(e) {
    e.preventDefault();

    // Pastikan kita mengambil data storage paling baru lagi untuk menghindari overwriting tab lain
    const savedRecords = localStorage.getItem("skrining_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    const idValue = document.getElementById("fId").value;

    const record = {
        id: idValue,
        namaSingkat: (document.getElementById("fNamaSingkat").value).toUpperCase().trim(),
        nik: document.getElementById("fNik").value || "",
        jk: document.getElementById("fJk").value || "",
        ttl: document.getElementById("fTtl").value || "",
        namaLengkap: document.getElementById("fNamaLengkap").value.trim() || "",
        ortu: document.getElementById("fOrtu").value.trim() || "",
        hp: document.getElementById("fHp").value.trim() || "",
        pekerjaan: document.getElementById("fPekerjaan").value.trim() || "",

        bb: document.getElementById("fBb").value.trim() || "",
        tb: document.getElementById("fTb").value.trim() || "",
        td: document.getElementById("fTd").value.trim() || "",
        hr: document.getElementById("fHr").value.trim() || "",

        demam: document.getElementById("fDemam").value || "",
        demamNote: document.getElementById("fDemamNote").value.trim() || "",
        tenggorokan: document.getElementById("fTenggorokan").value || "",
        tenggorokanNote: document.getElementById("fTenggorokanNote").value.trim() || "",
        obat: document.getElementById("fObat").value || "",
        obatNote: document.getElementById("fObatNote").value.trim() || "",
        rs: document.getElementById("fRs").value || "",
        rsNote: document.getElementById("fRsNote").value.trim() || ""
    };

    const index = masterRecords.findIndex(r => r.id === idValue);
    if (index !== -1) {
        masterRecords[index] = record; // Ganti draft/data eksis dengan data final
    } else {
        masterRecords.unshift(record);
    }

    localStorage.setItem("skrining_records", JSON.stringify(masterRecords));
    isNewDraft = false;
    currentEditId = null;

    document.getElementById("formSection").style.display = "none";
    renderTableRows();

    if (configSession.modReg && printer) {
        triggerRectaPrint(idValue);
    }
    // alert("✅ Data berhasil disimpan di LocalStorage perangkat!");
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

    if (configSession.modReg) {
        headers.push("<th>NIK</th>", "<th>JK</th>", "<th>Tanggal Lahir</th>", "<th>Nama Lengkap</th>", "<th>Orang Tua</th>", "<th>No. HP</th>", "<th>Pekerjaan Ortu</th>");
    }
    if (configSession.modAntro) {
        headers.push("<th>BB (kg)</th>", "<th>TB (cm)</th>", "<th>T. Darah</th>", "<th>HR (bpm)</th>", "<th>Demam</th>", "<th>Sakit Tenggorokan</th>", "<th>Konsumsi Obat</th>", "<th>Rawat RS</th>");
    }
    tr.innerHTML = headers.join("");
}

function renderTableRows() {
    const savedRecords = localStorage.getItem("skrining_records");
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
        if (configSession.modReg) {
            actionContent += `<button onclick="triggerRectaPrint('${rec.id}')" title="Cetak Barcode" style="border:none; background:none; cursor:pointer; font-size:15px;">🖨️</button>`;
        }

        let rowCells = [
            `<td>${actionContent}</td>`,
            `<td><strong>${rec.id}</strong></td>`,
            `<td>${rec.namaSingkat}</td>`
        ];

        if (configSession.modReg) {
            rowCells.push(`<td>${rec.nik || "-"}</td>`, `<td>${rec.jk}</td>`, `<td>${rec.ttl}</td>`, `<td>${rec.namaLengkap}</td>`, `<td>${rec.ortu}</td>`, `<td>${rec.hp}</td>`, `<td>${rec.pekerjaan}</td>`);
        }
        if (configSession.modAntro) {
            rowCells.push(
                `<td>${rec.bb}</td>`, `<td>${rec.tb}</td>`, `<td>${rec.td}</td>`, `<td>${rec.hr}</td>`,
                `<td>${rec.demam === "Ya" ? "Ya (" + rec.demamNote + ")" : "Tidak"}</td>`,
                `<td>${rec.tenggorokan === "Ya" ? "Ya (" + rec.tenggorokanNote + ")" : "Tidak"}</td>`,
                `<td>${rec.obat === "Ya" ? "Ya (" + rec.obatNote + ")" : "Tidak"}</td>`,
                `<td>${rec.rs === "Ya" ? "Ya (" + rec.rsNote + ")" : "Tidak"}</td>`
            );
        }

        tr.innerHTML = rowCells.join("");
        tbody.appendChild(tr);
    });
}

// --- FUNCTION UPLOAD (PLACEHOLDER INTEGRASI CLOUD) ---
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjwYJqjYx9_Z0x-2ssJPvadfGUL0Ze7hyOtBEkfwKaB4R6OmLCbwNfrpj57ByZ7_m2/exec";

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
                // mode: "no-cors", // Optional: use if you don't need to read the response body
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
                alert("🎉 SELESAI! " + result.message);
                // Aktifkan tombol reset jika data sudah dipastikan aman masuk cloud
                alert("Silakan klik 'Akhiri Sesi' jika ingin menghapus memori lokal tablet untuk sesi baru.");
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
}

function clearAllDataSession() {
    if (confirm("Reset sesi saat ini? Semua data rekap di perangkat ini akan dibersihkan.")) {
        localStorage.removeItem("skrining_config");
        localStorage.removeItem("skrining_records");
        location.reload();
    }
}

// --- LOGIKA MODAL CONTROL & INTEGRASI RECTA ---
let printer = null;

function openAkhiriSesiModal() {
    document.getElementById("modalAkhiriSesi").style.display = "flex";
}

function openPrinterModal() {
    document.getElementById("pRectaKey").value = localStorage.getItem("RECTA_KEY") || "";
    document.getElementById("pRectaPort").value = localStorage.getItem("RECTA_PORT") || "1811";
    document.getElementById("printerStatusText").innerText = printer ? "🟢 Printer Terhubung" : "⚪ Printer Belum Terhubung";
    document.getElementById("printerStatusText").style.color = printer ? "#28a745" : "#555";
    document.getElementById("modalPrinter").style.display = "flex";
}

function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

function connectPrinter() {
    const key = document.getElementById("pRectaKey").value.trim();
    const port = document.getElementById("pRectaPort").value.trim();
    const statusText = document.getElementById("printerStatusText");

    statusText.innerText = "Mencoba menyambungkan...";
    statusText.style.color = "#ffc107";

    // Inisialisasi Recta berbasis input user
    printer = new Recta(key, port);

    printer.open().then(() => {
        localStorage.setItem("RECTA_KEY", key);
        localStorage.setItem("RECTA_PORT", port);
        statusText.innerText = "🟢 Printer Berhasil Terhubung!";
        statusText.style.color = "#28a745";
        setTimeout(() => closeModal('modalPrinter'), 1200);
    }).catch((e) => {
        printer = null;
        statusText.innerText = "🚨 Error Koneksi: " + e.toString();
        statusText.style.color = "#dc3545";
    });
}

function actualResetSesi() {
    if (confirm("Reset sesi saat ini? Semua data rekap di perangkat ini akan dibersihkan secara permanen.")) {
        // Logika penghapusan localstorage
        localStorage.removeItem("skrining_config");
        localStorage.removeItem("skrining_records");
        location.reload();
    }
}

// Fungsi Trigger Cetak Struk via Recta Host
function triggerRectaPrint(id) {
    if (!printer) return; // Abaikan jika printer tidak di-setup
    const record = masterRecords.find(r => r.id === id);
    if (!record) return;

    printer.align('center')
        .text('SCREENING JANTUNG')
        .barcode('CODE128', record.id + "_" + record.namaSingkat)
        .mode('A', true, true, true, false)
        .text(record.id)
        .mode('A', false, false, false, false)
        .align('left')
        .text("Nama: " + record.namaSingkat)
        .text("JK: " + record.jk)
        .text("T. Lahir: " + record.ttl)
        .feed(4)
        .print();
}

let idScannerInstance = new Html5Qrcode("idReader");

function openScannerIdModal() {
    document.getElementById("modalScannerId").style.display = "flex";
    const config = { fps: 20, qrbox: { width: 260, height: 120 }, aspectRatio: 1.0 };

    idScannerInstance.start(
        { facingMode: "environment" },
        config,
        (scannedText) => {
            // Masukkan hasil scan langsung ke field ID Peserta
            document.getElementById("fId").value = scannedText.split("_")[0].trim();
            // Pemicu pengecekan otomatis apakah ID ini sudah ada rekap draft-nya di localstorage
            // checkDuplicate(scannedText.trim());
            closeScannerIdModal();
        }
    ).catch(err => console.error("Kamera ID Error: ", err));
}

function closeScannerIdModal() {
    if (idScannerInstance.isScanning) {
        idScannerInstance.stop().then(() => {
            // document.getElementById("idReader").innerHTML = "";
            document.getElementById("modalScannerId").style.display = "none";
            // idScannerInstance = null;
        });
    } else {
        document.getElementById("modalScannerId").style.display = "none";
    }
}