// Narrador offline: síntese de voz Piper (modelo pt_BR "Faber", masculino) num worker, para não travar a tela.
import { TtsSession } from './vendor/piper/piper-tts-web.js';

let session = null;
let initPromise = null;
const post = (m, t) => self.postMessage(m, t || []);

function init(voiceId, paths) {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    session = await TtsSession.create({
      voiceId, wasmPaths: paths, logger: () => {},
      progress: (p) => post({ type: 'progress', url: p.url, loaded: p.loaded, total: p.total }),
    });
    await session.waitReady;
    post({ type: 'ready' });
  })();
  initPromise.catch((e) => { post({ type: 'error', message: String((e && e.message) || e) }); initPromise = null; session = null; });
  return initPromise;
}

const queue = [];
let busy = false;
let cfg = null;
async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    try {
      await init(cfg.voiceId, cfg.paths);
      const blob = await session.predict(job.text);
      const buf = await blob.arrayBuffer();
      post({ type: 'audio', id: job.id, buf }, [buf]);
    } catch (e) {
      post({ type: 'fail', id: job.id, message: String((e && e.message) || e) });
    }
  }
  busy = false;
}
self.onmessage = (ev) => {
  const m = ev.data || {};
  if (m.type === 'init') { cfg = { voiceId: m.voiceId, paths: m.paths }; init(m.voiceId, m.paths).catch(() => {}); }
  else if (m.type === 'predict') { queue.push({ id: m.id, text: m.text }); pump(); }
  else if (m.type === 'clear') { queue.length = 0; }
};
