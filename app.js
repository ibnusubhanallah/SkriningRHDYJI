// --- CONFIG & DATABASE ---
const urlParams = new URLSearchParams(window.location.search);
const gasFromUrl = urlParams.get('GAS_code');
if (gasFromUrl) localStorage.setItem('GAS_URL', gasFromUrl);
const GAS_URL = localStorage.getItem('GAS_URL');

let db;
let isSyncing = false;
let html5QrCode = null;

// Inisialisasi Database
const request = indexedDB.open("ScreeningJantungDB", 2); // Versi 2
request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "internal_id" });
    }
};
request.onsuccess = e => {
    db = e.target.result;
    console.log("Database Ready");
    updateNetworkStatus();
    fetchLocations();
};

// --- NAVIGATION & UI ---
function switchTab(tabId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    
    if (tabId === 'screening') {
        setTimeout(initScanner, 200); 
    } else {
        stopScanner();
    }
}

function updateNetworkStatus() {
    const bar = document.getElementById('statusBar');
    if (navigator.onLine) {
        bar.className = 'status-bar online';
        bar.innerText = 'Online - Sistem Siap';
        syncData(); 
    } else {
        bar.className = 'status-bar offline';
        bar.innerText = 'Offline - Mode Penyimpanan Lokal';
    }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// --- CORE FUNCTIONS (GET) ---
function fetchLocations() {
    if (!GAS_URL || !navigator.onLine) {
        loadCachedLocations();
        return;
    }
    fetch(`${GAS_URL}?action=getLocations`)
        .then(res => res.json())
        .then(data => {
            const select = document.getElementById('lokasi');
            const currentVal = select.value;
            select.innerHTML = '<option value="">Pilih Lokasi...</option>';
            data.forEach(loc => {
                if(loc[0]) select.innerHTML += `<option value="${loc[0]}">${loc[0]}</option>`;
            });
            if(currentVal) select.value = currentVal;
            localStorage.setItem('cachedLocations', JSON.stringify(data));
        }).catch(() => loadCachedLocations());
}

function loadCachedLocations() {
    const cached = JSON.parse(localStorage.getItem('cachedLocations') || '[]');
    const select = document.getElementById('lokasi');
    select.innerHTML = '<option value="">Pilih Lokasi...</option>';
    cached.forEach(loc => {
        if(loc[0]) select.innerHTML += `<option value="${loc[0]}">${loc[0]}</option>`;
    });
}

// Tambah Lokasi Baru
function tambahLokasiBaru() {
    const name = prompt("Nama Lokasi Baru:");
    if (!name) return;
    const locName = name.trim();
    
    // Update UI Langsung
    const select = document.getElementById('lokasi');
    const opt = document.createElement('option');
    opt.value = locName; opt.text = locName;
    select.appendChild(opt);
    select.value = locName;

    // Simpan ke antrean
    addToQueue({ action: 'addLocation', newLocation: locName });
}

// --- SEARCH LOGIC ---
let searchTimer;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimer);
    const q = this.value;
    if (q.length < 3) return;
    
    searchTimer = setTimeout(() => {
        if (!navigator.onLine) return;
        fetch(`${GAS_URL}?action=search&q=${encodeURIComponent(q)}`)
            .then(res => res.json())
            .then(data => {
                const resDiv = document.getElementById('searchResults');
                resDiv.innerHTML = '';
                if (!data.results || data.results.length === 0) {
                    resDiv.innerHTML = '<div class="search-item">Tidak ditemukan</div>';
                } else {
                    data.results.forEach(row => {
                        const div = document.createElement('div');
                        div.className = 'search-item';
                        div.innerText = `${row[0]} - ${row[1]}`;
                        div.onclick = () => {
                            document.getElementById('nik').value = row[0];
                            document.getElementById('nama').value = row[1];
                            document.getElementById('jk').value = row[2] || "";
                            resDiv.style.display = 'none';
                        };
                        resDiv.appendChild(div);
                    });
                }
                resDiv.style.display = 'block';
            });
    }, 500);
});

// --- SUBMISSION LOGIC ---
function submitRegistration(e) {
    e.preventDefault();
    const currentLokasi = document.getElementById('lokasi').value;
    
    const payload = {
        action: 'register',
        internal_id: Date.now(),
        lokasi: currentLokasi,
        nik: document.getElementById('nik').value,
        nama: document.getElementById('nama').value,
        jk: document.getElementById('jk').value,
        ttl: document.getElementById('ttl').value,
        ortu: document.getElementById('ortu').value,
        hp: document.getElementById('hp').value,
        pekerjaan: document.getElementById('pekerjaan').value,
        bb: document.getElementById('bb').value,
        tb: document.getElementById('tb').value,
        td: document.getElementById('td').value,
        hr: document.getElementById('hr').value,
        demam: document.getElementById('demam').value,
        tenggorokan: document.getElementById('tenggorokan').value,
        obat: document.getElementById('obat').value,
        rs: document.getElementById('rs').value
    };

    addToQueue(payload);
    printBarcode(payload.nik, payload.nama);

    // RESET FORM TANPA RESET LOKASI
    document.getElementById('regForm').reset();
    document.getElementById('lokasi').value = currentLokasi;
    alert("Data berhasil dicatat!");
}

function submitRedflag() {
    const payload = {
        action: 'submitRedflag',
        internal_id: Date.now(),
        nik: document.getElementById('scanNik').innerText,
        redflag: document.getElementById('isRedflag').checked ? "YA" : "TIDAK"
    };
    addToQueue(payload);
    document.getElementById('screeningResult').style.display = "none";
    alert("Redflag tersimpan!");
    initScanner(); // Restart kamera untuk pasien berikutnya
}

// --- QUEUE & SYNC SYSTEM ---
function addToQueue(data) {
    const tx = db.transaction("syncQueue", "readwrite");
    tx.objectStore("syncQueue").add(data);
    tx.oncomplete = () => { if (navigator.onLine) syncData(); };
}

async function syncData() {
    if (isSyncing || !navigator.onLine || !GAS_URL) return;
    isSyncing = true;

    const tx = db.transaction("syncQueue", "readonly");
    const store = tx.objectStore("syncQueue");
    const records = await new Promise(res => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
    });

    if (records.length === 0) { isSyncing = false; return; }

    for (const data of records) {
        try {
            await fetch(GAS_URL, {
                method: "POST",
                mode: "no-cors", // Gunakan no-cors untuk menghindari error CORS GAS
                body: JSON.stringify(data)
            });
            // Hapus dari antrean setelah sukses
            const delTx = db.transaction("syncQueue", "readwrite");
            delTx.objectStore("syncQueue").delete(data.internal_id);
            await new Promise(r => delTx.oncomplete = r);
        } catch (e) {
            console.error("Sync Error:", e);
            break; 
        }
    }
    isSyncing = false;
    setTimeout(updateNetworkStatus, 1000);
}

// --- SCANNER SYSTEM ---
async function initScanner() {
    await stopScanner();
    document.getElementById("reader").innerHTML = ""; 
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 150 } };
    
    try {
        await html5QrCode.start({ facingMode: "environment" }, config, (text) => {
            document.getElementById('scanNik').innerText = text;
            document.getElementById('screeningResult').style.display = "block";
            stopScanner();
        });
    } catch (err) { console.error(err); }
}

async function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        await html5QrCode.stop();
        document.getElementById("reader").innerHTML = "";
    }
}

function printBarcode(nik, nama) {
    const w = window.open('', '_blank', 'width=300,height=400');
    w.document.write(`<html><body style="text-align:center;font-family:sans-serif;padding:20px;" onload="setTimeout(()=> {window.print();window.close();},500)">
        <h3 style="margin:0">SCREENING JANTUNG</h3>
        <svg id="b"></svg><br><b>${nik}</b><br>${nama}
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>JsBarcode("#b","${nik}",{format:"CODE128",width:2,height:50,displayValue:false});</script>
    </body></html>`);
}

// Matikan kamera jika ganti aplikasi
document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopScanner();
    else if (document.getElementById('tab-screening').classList.contains('active')) initScanner();
});