const CACHE_NAME = 'RHD-YJI-v28-05-2026-1400';
const ASSETS = [
    './',
    'img/draft flow skrining RHD - regist n antro.jpg',
    'img/draft flow skrining RHD - regist only.jpg',
    'img/install-recta-warning.webp',
    'img/recta-setting.webp',
    'img/zadig-list-all-device.webp',
    'img/zadig-select-device.jpg',
    'library/html5-qrcode.min.js',
    'library/JsBarcode.all.min.js',
    'library/recta.js',
    'library/localforage.min.js',
    './entri.html',
    './entri.js',
    './extractor.html',
    './index.html',
    './manifest.json',
    './doctor.html',
    './doctor.js',
    './sop.html',
    './sw.js',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('⏳ Memulai proses caching mandiri...');

            // Kita paksa download satu per satu agar ketahuan file mana yang mogok
            for (const asset of ASSETS) {
                try {
                    await cache.add(asset);
                    console.log(`✅ Berhasil mengunci ke memori: ${asset}`);
                } catch (err) {
                    // JIKA FILE ERROR/GAGAL DOWNLOAD, DIA AKAN BERTERIAK DI CONSOLE DI SINI:
                    console.error(`🚨 DALANGNYA KETEMU! File ini gagal di-cache atau jalurnya salah: ${asset}`, err);
                }
            }
            console.log('🏁 Proses evaluasi caching selesai.');
        })
    );
    self.skipWaiting();
});

// self.addEventListener('install', e => {
//     e.waitUntil(
//         caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));

//     // Paksa Service Worker baru untuk langsung mengonfirmasi instalasi 
//     // tanpa menunggu versi lama mati
//     self.skipWaiting();
// });

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );

    // Paksa Service Worker baru untuk langsung mengambil kendali halaman saat ini
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Abaikan cache untuk request ke Apps Script (biarkan lewat jaringan)
    if (e.request.url.includes('script.google.com')) return;
    e.respondWith(caches.match(e.request,
        { ignoreSearch: true }
    ).then(
        res => res || fetch(e.request)));
});