const CACHE_NAME = 'screening-v2';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './print.html',
    './print.js',
    './manifest.json',
    './html5-qrcode.min.js',
    './JsBarcode.all.min.js'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
});

self.addEventListener('fetch', e => {
    // Abaikan cache untuk request ke Apps Script (biarkan lewat jaringan)
    if (e.request.url.includes('script.google.com')) return;
    e.respondWith(caches.match(e.request).then(
        res => res || fetch(e.request)));
});