/* Service worker — Bíblia Católica
   Shell: precache. Data (data/*.json): cache-first, immutable per version. */
const SHELL_CACHE = 'bc-v4-shell';   // casca do app: mude a cada versão do código
const DATA_CACHE = 'bc-v4-data';     // textos: mude só quando os dados forem regenerados
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/util.js', './js/store.js', './js/data.js', './js/search.js', './js/reader.js',
  './js/features.js', './js/liturgy.js', './js/audio.js', './js/prayers.js', './js/rosary.js', './js/plans.js', './js/share.js',
  './data/books.json', './data/lectionary.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      caches.open(DATA_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  // shell: network first, fallback to cache (keeps app fresh but works offline)
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});

self.addEventListener('message', async (e) => {
  if (e.data && e.data.type === 'CACHE_ALL') {
    const c = await caches.open(DATA_CACHE);
    const urls = e.data.urls || [];
    let done = 0;
    for (const u of urls) {
      try {
        const hit = await c.match(u);
        if (!hit) {
          const res = await fetch(u);
          if (res.ok) await c.put(u, res);
        }
      } catch (err) { /* ignore */ }
      done++;
      if (e.source) e.source.postMessage({ type: 'CACHE_PROGRESS', done, total: urls.length });
    }
    if (e.source) e.source.postMessage({ type: 'CACHE_DONE', total: urls.length });
  }
});
