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
    document.getElementById("fNamaSingkat").setAttribute("maxlength", modeID === "7 digit" ? "6" : "8");
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
    localStorage.setItem("entri_config", JSON.stringify(configSession));
    localStorage.setItem("RECTA_KEY", appkey);
    localStorage.setItem("RECTA_PORT", appport);

    if (!localStorage.getItem("entri_records")) {
        localStorage.setItem("entri_records", JSON.stringify([]));
        masterRecords = [];
    }

    document.getElementById("daftar-sekolah").innerHTML = listSekolah[configSession.wilayah]?.map(school => `<option value="${school}"></option>`).join('') || '';

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

// --- MULTI-TAB SAFE ID GENERATOR ---
function generateSequentialID() {
    const wMap_7 = { "Malang": 1, "Bekasi": 2, "Lampung": 3, "Minahasa Utara": 4 };
    const d1_7 = wMap_7[configSession.wilayah] || 0;
    const d2_3_7 = String(configSession.kodeLokasi).padStart(2, '0');
    const d4_7 = configSession.modReg ? configSession.meja : "0"; // 0 jika modul reg mati
    const prefix_7 = `${d1_7}${d2_3_7}${d4_7}`;

    let currentCounter = 1;
    masterRecords.forEach(rec => {
        if (rec.id && rec.id.startsWith(prefix_7)) {
            const lastThree = parseInt(rec.id.substring(4, 7));
            if (lastThree >= currentCounter) {
                currentCounter = lastThree + 1;
            }
        }
    });

    const id_7digit = `${prefix_7}${String(currentCounter).padStart(3, '0')}`;
    const id_5digit = `${encodeId5digit(id_7digit)}`;

    return [id_7digit, id_5digit];
}

// ALUR BARU: Klik Tambah Langsung Amankan ID Ke LocalStorage (Mencegah Tab Balapan)
function createAndReserveNewPatient() {
    if (configSession.modReg) {
        // 1. Ambil data segar dari localStorage dulu (Cek aktivitas tab sebelah)
        const savedRecords = localStorage.getItem("entri_records");
        masterRecords = savedRecords ? JSON.parse(savedRecords) : [];

        // 2. Buat ID unik berdasarkan data paling update
        const newId = generateSequentialID()[0]; // Kita pakai format ID 7-digit untuk registrasi
        const newId_5 = generateSequentialID()[1]; // ID format pendek untuk keperluan internal/antro jika diperlukan

        // 3. Buat draft kosong
        const newDraft = {
            id: newId,
            id_5: newId_5,
            namaSingkat: "DRAFT KOSONG", isDraft: true
        };

        // 4. Langsung kunci ke Storage utama
        masterRecords.unshift(newDraft);
        localStorage.setItem("entri_records", JSON.stringify(masterRecords));

        // 5. Buka form dalam mode edit untuk ID draft tersebut
        isNewDraft = true;
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
        if (!record) return;

        currentEditId = id;
        shownId = modeID == "7 digit" ? record.id : record.id_5;
        document.getElementById("formTitle").innerText = record.isDraft ? "Form Pasien Baru (ID: " + shownId + ")" : "Edit Data Pasien (ID: " + shownId + ")";
        document.getElementById("formSection").style.display = "block";

        document.getElementById("fId").value = shownId;
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
        localStorage.setItem("entri_records", JSON.stringify(masterRecords));
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

    const idValue = document.getElementById("fId").value;

    const record = {
        id: (modeID == "7 digit" ? idValue : decodeId5digit(idValue)),
        id_5: (modeID == "7 digit" ? null : idValue),
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

    const index = masterRecords.findIndex(r => r.id === (modeID == "7 digit" ? idValue : decodeId5digit(idValue)));
    if (index !== -1) {
        masterRecords[index] = record; // Ganti draft/data eksis dengan data final
    } else {
        masterRecords.unshift(record);
    }

    localStorage.setItem("entri_records", JSON.stringify(masterRecords));
    isNewDraft = false;
    currentEditId = null;

    document.getElementById("formSection").style.display = "none";
    renderTableRows();

    if (configSession.modReg && printer) {
        triggerRectaPrint((modeID == "7 digit" ? idValue : decodeId5digit(idValue)));
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
                // alert("Silakan klik 'Akhiri Sesi' jika ingin menghapus memori lokal tablet untuk sesi baru.");
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
        localStorage.removeItem("entri_config");
        localStorage.removeItem("entri_records");
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
        localStorage.removeItem("entri_config");
        localStorage.removeItem("entri_records");
        location.reload();
    }
}

// Fungsi Trigger Cetak Struk via Recta Host
function triggerRectaPrint(id) {
    if (!printer) return; // Abaikan jika printer tidak di-setup
    const record = masterRecords.find(r => r.id === id);
    if (!record) return;
    let shownId = modeID == "7 digit" ? record.id : record.id_5

    printer.align('center')
        .text('SCREENING JANTUNG')
        .text('-----------------')
        .barcode('CODE128', shownId + "_" + record.namaSingkat)
        .feed(1)
        .mode('A', true, true, true, false)
        .text(shownId)
        .text("Nama: " + record.namaSingkat)
        .mode('A', false, false, false, false)
        .feed(1)
        .align('left')
        .text("JK: " + record.jk)
        .text("T. Lahir: " + record.ttl)
        .feed(4)
        .print();
}

let idScannerInstance = new Html5Qrcode("idReader");
let currentCameraId = null;
let availableCameras = [];
let isTorchOn = false;

function toggleScannerIdModal() {
    const text = document.getElementById("scannerControls");
    if (text.style.display === "block") {
        closeScannerIdModal();
    } else {
        text.style.display = "block";
        const config = {
            fps: 15,
            // qrbox: { width: 260, height: 120 },
            // aspectRatio: 1.0
        };

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
}

function closeScannerIdModal() {
    if (idScannerInstance.isScanning) {
        idScannerInstance.stop().then(() => {
            // document.getElementById("idReader").innerHTML = "";
            document.getElementById("scannerControls").style.display = "none";
            // idScannerInstance = null;
        });
    } else {
        document.getElementById("scannerControls").style.display = "none";
        // document.getElementById("modalScannerId").style.position = "absolute";
    }
}