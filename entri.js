// --- KONFIGURASI STATE UTAMA ---
let configSession = {};
let masterRecords = [];
let currentEditId = null;
let isNewDraft = false;
const modeID = "5 digit"; // Default mode ID, bisa diubah ke "5 digit" jika ingin pakai format ID pendek internal
let listSekolah = {
    "Malang": [
        "SD 1 Malang",
        "SD 2 Malang"
    ],
    "Bekasi": []
}

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
    regis: {
        nik: ["NIK Peserta", "fNik"],
        nisn: ["NISN Peserta", "fNisn"],
        namaLengkap: ["Nama Lengkap", "fNamaLengkap"],
        namaSekolah: ["Nama Sekolah", "fNamaSekolah"],
        jk: ["Jenis Kelamin", "fJk"],
        ttl: ["Tanggal Lahir", "fTtl"],
        ortu: ["Nama Ortu", "fOrtu"],
        nikOrtu: ["NIK Ortu", "fNikOrtu"],
        pekerjaan: ["Pekerjaan Ortu", "fPekerjaan"],
        hp: ["No. HP", "fHp"],
    },
    antro: {
        bb: ["BB (kg)", "fBb"],
        tb: ["TB (cm)", "fTb"],
        td: ["T. Darah (mmHg)", "fTd"],
        hr: ["HR (bpm)", "fHr"],
    }
}

function safeLocalStorageSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert("💾 Peringatan: Memori penyimpanan perangkat penuh!\n\nHapus data lama atau upload ke cloud untuk membebaskan ruang.");
        } else {
            alert("🚨 Gagal menyimpan data: " + error.message);
        }
        return false;
    }
}

function safeLocalStorageParse(key, defaultValue = []) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error("Error parsing localStorage", error);
        return defaultValue;
    }
}

// Sinkronisasi Data Awal dari LocalStorage
document.addEventListener("DOMContentLoaded", () => {
    const savedConfig = localStorage.getItem("entri_config");
    const savedRecords = localStorage.getItem("entri_records");

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
            alert("⚠️ Kesalahan Input: NIK Peserta harus tepat 16 digit!");
            setTimeout(() => this.focus(), 10);
        } else if (this.value.substring(15, 16) == '0') {
            resetAutoNikFields();
            alert("⚠️ Kesalahan Input: NIK Peserta tidak valid, digit terakhir tidak boleh 0!");
            setTimeout(() => this.focus(), 10);
        }
    });

    document.getElementById("fNikOrtu").addEventListener("blur", function () {
        if (this.value.length > 0 && this.value.length !== 16) {
            alert("⚠️ Kesalahan Input: NIK Orang Tua / Wali harus tepat 16 digit!");
            setTimeout(() => this.focus(), 10);
        } else if (this.value.substring(15, 16) == '0') {
            resetAutoNikFields();
            alert("⚠️ Kesalahan Input: NIK Orang Tua / Wali tidak valid, digit terakhir tidak boleh 0!");
            setTimeout(() => this.focus(), 10);
        }
    });

    document.getElementById("fId").addEventListener("blur", function (e) {
        if (this.value.length > 0 && (modeID == "7 digit" ? this.value.length !== 7 : this.value.length !== 5) && e.relatedTarget.id !== "cancelBtn") {
            alert("⚠️ Kesalahan Input: ID harus tepat " + (modeID == "7 digit" ? "7" : "5") + " digit!");
            setTimeout(() => this.focus(), 10);
        }
    });

    document.getElementById("fNik").addEventListener("input", function () {
        if (this.value.length === 16) {
            parseDataFromNik(this.value);
        } else {
            resetAutoNikFields();
        }
    });

    document.getElementById("maxNameLength").innerText = modeID === "7 digit" ? "6" : "8"; // Update teks batas maksimal karakter nama singkat sesuai dengan atribut maxlength
    document.getElementById("fId").setAttribute("minlength", modeID === "7 digit" ? "7" : "5");
    document.getElementById("fId").setAttribute("maxlength", modeID === "7 digit" ? "7" : "5");
    document.getElementById("fNamaSingkat").setAttribute("maxlength", modeID === "7 digit" ? "6" : "8");

    // Auto-reconnect printer jika tersimpan di localStorage (untuk persistence)
    const savedRectak = localStorage.getItem("RECTA_KEY");
    const savedPort = localStorage.getItem("RECTA_PORT");
    if (savedRectak && savedPort && configSession.modReg) {
        printer = new Recta(savedRectak, savedPort);
        printer.open().catch(() => {
            printer = null; // Silent fail, user bisa setup ulang jika perlu
        });
    }
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
    if (parseInt(meja) < 1 || parseInt(meja) > 9) return alert("Nomor meja harus antara 1-9!");
    if (!modReg && !modAntro) return alert("Pilih minimal satu modul!");
    if (modReg && (!meja || parseInt(meja) < 1)) return alert("Isi nomor Meja Registrasi!");

    configSession = { wilayah, kodeLokasi, modReg, modAntro, meja };
    if (!safeLocalStorageSetItem("entri_config", JSON.stringify(configSession))) return;
    if (!safeLocalStorageSetItem("RECTA_KEY", appkey)) return;
    if (!safeLocalStorageSetItem("RECTA_PORT", appport)) return;

    if (!localStorage.getItem("entri_records")) {
        safeLocalStorageSetItem("entri_records", JSON.stringify([]));
        masterRecords = [];
    }

    document.getElementById("daftar-sekolah").innerHTML = listSekolah[configSession.wilayah]?.map(school => `<option value="${school}"></option>`).join('') || '';

    // Sisipkan di dalam initSession() sebelum showMainDashboard()
    const csvFile = document.getElementById("fImportCsv").files[0];
    if (csvFile) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            prosesParsingDataCsv(text);
        };
        reader.readAsText(csvFile);
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
function encodeId5digit(id) {

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
function decodeId5digit(id) {

    id = id.toString()
    const d1 = Math.floor((decodeCrockford32(id.substring(0, 1)) - 1) / 3) + 1;
    const d2_3 = (decodeCrockford32(id.substring(0, 2)) - ((((d1 - 1) * 3) + 1) * 32)).toString().padStart(2, '0');
    const d4 = id.substring(2, 3);
    const d5_7 = decodeCrockford32(id.substring(3, 5)).toString().padStart(3, '0');
    return parseInt(`${d1}${d2_3}${d4}${d5_7}`);
}

// --- MULTI-TAB SAFE ID GENERATOR ---
function generateSequentialID() {
    let prefix;
    if (modeID == "7 digit") {
        const wMap = { "Malang": 1, "Bekasi": 2, "Lampung": 3, "Minahasa Utara": 4 };
        const d1 = wMap[configSession.wilayah] || 0;
        const d2_3 = String(configSession.kodeLokasi).padStart(2, '0');
        const d4 = configSession.modReg ? configSession.meja : "0"; // 0 jika modul reg mati
        prefix = `${d1}${d2_3}${d4}`;
    } else {
        const vMap = { "Malang": 1, "Bekasi": 4, "Lampung": 7, "Minahasa Utara": 10 };
        const d1_2 = (vMap[configSession.wilayah] || 0) * 32 // jadikan digit ke2
            + parseInt(configSession.kodeLokasi) // tambah kode lokasi
        const d3 = configSession.modReg ? configSession.meja : "0";
        prefix = `${encodeCrockford32(d1_2)}${d3}`;
    }

    let currentCounter = 1;
    masterRecords.forEach(rec => {
        if (rec.id && rec.id.startsWith(prefix)) {
            const lastDigit = modeID == "7 digit" ? parseInt(rec.id.substring(4, 7))
                : decodeCrockford32(rec.id.substring(3, 5));
            if (lastDigit >= currentCounter) {
                currentCounter = lastDigit + 1;
            }
        }
    });

    return `${prefix}${modeID === "7 digit" ? String(currentCounter).padStart(3, '0') : encodeCrockford32(currentCounter).padStart(2, '0')}`;
}

// ALUR BARU: Klik Tambah Langsung Amankan ID Ke LocalStorage (Mencegah Tab Balapan)
function createAndReserveNewPatient() {
    if (configSession.modReg) {
        // 1. Ambil data segar dari localStorage dulu (Cek aktivitas tab sebelah)
        const savedRecords = localStorage.getItem("entri_records");
        masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

        // 2. Buat ID unik berdasarkan data paling update
        const newId = generateSequentialID();

        // 3. Buat draft kosong
        const newDraft = {
            id: newId,
            namaSingkat: "DRAFT", isDraft: true
        };

        // 4. Langsung kunci ke Storage utama
        masterRecords.unshift(newDraft);
        if (!safeLocalStorageSetItem("entri_records", JSON.stringify(masterRecords))) return;

        // 5. Buka form dalam mode edit untuk ID draft tersebut
        isNewDraft = true;
        checkPreRegVisibility();
        loadRecordToEdit(newId);
    } else {
        loadRecordToEdit(); // Mode input baru tanpa ID khusus jika modul Registrasi mati
    }
}



function loadRecordToEdit(id = null) {
    // Ambil data paling fresh dari storage sebelum memuat ke form
    const savedRecords = localStorage.getItem("entri_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    let record = null;
    let shownId = null;
    if (id) {
        record = masterRecords.find(r => r.id === id);
        if (!record) {
            if (configSession.modReg) { console.log(masterRecords); return; }
            document.getElementById("formTitle").innerText = "Form Antropometri Pasien";
            document.getElementById("formSection").style.display = "block";
        } else if (configSession.modReg) {
            currentEditId = id;
            shownId = record.id;
            document.getElementById("formTitle").innerText = record.isDraft ? "Form Pasien Baru (ID: " + shownId + ")" : "Edit Data Pasien (ID: " + shownId + ")";
            document.getElementById("formSection").style.display = "block";

            document.getElementById("fId").value = shownId;
            document.getElementById("fNamaSingkat").focus();
        }
    } else {
        // if (!record) { //??
        document.getElementById("fId").disabled = false;
        // }
        document.getElementById("formTitle").innerText = "Form Antropometri Pasien";
        document.getElementById("formSection").style.display = "block";
        document.getElementById("fId").focus();
    }

    if (configSession.modReg && record) {
        document.getElementById("fNamaSingkat").value = record.isDraft ? "" : record.namaSingkat;

        for (const [key, [label, fieldId]] of Object.entries(recordLabel.regis)) {
            document.getElementById(fieldId).value = record.isDraft ? "" : record[key] || "";
        }

        if (record.nik && record.nik.length === 16) {
            document.getElementById("fJk").disabled = true;
            document.getElementById("fTtl").disabled = true;
        } else {
            document.getElementById("fJk").disabled = false;
            document.getElementById("fTtl").disabled = false;
        }
    }

    if (configSession.modAntro && record) {
        for (const [key, [label, fieldId]] of Object.entries(recordLabel.antro)) {
            document.getElementById(fieldId).value = record.isDraft ? "" : record[key] || "";
        }

        document.getElementById("fDemam").value = record.isDraft ? "" : record.demam;
        document.getElementById("fDemamNote").value = record.isDraft ? "" : (record.demamNote === "-" ? "" : record.demamNote);
        toggleAnamnesisNote('fDemam', 'fDemamNote');

        document.getElementById("fTenggorokan").value = record.isDraft ? "" : record.tenggorokan;
        document.getElementById("fTenggorokanNote").value = record.isDraft ? "" : (record.tenggorokanNote === "-" ? "" : record.tenggorokanNote);
        toggleAnamnesisNote('fTenggorokan', 'fTenggorokanNote');

        document.getElementById("fObat").value = record.isDraft ? "" : record.obat;
        document.getElementById("fObatNote").value = record.isDraft ? "" : (record.obatNote === "-" ? "" : record.obatNote);
        toggleAnamnesisNote('fObat', 'fObatNote');

        document.getElementById("fRs").value = record.isDraft ? "" : record.rs;
        document.getElementById("fRsNote").value = record.isDraft ? "" : (record.rsNote === "-" ? "" : record.rsNote);
        toggleAnamnesisNote('fRs', 'fRsNote');
    }

    document.getElementById("formSection").scrollIntoView({ behavior: 'smooth' });
}

function hideFormSection() {
    // Jika user menekan batal saat baru membuat data baru, hapus draft kosong dari storage
    if (isNewDraft && currentEditId) {
        masterRecords = masterRecords.filter(r => r.id !== currentEditId);
        safeLocalStorageSetItem("entri_records", JSON.stringify(masterRecords));
    }
    document.getElementById("formSection").style.display = "none";
    currentEditId = null;
    isNewDraft = false;
    renderTableRows();
}

function confirmAndDeleteRecord() {
    const id = document.getElementById("fId").value.trim();
    if (confirm("⚠️ Apakah Anda yakin ingin menghapus data ID: " + id + "? Tindakan ini tidak dapat dibatalkan!")) {
        masterRecords = masterRecords.filter(r => r.id !== id);
        safeLocalStorageSetItem("entri_records", JSON.stringify(masterRecords));
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
    const savedRecords = localStorage.getItem("entri_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    const idValue = document.getElementById("fId").value.trim();
    const namaSingkatValue = document.getElementById("fNamaSingkat").value.trim();

    // Validasi input wajib
    if (!idValue) return alert("⚠️ ID Peserta wajib diisi!");
    if (!namaSingkatValue) return alert("⚠️ Nama Singkat wajib diisi!");

    // Cek apakah ID sudah ada (duplicate check)
    const recordId = idValue;
    const existingRecord = masterRecords.find(r => r.id === recordId);
    if (existingRecord && !existingRecord.isDraft) {
        if (!confirm(`ID ${idValue} sudah ada di data. Overwrite data lama?`)) return;
    }

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

    const index = masterRecords.findIndex(r => r.id === idValue);
    if (index !== -1) {
        masterRecords[index] = record; // Ganti draft/data eksis dengan data final
    } else {
        masterRecords.unshift(record);
    }

    if (!safeLocalStorageSetItem("entri_records", JSON.stringify(masterRecords))) return;
    isNewDraft = false;
    currentEditId = null;

    document.getElementById("formSection").style.display = "none";
    renderTableRows();
    kosongkanFormInput();

    if (configSession.modReg && printer) {
        triggerRectaPrint(idValue);
    }
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

    if (configSession.modReg) {
        for (let key in recordLabel.regis) {
            headers.push(`<th>${recordLabel.regis[key][0]}</th>`);
        }
    }
    if (configSession.modAntro) {
        for (let key in recordLabel.antro) {
            headers.push(`<th>${recordLabel.antro[key][0]}</th>`);
        }
        headers.push("<th>Demam</th>", "<th>Sakit Tenggorokan</th>", "<th>Konsumsi Obat</th>", "<th>Rawat RS</th>");
    }
    tr.innerHTML = headers.join("");
}

function renderTableRows() {
    const savedRecords = localStorage.getItem("entri_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    // const validRecords = masterRecords.filter(r => !r.isDraft);
    const validRecords = masterRecords

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

        let shownId = rec.id;

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
async function uploadDataToCloud() {
    // Validasi GAS URL sudah dikonfigurasi
    const GAS_URL = localStorage.getItem("GAS_URL");
    if (!GAS_URL) {
        return alert("🚨 Error: Google Apps Script URL belum dikonfigurasi. Hubungi administrator.");
    }

    // Reload data paling terbaru dari localStorage untuk avoid stale data
    const savedRecords = localStorage.getItem("entri_records");
    masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

    // Ambil rekap data paling valid dan singkirkan draft kosong
    const validRecords = masterRecords.filter(r => !r.isDraft);
    const kodeakses = document.getElementById("fAccessCodeCloud").value.trim();
    if (validRecords.length === 0) return alert("❌ Tidak ada data valid yang bisa diupload saat ini.");
    if (!kodeakses) return alert("⚠️ Kode Akses wajib diisi untuk otorisasi unggah data ke Google Sheets!");

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
    if (confirm(t)) {
        localStorage.removeItem("entri_config");
        localStorage.removeItem("entri_records");
        location.reload();
    }
}

// FUNGSI OPSI 2: JIKA INGIN KEMBALI KARENA INGIN UPLOAD ULANG
function rollbackToUploadMenu() {
    // Tutup modal verifikasi, balikkan ke modal input kode akses awal
    document.getElementById("modalVerifikasiCloud").style.display = "none";
    document.getElementById("modalAkhiriSesi").style.display = "flex";
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

// Fungsi Trigger Cetak Struk via Recta Host
function triggerRectaPrint(id) {
    if (!printer) return; // Abaikan jika printer tidak di-setup
    const record = masterRecords.find(r => r.id === id);
    if (!record) return;
    let shownId = record.id;
    const antrian = String.fromCharCode(64 + parseInt(shownId.substring(2, 3))) + decodeCrockford32(shownId.substring(3, 5)).toString().padStart(3, '0');

    printer.align('center')
        .text('SCREENING RHD YJI 2026')
        .text('-----------------')
        .mode('A', true, true, true, false)
        .text("Antrian: " + antrian)
        .mode('A', false, false, false, false)
        .feed(1)
        .qrcode(16, shownId + "_" + record.namaSingkat)
        .feed(1)
        .mode('A', true, true, true, false)
        .text("ID: " + shownId)
        .text(record.namaSingkat)
        .mode('A', false, false, false, false)
        .feed(1)
        .align('left')
        .text("Nama: " + record.namaLengkap)
        .text("JK: " + record.jk)
        .text("T. Lahir: " + record.ttl)
        .feed(4)
        .print();
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
    ).catch(err => {
        console.error("Kamera ID Error: ", err);
        // Tampilkan pesan error yang user-friendly
        const errorMsg = err.toString().toLowerCase();
        let msg = "Gagal mengakses kamera. ";
        if (errorMsg.includes("permission") || errorMsg.includes("denied")) {
            msg += "Izinkan akses kamera di pengaturan browser Anda.";
        } else if (errorMsg.includes("not found")) {
            msg += "Kamera tidak ditemukan.";
        } else {
            msg += "Coba lagi atau gunakan input manual.";
        }
        alert("⚠️ " + msg);
        closeScannerIdModal();
    });
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

// CSV!!!
let preRegisteredDatabase = [];

// Fungsi memotong baris teks CSV menjadi Array Objek
function prosesParsingDataCsv(text) {
    const lines = text.split("\n");
    let parsedData = [];

    // Looping dimulai dari indeks 1 untuk melewati Header baris pertama CSV
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Memisah kolom menggunakan pemisah semikolon (;)
        const columns = line.split(";");
        if (columns.length >= 4) {
            parsedData.push({
                nik: columns[0] ? columns[0].trim() : "",
                namaLengkap: columns[1] ? columns[1].trim() : "",
                jk: columns[2] ? columns[2].trim() : "",
                ttl: columns[3] ? columns[3].trim() : "",
                ortu: columns[4] ? columns[4].trim() : "-",
                hp: columns[5] ? columns[5].trim() : "-"
            });
        }
    }

    if (parsedData.length > 0) {
        safeLocalStorageSetItem("prereg_database", JSON.stringify(parsedData));
        preRegisteredDatabase = parsedData;
        console.log(`Successfully loaded ${parsedData.length} data target sasaran.`);
    }
}

// Pemicu pengecekan apakah ada data sasaran saat form tambah data dibuka
// (Panggil fungsi ini di dalam fungsi createAndReserveNewPatient() Dokter)
function checkPreRegVisibility() {
    if (preRegisteredDatabase.length === 0) {
        preRegisteredDatabase = safeLocalStorageParse("prereg_database");
    }

    // Tampilkan kotak pencarian jika database CSV tidak kosong
    const wrapper = document.getElementById("searchPreRegWrapper");
    if (wrapper) {
        wrapper.style.display = preRegisteredDatabase.length > 0 ? "block" : "none";
    }
}

// --- LOGIKA PENCERIAN PINTAR MULTI-ELEMEN ---
function handlePreRegSearch() {
    const query = document.getElementById("fSearchPreRegInput").value.toLowerCase().trim();
    const dropdown = document.getElementById("preRegResultsDropdown");

    if (!query || query.length < 2) {
        dropdown.style.display = "none";
        return;
    }

    // Pecah keyword pencarian berdasarkan spasi untuk mendukung filter ganda
    // Misal: keyword "15-08" dan "Ahmad" harus ada semua dalam satu baris data
    const keywords = query.split(" ");

    // Saring database berdasarkan seluruh keyword yang diinput
    const filtered = preRegisteredDatabase.filter(anak => {
        const gabunganTeksData = `${anak.nik} ${anak.namaLengkap.toLowerCase()} ${anak.ttl}`;
        return keywords.every(kw => gabunganTeksData.includes(kw));
    });

    // Render hasil saringan ke dalam dropdown ui
    dropdown.innerHTML = "";
    if (filtered.length === 0) {
        dropdown.innerHTML = `<div style="padding: 10px; color: #999; font-size: 13px; text-align: center;">Data anak tidak ditemukan dalam target sasaran...</div>`;
    } else {
        // Batasi maksimal menampilkan 10 hasil teratas agar performa tetap enteng
        filtered.slice(0, 10).forEach(anak => {
            const div = document.createElement("div");
            div.style.padding = "10px 12px";
            div.style.borderBottom = "1px solid #eee";
            div.style.cursor = "pointer";
            div.style.fontSize = "13px";
            div.style.textAlign = "left";
            div.innerHTML = `<strong>${anak.namaLengkap}</strong> (${anak.jk === "Laki-laki" ? 'L' : 'P'}) <br> <small style="color:#666;">NIK: ${anak.nik || '-'} | TTL: ${anak.ttl}</small>`;

            // Aksi saat item hasil pencarian diklik: Autofill langsung mengisi form!
            div.onclick = function () {
                autofillFormFromPreReg(anak);
                dropdown.style.display = "none";
                document.getElementById("fSearchPreRegInput").value = "";
            };
            dropdown.appendChild(div);
        });
    }
    dropdown.style.display = "block";
}

// --- FUNGSIONALITAS AUTOFILL DATA KE FORM ---
function autofillFormFromPreReg(anak) {
    // 1. Ekstrak nama singkat (Maksimal 6 huruf pertama sebagai konfirmatori sesuai rules Dokter)
    const namaSingkatOtomatis = anak.namaLengkap.split(" ")[0].substring(0, 6).toUpperCase();

    document.getElementById("fNamaSingkat").value = namaSingkatOtomatis;
    document.getElementById("fNik").value = anak.nik;
    document.getElementById("fNamaLengkap").value = anak.namaLengkap;
    document.getElementById("fOrtu").value = anak.ortu;
    document.getElementById("fHp").value = anak.hp;
    document.getElementById("fTtl").value = anak.ttl;
    document.getElementById("fJk").value = anak.jk;

    // Jika data dari CSV memiliki NIK lengkap, jalankan fungsi penguncian otomatis Dokter
    if (anak.nik && anak.nik.length === 16) {
        document.getElementById("fJk").disabled = true;
        document.getElementById("fTtl").disabled = true;
        if (typeof document.getElementById("noteJk") !== 'undefined') {
            document.getElementById("noteJk").innerText = "Terisi otomatis dari database sasaran.";
            document.getElementById("noteTtl").innerText = "Terisi otomatis dari database sasaran.";
        }
    } else {
        document.getElementById("fJk").disabled = false;
        document.getElementById("fTtl").disabled = false;
    }

    alert(`⚡ Autofill Berhasil: Data ${anak.namaLengkap} berhasil dimuat ke form!`);
}