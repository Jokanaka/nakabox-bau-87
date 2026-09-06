// Narrador na nuvem: Google Cloud Text-to-Speech chamado direto do navegador com a chave do próprio usuário.
// O áudio (MP3) fica guardado no Cache API, para não gastar a cota duas vezes com o mesmo trecho.
import { store } from './store.js';

const API = 'https://texttospeech.googleapis.com/v1';
const CACHE = 'bc-tts-v1';
let broken = null;   // mensagem do último erro fatal (chave inválida, API desligada, cota); zera ao mudar as configurações

export function cloudConfigured() { const s = store.settings; return !!(s.cloudOn && s.cloudKey && s.cloudVoice); }
export function cloudReady(lang = 'pt-BR') { return cloudConfigured() && String(lang).toLowerCase().startsWith('pt') && !broken; }
export function cloudError() { return broken; }
export function resetCloud() { broken = null; }
export function isChirp(name) { return /chirp/i.test(name || ''); }

export function qualityOf(name) {
  if (/Chirp3-HD|Chirp-HD/i.test(name)) return { q: 'muito natural', rank: 0 };
  if (/Studio/i.test(name)) return { q: 'estúdio', rank: 1 };
  if (/Neural2/i.test(name)) return { q: 'natural', rank: 2 };
  if (/Wavenet/i.test(name)) return { q: 'boa', rank: 3 };
  if (/Standard/i.test(name)) return { q: 'básica', rank: 4 };
  return { q: '', rank: 5 };
}
export function describeVoice(v) {
  const { q } = qualityOf(v.name);
  const g = v.ssmlGender === 'MALE' ? 'masculina' : v.ssmlGender === 'FEMALE' ? 'feminina' : '';
  return `${String(v.name).replace(/^pt-BR-/, '')}${g ? ' · ' + g : ''}${q ? ' · ' + q : ''}`;
}

async function api(path, opts, key) {
  const sep = path.includes('?') ? '&' : '?';
  let res;
  try { res = await fetch(`${API}${path}${sep}key=${encodeURIComponent(key || '')}`, opts); }
  catch { throw new Error('Sem conexão com o Google. Verifique a internet.'); }
  let body = null;
  try { body = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const err = new Error(body && body.error && body.error.message ? body.error.message : `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body || {};
}

// vozes pt-BR da conta; masculinas primeiro quando o usuário prefere voz masculina, depois por qualidade
export async function listVoices(key) {
  const body = await api('/voices?languageCode=pt-BR', { method: 'GET' }, key);
  const list = (body.voices || []).filter((v) => (v.languageCodes || []).some((c) => /^pt-BR/i.test(c)) && !/polyglot|journey|casual/i.test(v.name));
  const male = !!store.settings.ttsMale;
  list.sort((a, b) => {
    const ga = a.ssmlGender === 'MALE' ? 0 : 1, gb = b.ssmlGender === 'MALE' ? 0 : 1;
    if (male && ga !== gb) return ga - gb;
    return qualityOf(a.name).rank - qualityOf(b.name).rank || String(a.name).localeCompare(String(b.name));
  });
  return list.map((v) => ({ name: v.name, ssmlGender: v.ssmlGender || '' }));
}
export function pickDefaultVoice(list) {
  const male = !!store.settings.ttsMale;
  const prefM = ['pt-BR-Chirp3-HD-Charon', 'pt-BR-Chirp3-HD-Orus', 'pt-BR-Chirp3-HD-Fenrir', 'pt-BR-Neural2-B', 'pt-BR-Wavenet-B', 'pt-BR-Standard-B'];
  const prefF = ['pt-BR-Chirp3-HD-Kore', 'pt-BR-Chirp3-HD-Leda', 'pt-BR-Chirp3-HD-Aoede', 'pt-BR-Neural2-A', 'pt-BR-Wavenet-A', 'pt-BR-Standard-A'];
  const names = new Set(list.map((v) => v.name));
  const found = (male ? prefM : prefF).find((n) => names.has(n));
  if (found) return found;
  const byGender = list.find((v) => v.ssmlGender === (male ? 'MALE' : 'FEMALE'));
  return (byGender || list[0] || {}).name || '';
}

async function sha1(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return `x${h.toString(16)}-${text.length}`;
  }
}
function b64ToBlob(b64, type) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  // o tipo real vale mais que o pedido (útil em testes e se o Google devolver WAV)
  const isWav = arr.length > 4 && arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46;
  return new Blob([arr], { type: isWav ? 'audio/wav' : type });
}

const inflight = new Map();
// Blob de áudio para um trecho; cache por voz + tom + texto. A velocidade é aplicada na reprodução, sem gastar cota.
export async function synthesize(text, { voice = store.settings.cloudVoice, pitch = 1, key = store.settings.cloudKey } = {}) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) throw new Error('texto vazio');
  const semis = isChirp(voice) ? 0 : Math.max(-10, Math.min(10, Math.round((pitch - 1) * 10)));
  const url = `https://tts.biblia.local/${encodeURIComponent(voice)}/${semis}/${await sha1(t)}`;
  let cache = null;
  try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) return await hit.blob(); } catch { cache = null; }
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    const audioConfig = { audioEncoding: 'MP3', speakingRate: 1.0 };
    if (semis) audioConfig.pitch = semis;
    let res;
    try {
      res = await api('/text:synthesize', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { text: t }, voice: { languageCode: 'pt-BR', name: voice }, audioConfig }) }, key);
    } catch (e) {
      if ([400, 401, 403, 429].includes(e.status)) broken = e.message;   // não insistir a cada versículo
      throw e;
    }
    if (!res.audioContent) throw new Error('resposta sem áudio');
    const blob = b64ToBlob(res.audioContent, 'audio/mpeg');
    if (cache) { try { await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type } })); } catch { /* sem espaço */ } }
    return blob;
  })();
  inflight.set(url, p);
  try { return await p; } finally { inflight.delete(url); }
}
export async function clearCache() { try { await caches.delete(CACHE); } catch { /* ignora */ } }
