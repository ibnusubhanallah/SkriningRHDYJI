const CACHE_NAME = 'screening-v3';
const ASSETS = [
    './',
    './draft flow skrining RHD - regist n antro.jpg',
    './draft flow skrining RHD - regist only.jpg',
    './entri.html',
    './entri.js',
    './extractor.html',
    './html5-qrcode.min.js',
    './index.html',
    './JsBarcode.all.min.js',
    './manifest.json',
    './print.html',
    './print.js',
    './recta.js',
    './scanner.html',
    './scanner.js',
    './sop.html',
    './sw.js',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));

    // Paksa Service Worker baru untuk langsung mengonfirmasi instalasi 
    // tanpa menunggu versi lama mati
    self.skipWaiting();
});

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