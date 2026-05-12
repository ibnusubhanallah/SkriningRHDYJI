// --- INIT & CONFIG ---
const urlParams = new URLSearchParams(window.location.search);
const gasFromUrl = urlParams.get('GAS_code');
if (gasFromUrl) localStorage.setItem('GAS_URL', gasFromUrl);
const GAS_URL = localStorage.getItem('GAS_URL');

if (!GAS_URL) alert("Aplikasi belum terhubung ke database. Tambahkan ?GAS_code=URL_APPS_SCRIPT di alamat web.");

let db;
const request = indexedDB.open("ScreeningDB", 1);
request.onupgradeneeded = e => {
    db = e.target.result;
    db.createObjectStore("syncQueue", { autoIncrement: true });
};
request.onsuccess = e => { db = e.target.result; updateNetworkStatus(); };

// --- UI & TABS ---
function switchTab(tabId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    
    if (tabId === 'screening') {
        initScanner(); // Nyalakan kamera jika ke tab screening
    } else {
        stopScanner(); // Matikan kamera jika pindah ke tab registrasi
    }
}

// Deteksi jika browser diminimalkan atau ganti aplikasi (Window Away)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        console.log("Aplikasi di latar belakang, mematikan kamera...");
        stopScanner();
    } else {
        // Jika kembali aktif dan sedang di tab screening, nyalakan lagi
        const activeTab = document.querySelector('.nav button.active').id;
        if (activeTab === 'tab-screening') {
            initScanner();
        }
    }
});

function updateNetworkStatus() {
    const bar = document.getElementById('statusBar');
    if (navigator.onLine) {
        bar.className = 'status-bar online';
        bar.innerText = 'Online - Sistem Siap';
        syncData();
        fetchLocations();
    } else {
        bar.className = 'status-bar offline';
        bar.innerText = 'Offline - Data akan disimpan di perangkat';
    }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// --- REGISTRASI & SEARCH ---
function fetchLocations() {
    if(!GAS_URL) return;
    fetch(GAS_URL + "?action=getLocations")
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById('lokasi');
            select.innerHTML = '<option value="">Pilih Lokasi...</option>';
            data.forEach(loc => select.innerHTML += `<option value="${loc[0]}">${loc[0]}</option>`);
            localStorage.setItem('cachedLocations', JSON.stringify(data));
        }).catch(err => {
            // Load from cache if fail
            const cached = JSON.parse(localStorage.getItem('cachedLocations') || '[]');
            const select = document.getElementById('lokasi');
            cached.forEach(loc => select.innerHTML += `<option value="${loc[0]}">${loc[0]}</option>`);
        });
}

function tambahLokasiBaru() {
    const newLoc = prompt("Masukkan nama lokasi/sekolah baru (contoh: SDN 4 Malang):");
    
    if (!newLoc || newLoc.trim() === "") return; // Batal jika kosong
    
    const locName = newLoc.trim();
    
    // 1. Tambahkan langsung ke dropdown agar bisa langsung dipakai
    const select = document.getElementById('lokasi');
    const option = document.createElement('option');
    option.value = locName;
    option.text = locName;
    select.appendChild(option);
    select.value = locName; // Otomatis memilih lokasi yang baru dibuat
    
    // 2. Simpan ke cache lokal agar tidak hilang saat direfresh offline
    const cached = JSON.parse(localStorage.getItem('cachedLocations') || '[]');
    cached.push([locName]);
    localStorage.setItem('cachedLocations', JSON.stringify(cached));

    // 3. Antrekan untuk dikirim ke Google Sheets
    const payload = {
        action: 'addLocation',
        id: "loc_" + Date.now().toString(),
        newLocation: locName
    };
    
    saveToQueue(payload);
    
    if (!navigator.onLine) {
        alert("Offline: Lokasi baru ditambahkan secara lokal dan akan diunggah ke server nanti.");
    }
}

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const query = this.value;
    if (query.length < 3) { document.getElementById('searchResults').style.display = 'none'; return; }
    
    searchTimeout = setTimeout(() => {
        if(!navigator.onLine) return; // Search requires online
        fetch(GAS_URL + "?action=search&q=" + query)
            .then(res => res.json())
            .then(data => {
                const resDiv = document.getElementById('searchResults');
                resDiv.innerHTML = '';
                if(data.results.length === 0) resDiv.innerHTML = '<div class="search-item">Data tidak ditemukan</div>';
                data.results.forEach(row => {
                    const div = document.createElement('div');
                    div.className = 'search-item';
                    div.innerText = `${row[0]} - ${row[1]}`; // NIK - Nama
                    div.onclick = () => fillForm(row);
                    resDiv.appendChild(div);
                });
                resDiv.style.display = 'block';
            });
    }, 500);
});

function fillForm(row) {
    document.getElementById('nik').value = row[0];
    document.getElementById('nama').value = row[1];
    document.getElementById('jk').value = row[2] || 'L';
    // Lanjutkan map kolom sesuai urutan di master data Excel Anda
    document.getElementById('searchResults').style.display = 'none';
}

function submitRegistration(e) {
    e.preventDefault();
    const btn = document.getElementById('btnReg');
    btn.disabled = true; btn.innerText = "Menyimpan...";

    const payload = {
        action: 'register', id: Date.now().toString(),
        lokasi: document.getElementById('lokasi').value,
        nik: document.getElementById('nik').value, nama: document.getElementById('nama').value,
        jk: document.getElementById('jk').value, ttl: document.getElementById('ttl').value,
        ortu: document.getElementById('ortu').value, hp: document.getElementById('hp').value,
        pekerjaan: document.getElementById('pekerjaan').value, bb: document.getElementById('bb').value,
        tb: document.getElementById('tb').value, td: document.getElementById('td').value,
        hr: document.getElementById('hr').value, demam: document.getElementById('demam').value,
        tenggorokan: document.getElementById('tenggorokan').value, obat: document.getElementById('obat').value,
        rs: document.getElementById('rs').value
    };

    saveToQueue(payload);
    printBarcode(payload.nik, payload.nama);
    
    setTimeout(() => {
        document.getElementById('regForm').reset();
        btn.disabled = false; btn.innerText = "Simpan & Cetak Barcode";
        alert("Data tersimpan dan antre untuk dikirim.");
    }, 1000);
}

function printBarcode(nik, nama) {
    const printWindow = window.open('', '_blank', 'width=350,height=400');
    printWindow.document.write(`
        <html><head><title>Print Barcode</title></head>
        <body style="text-align:center; font-family:sans-serif; margin:0; padding:10px;" onload="setTimeout(function(){window.print();window.close();}, 500);">
            <h3 style="margin:5px 0;">SCREENING JANTUNG</h3>
            <svg id="barcode"></svg>
            <p style="font-size:14px; margin:5px 0;">${nik}</p>
            <p style="font-size:16px; font-weight:bold; margin:5px 0;">${nama}</p>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
            <script>JsBarcode("#barcode", "${nik}", {format: "CODE128", width: 2, height: 50, displayValue: false});<\/script>
        </body></html>
    `);
}

// --- SCREENING SCANNER ---
let html5QrCode;

async function initScanner() {
    // Pastikan scanner lama mati sebelum membuat yang baru
    await stopScanner();
    
    const readerElement = document.getElementById("reader");
    if (!readerElement) return;

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 120 } };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                document.getElementById('scanNik').innerText = decodedText;
                document.getElementById('screeningResult').style.display = "block";
                document.getElementById('isRedflag').checked = false;
                stopScanner(); // Langsung matikan kamera setelah berhasil scan
            }
        );
    } catch (err) {
        console.warn("Gagal menyalakan kamera:", err);
    }
}

async function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        try {
            await html5QrCode.stop();
            await html5QrCode.clear(); // Bersihkan elemen dari DOM
            html5QrCode = null;
            console.log("Kamera dinonaktifkan.");
        } catch (err) {
            console.error("Gagal menghentikan scanner:", err);
        }
    }
}

function submitRedflag() {
    const payload = {
        action: 'submitRedflag', id: Date.now().toString(),
        nik: document.getElementById('scanNik').innerText,
        redflag: document.getElementById('isRedflag').checked ? "YA" : "TIDAK"
    };
    saveToQueue(payload);
    
    document.getElementById('screeningResult').style.display = "none";
    alert("Hasil screening disimpan.");
    
    // Setelah simpan, otomatis nyalakan scanner lagi untuk pasien berikutnya
    initScanner(); 
}

// --- SYNC ENGINE ---
function saveToQueue(payload) {
    const tx = db.transaction("syncQueue", "readwrite");
    tx.objectStore("syncQueue").add(payload);
    if(navigator.onLine) syncData();
}

function syncData() {
    if(!GAS_URL || !db) return;
    const tx = db.transaction("syncQueue", "readwrite");
    const store = tx.objectStore("syncQueue");
    const req = store.getAll();

    req.onsuccess = () => {
        const queue = req.result;
        if(queue.length === 0) return;
        
        document.getElementById('statusBar').innerText = `Sinkronisasi ${queue.length} data...`;
        
        // Kirim satu per satu agar lebih aman
        queue.forEach(item => {
            fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(item) })
            .then(() => {
                // Hapus dari IDB jika berhasil
                const delTx = db.transaction("syncQueue", "readwrite");
                delTx.objectStore("syncQueue").clear(); // Simplified for now, clears all after sync try
            });
        });
        
        setTimeout(() => updateNetworkStatus(), 2000);
    };
}