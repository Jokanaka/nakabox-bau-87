/* Service worker — Bíblia Católica
   Shell: precache. Data (data/*.json): cache-first, immutable per version. */
const SHELL_CACHE = 'bc-v7-shell';   // casca do app: mude a cada versão do código
const DATA_CACHE = 'bc-v4-data';     // textos: mude só quando os dados forem regenerados
const VOICE_CACHE = 'bc-voice-v1';   // runtime do narrador offline (wasm de terceiros)
const AUDIO_CACHE = 'bc-audio-v1';   // narração gravada (últimos capítulos ouvidos)
const AUDIO_MAX = 40;
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest',
  './js/app.js', './js/util.js', './js/store.js', './js/data.js', './js/search.js', './js/reader.js',
  './js/features.js', './js/liturgy.js', './js/audio.js', './js/cloudtts.js', './js/piper-worker.js',
  './js/vendor/piper/piper-tts-web.js', './js/vendor/piper/piper-o91UDS6e.js', './js/vendor/piper/voices_static-D_OtJDHM.js', './js/vendor/piper/ort-esm.mjs', './js/vendor/piper/ort.wasm.min.js', './js/prayers.js', './js/rosary.js', './js/plans.js', './js/share.js',
  './data/books.json', './data/lectionary.json', './data/audio.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE && k !== VOICE_CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // narração gravada (jsDelivr/raw do branch "audio"): guarda os últimos capítulos, servindo trechos (Range) a partir do arquivo inteiro
  if (/\/gh\/jokanaka\/nakabox-bau-87@[^/]+\/[a-z0-9]+\/\d+\.(mp3|json)$/i.test(url.pathname) || (url.hostname === 'raw.githubusercontent.com' && /\/nakabox-bau-87\/[^/]+\/[a-z0-9]+\/\d+\.(mp3|json)$/i.test(url.pathname))) {
    e.respondWith(serveAudio(req));
    return;
  }
  // runtime do narrador offline (onnxruntime e piper-wasm nos CDNs): guarda para uso sem internet
  if ((url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') && /onnxruntime-web|piper-wasm/.test(url.pathname)) {
    e.respondWith(
      caches.open(VOICE_CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
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

function audioKey(u) {
  const m = u.match(/\/([a-z0-9]+\/\d+\.(?:mp3|json))$/i);
  return m ? 'https://audio.biblia.local/' + m[1] : u;
}
async function serveAudio(req) {
  try {
    const c = await caches.open(AUDIO_CACHE);
    const key = audioKey(req.url);
    let full = await c.match(key);
    if (!full) {
      const res = await fetch(req.url, { headers: {} });   // pede o arquivo inteiro, sem Range
      if (!res.ok || res.status !== 200) return fetch(req);
      const buf = await res.arrayBuffer();
      full = new Response(buf, { status: 200, headers: { 'Content-Type': res.headers.get('Content-Type') || (req.url.endsWith('.json') ? 'application/json' : 'audio/mpeg'), 'Content-Length': String(buf.byteLength), 'Accept-Ranges': 'bytes' } });
      await c.put(key, full.clone());
      trimAudio(c);
    }
    const range = req.headers.get('range');
    if (!range) return full;
    const buf = await full.arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? +m[1] : 0;
    const end = m && m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
    if (start > end || start >= buf.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${buf.byteLength}` } });
    return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
  } catch (err) {
    return fetch(req);
  }
}
async function trimAudio(c) {
  try {
    const keys = await c.keys();
    const mp3s = keys.filter((k) => k.url.endsWith('.mp3'));
    for (let i = 0; i < mp3s.length - AUDIO_MAX; i++) await c.delete(mp3s[i]);
  } catch (err) { /* ignora */ }
}

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
