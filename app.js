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
    await stopScanner(); // Bersihkan yang lama
    
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };

    try {
        await html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
            document.getElementById('scanNik').innerText = decodedText;
            document.getElementById('screeningResult').style.display = "block";
            stopScanner(); // Matikan setelah dapet NIK
        });
    } catch (err) {
        console.warn("Kamera gagal:");
    }
}

// --- PERBAIKAN KAMERA (RESTART LOGIC) ---
async function stopScanner() {
    if (html5QrCode) {
        try {
            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
            }
            // Penting: Hapus elemen agar bisa di-init ulang tanpa konflik
            document.getElementById("reader").innerHTML = ""; 
            html5QrCode = null;
        } catch (err) {
            console.error("Gagal stop kamera:", err);
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

// --- PERBAIKAN DOUBLE INPUT & SYNC ---
async function syncData() {
    if(!GAS_URL || !db || !navigator.onLine) return;
    
    const tx = db.transaction("syncQueue", "readwrite");
    const store = tx.objectStore("syncQueue");
    const allRecords = await new Promise(resolve => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
    });

    if(allRecords.length === 0) return;

    for (const item of allRecords) {
        try {
            // Gunakan fetch biasa tanpa no-cors jika memungkinkan untuk cek status
            await fetch(GAS_URL, { 
                method: "POST", 
                body: JSON.stringify(item) 
            });
            
            // Hapus item spesifik setelah berhasil terkirim
            const delTx = db.transaction("syncQueue", "readwrite");
            delTx.objectStore("syncQueue").delete(item.internal_id); 
        } catch (e) {
            console.error("Gagal sync 1 item, berhenti.", e);
            break; // Berhenti jika gagal koneksi
        }
    }
    updateNetworkStatus();
}