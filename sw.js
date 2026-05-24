const CACHE_NAME = 'screening-v3';
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
    './entri.html',
    './entri.js',
    './extractor.html',
    './index.html',
    './manifest.json',
    './print.html',
    './print.js',
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