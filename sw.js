/* Chil service worker: makes the app open with no internet. */
var CACHE = 'chil-v1.0.5';
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'styles.css',
  'config.js', 'util.js', 'logo.js', 'store.js', 'parser.js', 'calc.js', 'activation.js', 'exporter.js',
  'core.js', 'v-money.js', 'v-summary.js', 'v-biz.js', 'v-calc.js', 'v-debts.js', 'v-customers.js', 'select.js', 'xlsx.js', 'v-menu.js', 'v-spend.js', 'v-help.js', 'policy.js', 'v-search.js', 'v-more.js', 'app.js',
  'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // config.js holds the switch-off list, so ask the internet first and use the saved copy only when offline.
  if (/\/js\/config\.js$|\/config\.js$/.test(url.pathname)) {
    e.respondWith(fetch(e.request).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(e.request).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
