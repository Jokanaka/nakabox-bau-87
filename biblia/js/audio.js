// Leitura em voz alta: fila de trechos, barra de controle, escolha de voz (do aparelho ou narrador na nuvem),
// preferência por voz masculina, estilo de narração, velocidade, tom e temporizador para parar.
import { $, $$, h, esc, icon, toast } from './util.js';
import { store } from './store.js';
import { openSheet, openModal } from './ui.js';
import * as cloud from './cloudtts.js';
import { book, bookName } from './data.js';

const has = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const CHUNK = 180; // caracteres por trecho falado (o Chrome corta falas longas)
const st = {
  active: false, paused: false, pausedInPlace: false, items: [], idx: 0, chunks: [], chunk: 0, title: '', lang: 'pt-BR',
  engine: null, onItem: null, onEnd: null, utter: null, watchdog: null, restart: null, nudge: null, gap: null, errors: 0,
  timerEnd: null, timerTick: null, timerMode: null, timerValue: null, autoplay: null,
};
const I = {
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M3 7h9v2H3zm15 0h3v2h-3zM3 15h3v2H3zm9 0h9v2h-9zm3-9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM9 12.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-1 2h2v4.6l3 1.8-1 1.7-4-2.4z"/></svg>',
  cloud: '<svg viewBox="0 0 24 24"><path d="M6.5 19a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.5 9a4.5 4.5 0 0 1 .5 9.97V19z"/></svg>',
  chip: '<svg viewBox="0 0 24 24"><path d="M7 7h10v10H7zm2 2v6h6V9zM4 9h2v2H4zm0 4h2v2H4zm14-4h2v2h-2zm0 4h2v2h-2zM9 4h2v2H9zm4 0h2v2h-2zM9 18h2v2H9zm4 0h2v2h-2z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z"/></svg>',
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmtNum = (x) => (+x || 1).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
export const fmtRate = (x) => `${fmtNum(x)}×`;
const isDesktopChrome = has && /Chrome\//.test(navigator.userAgent) && !/Android|iPhone|iPad|Mobile/.test(navigator.userAgent);
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

export function audioAvailable() { return has || cloud.cloudConfigured() || (store.settings.localVoiceOn && localSupported()); }
export function isActive() { return st.active; }
export function isPaused() { return st.paused; }

// ---------- vozes do aparelho ----------
let voiceList = [];
function loadVoices() {
  if (!has) return voiceList;
  try { const v = speechSynthesis.getVoices(); if (v && v.length) voiceList = v; } catch { /* sem vozes */ }
  return voiceList;
}
if (has) {
  loadVoices();
  try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch { speechSynthesis.onvoiceschanged = loadVoices; }
}
export function voices() { return loadVoices(); }
const lb = (l) => String(l || '').replace('_', '-').toLowerCase();
// o navegador não informa o sexo da voz; deduzimos pelo nome (Felipe, Daniel… / Luciana, Fernanda…)
const MALE_RE = /\b(felipe|daniel|ricardo|rafael|thiago|tiago|ant[oô]nio|francisco|gabriel|rodrigo|diego|jo[aã]o|paulo|pedro|lucas|carlos|marcos|eddy|reed|rocko|fred|jorge|jos[eé]|male|masc\w*|homem|ptd)\b/i;
const FEMALE_RE = /\b(luciana|fernanda|joana|catarina|maria|ana|camila|vit[oó]ria|flo|sandy|shelley|grandma|female|femin\w*|mulher|afs)\b/i;
export function voiceGender(v) {
  const n = `${v.name || ''} ${v.voiceURI || ''}`;
  if (FEMALE_RE.test(n)) return 'F';
  if (MALE_RE.test(n)) return 'M';
  return '';
}
export function voiceById(id) {
  if (!id) return null;
  const list = voices();
  return list.find((v) => v.voiceURI === id) || list.find((v) => v.name === id) || null;
}
export function chosenVoice() { return voiceById(store.settings.ttsVoice); }
const shortVoiceName = (v) => String((v && v.name) || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/^(Google|Microsoft|Apple)\s+/i, '').trim().slice(0, 24) || 'Celular';
// voz para um idioma: a escolhida pelo usuário (se for do mesmo idioma), senão a melhor automática
// (mesmo idioma exato, masculina se preferida, instalada no aparelho)
export function pickVoice(lang) {
  const want = chosenVoice();
  if (want && lb(want.lang).slice(0, 2) === lb(lang).slice(0, 2)) return want;
  const base = lb(lang).slice(0, 2), full = lb(lang);
  const male = !!store.settings.ttsMale;
  const score = (v) => (lb(v.lang) === full ? 4 : 0) + (v.localService ? 1 : 0) + (male && voiceGender(v) === 'M' ? 8 : 0) + (male && voiceGender(v) === 'F' ? -2 : 0);
  const c = voices().filter((v) => lb(v.lang).startsWith(base)).sort((a, b) => score(b) - score(a));
  return c[0] || want || null;
}

// ---------- trechos ----------
// Normal: blocos de até 180 caracteres. Narração: uma frase por trecho, com respiro entre frases e versículos.
function chunksOf(text, kind) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const narr = store.settings.ttsStyle !== 'normal';
  const sentences = t.split(/(?<=[.!?…])\s+(?=["“(]?[A-ZÀ-Ú0-9])/);
  const out = [];
  let cur = '';
  const minLen = narr ? 30 : CHUNK;
  for (const s of sentences) {
    if (cur && (cur.length + s.length + 1 > CHUNK || cur.length >= minLen)) { out.push({ text: cur, gap: narr ? 220 : 0 }); cur = s; }
    else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push({ text: cur, gap: narr ? 220 : 0 });
  if (out.length) out[out.length - 1].gap = kind === 'intro' ? (narr ? 900 : 400) : (narr ? 520 : 120);
  return out;
}

// ---------- motores ----------
const sysEngine = {
  kind: 'aparelho', pausable: false,
  speak(text, cb) {
    const s = store.settings;
    const narr = s.ttsStyle !== 'normal';
    const u = new SpeechSynthesisUtterance(text);
    u.lang = st.lang;
    u.rate = clamp((+s.ttsRate || 1) * (narr ? 0.92 : 1), 0.5, 2);
    u.pitch = clamp((+s.ttsPitch || 1) * (narr ? 0.96 : 1), 0.5, 2);
    const v = pickVoice(st.lang);
    if (v) u.voice = v;
    u.onstart = () => cb.onstart();
    u.onend = () => { if (st.utter === u) cb.onend(); };
    u.onerror = (e) => { if (st.utter !== u) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; cb.onerror(e); };
    st.utter = u;
    try { speechSynthesis.speak(u); } catch (e) { cb.onerror(e); }
  },
  cancel() { st.utter = null; if (has) { try { speechSynthesis.cancel(); } catch { /* ignora */ } } },
  pause() {}, resume() {},
};
let audioEl = null;
function mediaEl() {
  if (!audioEl) { audioEl = new Audio(); audioEl.preload = 'auto'; audioEl.setAttribute('playsinline', ''); }
  return audioEl;
}
const cloudEngine = {
  kind: 'nuvem', pausable: true, token: null, url: null,
  // no iPhone o áudio só toca depois de um toque: tocamos um silêncio no toque e depois trocamos o src
  unlock() { try { const a = mediaEl(); if (a.dataset.unlocked) return; a.src = SILENT_WAV; a.play().then(() => { a.dataset.unlocked = '1'; }).catch(() => {}); } catch { /* ignora */ } },
  async speak(text, cb) {
    const token = {}; this.token = token;
    let blob;
    try { blob = await cloud.synthesize(text, { pitch: +store.settings.ttsPitch || 1 }); }
    catch (e) { if (this.token === token) cb.onerror(e, true); return; }
    if (this.token !== token) return;
    const a = mediaEl();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    a.src = this.url;
    const narr = store.settings.ttsStyle !== 'normal';
    a.playbackRate = clamp((+store.settings.ttsRate || 1) * (narr ? 0.95 : 1), 0.5, 2);
    a.onended = () => { if (this.token === token) cb.onend(); };
    a.onerror = () => { if (this.token === token) cb.onerror(new Error('áudio inválido')); };
    try { await a.play(); if (this.token === token) cb.onstart(); }
    catch (e) { if (this.token === token) cb.onerror(e); }
  },
  cancel() { this.token = null; try { const a = mediaEl(); a.pause(); a.onended = null; a.onerror = null; } catch { /* ignora */ } },
  pause() { try { mediaEl().pause(); } catch { /* ignora */ } },
  resume() { try { mediaEl().play().catch(() => {}); } catch { /* ignora */ } },
  setRate() { const narr = store.settings.ttsStyle !== 'normal'; try { mediaEl().playbackRate = clamp((+store.settings.ttsRate || 1) * (narr ? 0.95 : 1), 0.5, 2); } catch { /* ignora */ } },
  prefetch(texts) { for (const t of texts) cloud.synthesize(t, { pitch: +store.settings.ttsPitch || 1 }).catch(() => {}); },
};
// ---------- narrador offline (Piper, voz masculina "Faber", roda no aparelho) ----------
const PIPER = {
  voiceId: 'pt_BR-faber-medium',
  paths: {
    onnxWasm: 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/',
    piperData: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data',
    piperWasm: 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm',
  },
};
export function localSupported() {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && !!(navigator.storage && navigator.storage.getDirectory);
}
function setStatus(msg) {
  st.status = msg || '';
  const el = $('#player-root .p-pos');
  if (el && st.active) { const it = st.items[st.idx] || {}; el.textContent = `${st.status || (it.label ? it.label : `${st.idx + 1} de ${st.items.length}`)} · `; }
}
const localEngine = {
  kind: 'offline', pausable: true, token: null, url: null, worker: null, ready: false, failed: null, progress: null, pending: new Map(), cache: new Map(), seq: 0, listeners: new Set(),
  ensure() {
    if (this.worker || this.failed) return;
    if (!localSupported()) { this.failed = 'este navegador não suporta o narrador offline'; return; }
    try { this.worker = new Worker(new URL('./piper-worker.js', import.meta.url), { type: 'module' }); }
    catch (e) { this.failed = String((e && e.message) || e); return; }
    this.worker.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.type === 'progress') { this.progress = m.total ? Math.round((m.loaded / m.total) * 100) : null; this.notify(); }
      else if (m.type === 'ready') { this.ready = true; this.progress = null; this.notify(); }
      else if (m.type === 'error') { this.fail(m.message); }
      else if (m.type === 'audio') { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); const blob = new Blob([m.buf], { type: 'audio/wav' }); this.remember(p.text, blob); p.resolve(blob); } }
      else if (m.type === 'fail') { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); p.reject(new Error(m.message)); } }
    };
    this.worker.onerror = (e) => { this.fail((e && e.message) || 'erro no narrador offline'); };
    this.worker.postMessage({ type: 'init', voiceId: PIPER.voiceId, paths: PIPER.paths });
    this.notify();
  },
  fail(msg) {
    this.failed = msg || 'erro';
    for (const p of this.pending.values()) p.reject(new Error(this.failed));
    this.pending.clear();
    try { if (this.worker) this.worker.terminate(); } catch { /* ignora */ }
    this.worker = null; this.ready = false;
    this.notify();
  },
  reset() { this.failed = null; },
  state() { return this.failed ? { s: 'erro', msg: this.failed } : this.ready ? { s: 'pronto' } : this.worker ? { s: 'carregando', pct: this.progress } : { s: 'parado' }; },
  notify() { for (const f of this.listeners) { try { f(this.state()); } catch { /* ignora */ } } },
  remember(text, blob) { this.cache.set(text, blob); if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value); },
  synth(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (this.cache.has(t)) return Promise.resolve(this.cache.get(t));
    this.ensure();
    if (this.failed) return Promise.reject(new Error(this.failed));
    for (const p of this.pending.values()) if (p.text === t) return p.promise;
    const id = ++this.seq;
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    this.pending.set(id, { text: t, resolve, reject, promise });
    this.worker.postMessage({ type: 'predict', id, text: t });
    return promise;
  },
  unlock() { cloudEngine.unlock(); },
  async speak(text, cb) {
    const token = {}; this.token = token;
    const onState = (s) => { if (this.token !== token) return; setStatus(s.s === 'carregando' ? (s.pct != null ? `Baixando a voz… ${s.pct}%` : 'Preparando a voz…') : ''); };
    if (!this.ready) { this.listeners.add(onState); onState(this.state()); }
    let blob;
    try { blob = await this.synth(text); }
    catch (e) { this.listeners.delete(onState); if (this.token === token) { setStatus(''); cb.onerror(e); } return; }
    this.listeners.delete(onState);
    if (this.token !== token) return;
    setStatus('');
    const a = mediaEl();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = URL.createObjectURL(blob);
    a.src = this.url;
    this.setRate();
    a.onended = () => { if (this.token === token) cb.onend(); };
    a.onerror = () => { if (this.token === token) cb.onerror(new Error('áudio inválido')); };
    try { await a.play(); if (this.token === token) cb.onstart(); }
    catch (e) { if (this.token === token) cb.onerror(e); }
  },
  cancel() { this.token = null; try { const a = mediaEl(); a.pause(); a.onended = null; a.onerror = null; } catch { /* ignora */ } },
  pause() { try { mediaEl().pause(); } catch { /* ignora */ } },
  resume() { try { mediaEl().play().catch(() => {}); } catch { /* ignora */ } },
  setRate() { const narr = store.settings.ttsStyle !== 'normal'; try { mediaEl().playbackRate = clamp((+store.settings.ttsRate || 1) * (narr ? 0.95 : 1), 0.5, 2); } catch { /* ignora */ } },
  prefetch(texts) { for (const t of texts) this.synth(t).catch(() => {}); },
};
export function localVoiceState() { return localEngine.state(); }
export function localVoicePrepare(listener) { if (listener) localEngine.listeners.add(listener); localEngine.reset(); localEngine.ensure(); return () => localEngine.listeners.delete(listener); }
// ---------- narração gravada (MP3 por capítulo com voz neural, gerado de antemão; várias vozes) ----------
export const VOICE_INFO = {
  alex: { name: 'Alex', desc: 'masculina' },
  santa: { name: 'Santa', desc: 'masculina, mais grave' },
  dora: { name: 'Dora', desc: 'feminina' },
};
let manifest = null;
let manifestPromise = null;
export function loadAudioManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (!manifestPromise) {
    manifestPromise = fetch('data/audio.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((m) => { manifest = m && m.voices ? m : { voices: {} }; return manifest; });
  }
  return manifestPromise;
}
// vozes gravadas: [{ id, name, desc, count, books }]
export function recordedVoices() {
  if (!manifest) return [];
  return Object.entries(manifest.voices).map(([id, v]) => ({ id, name: (v && v.name) || (VOICE_INFO[id] || {}).name || id, desc: (v && v.desc) || (VOICE_INFO[id] || {}).desc || '', books: (v && v.books) || {}, count: Object.values((v && v.books) || {}).reduce((x, y) => x + y, 0) }));
}
function voiceHas(v, book, chapter) { return !!(v && v.books && v.books[book] && +chapter >= 1 && +chapter <= v.books[book]); }
export function recordedAvailable(book, chapter, voice = null) {
  if (!manifest || !manifest.base) return false;
  if (voice) return voiceHas(manifest.voices[voice], book, chapter);
  return Object.values(manifest.voices).some((v) => voiceHas(v, book, chapter));
}
export function recordedVoiceFor(book, chapter) {
  if (!manifest || !manifest.base) return null;
  const pref = store.settings.recordedVoice || 'alex';
  if (voiceHas(manifest.voices[pref], book, chapter)) return pref;
  const any = Object.keys(manifest.voices).find((id) => voiceHas(manifest.voices[id], book, chapter));
  return any || null;
}
export function recordedCount(voice) {
  if (!manifest) return 0;
  const vs = voice ? [manifest.voices[voice]] : Object.values(manifest.voices);
  return vs.reduce((n, v) => n + Object.values((v && v.books) || {}).reduce((x, y) => x + y, 0), 0);
}
export function recordedSampleUrl(voice) { return manifest && manifest.base ? `${manifest.base}${voice}/sample.mp3` : ''; }
async function fetchJsonFrom(urls) {
  let err = null;
  for (const u of urls) {
    try { const r = await fetch(u); if (r.ok) return await r.json(); err = new Error(`HTTP ${r.status}`); } catch (e) { err = e; }
  }
  throw err || new Error('sem áudio');
}
export async function recordedChapter(book, chapter, voice = null) {
  await loadAudioManifest();
  const vid = voice && recordedAvailable(book, chapter, voice) ? voice : recordedVoiceFor(book, chapter);
  if (!vid) return null;
  const rel = `${vid}/${book}/${chapter}`;
  const bases = [manifest.base, manifest.fallback].filter(Boolean);
  const marks = await fetchJsonFrom(bases.map((b) => `${b}${rel}.json`));
  if (!marks || !Array.isArray(marks.v)) return null;
  const info = recordedVoices().find((v) => v.id === vid) || { name: vid };
  return { url: `${manifest.base}${rel}.mp3`, alt: manifest.fallback ? `${manifest.fallback}${rel}.mp3` : null, marks, voice: vid, voiceName: info.name, book, chapter };
}
// toca um trecho (versículos fromV..toV) de um capítulo com narração gravada; devolve false se não houver
export async function playRecordedRange({ title = '', book, chapter, fromV = 1, toV = 999, texts = new Map(), onItem = null, onEnd = null } = {}) {
  await loadAudioManifest();
  if (store.settings.recordedOn === false || !recordedAvailable(book, chapter)) return false;
  const rec = await recordedChapter(book, chapter);
  if (!rec) return false;
  const items = rec.marks.v.map(([v]) => ({ v, label: `Versículo ${v}`, text: texts.get(v) || '' }));
  const from = items.findIndex((x) => x.v >= fromV);
  let until = -1;
  items.forEach((x, i) => { if (x.v <= toV) until = i; });
  if (from < 0 || until < from) return false;
  return play({ title, items, lang: 'pt-BR', from, recorded: rec, until, onItem, onEnd, ref: { book, chapter } });
}
// troca a voz gravada; se estiver lendo com narração gravada, recomeça o versículo atual na voz nova
// devolve 'switched' (leitura recomeçou na voz nova), 'unavailable' (a voz não tem este capítulo) ou 'saved' (só guardou a preferência)
export async function setRecordedVoice(voice) {
  store.setSetting('recordedVoice', voice);
  if (!st.active || st.engine !== recEngine || !st.recInfo || !st.fallback) return 'saved';
  const { book: bk, chapter } = st.recInfo;
  if (!recordedAvailable(bk, chapter, voice)) return 'unavailable';
  const idx = st.idx;
  try {
    const rec = await recordedChapter(bk, chapter, voice);
    if (!rec || !st.active || st.engine !== recEngine) return 'saved';
    play({ ...st.fallback, from: idx, recorded: rec });
    return 'switched';
  } catch { return 'saved'; }
}
// toca a amostra de uma voz gravada (para a leitura em andamento)
let sampleEl = null;
export function playRecordedSample(voice) {
  const url = recordedSampleUrl(voice);
  if (!url) { toast('Amostra ainda não disponível'); return; }
  const wasPlaying = st.active && !st.paused;
  if (wasPlaying) pause();
  if (!sampleEl) { sampleEl = new Audio(); sampleEl.setAttribute('playsinline', ''); }
  const a = sampleEl;
  a.onended = () => { if (wasPlaying && st.active && st.paused) resume(); };
  a.onerror = () => toast('Não foi possível tocar a amostra');
  a.src = url; a.playbackRate = 1;
  a.play().catch(() => toast('Não foi possível tocar a amostra'));
}
const isIOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let speechPrimed = false;
// Chame no toque do usuário, antes de qualquer await: no iPhone/iPad o áudio e a voz só iniciam dentro de um gesto,
// então tocamos um silêncio no elemento de áudio (que depois recebe a narração) e "acordamos" a síntese de voz.
export function unlock() {
  cloudEngine.unlock();
  if (isIOS && has && !speechPrimed && !st.active) {
    speechPrimed = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch { /* ignora */ }
  }
}
// ---------- escolha unificada de voz ----------
// kind: 'rec' (voz gravada), 'dev' (voz do celular; id '' = automática), 'local' (narrador offline), 'cloud' (nuvem)
export function voiceChoice() {
  const s = store.settings;
  if (s.recordedOn !== false) return { kind: 'rec', id: s.recordedVoice || 'alex' };
  if (s.cloudOn && cloud.cloudConfigured()) return { kind: 'cloud', id: s.cloudVoice || '' };
  if (s.localVoiceOn) return { kind: 'local', id: 'faber' };
  return { kind: 'dev', id: s.ttsVoice || '' };
}
function recName(id) { return (recordedVoices().find((v) => v.id === id) || VOICE_INFO[id] || { name: id }).name; }
// nome curto da voz que está lendo (ou da escolhida, se nada estiver tocando)
export function voiceLabel() {
  if (st.active && st.engine) {
    if (st.engine === recEngine) return st.voiceName || 'Gravada';
    if (st.engine === cloudEngine) return 'Nuvem';
    if (st.engine === localEngine) return 'Faber';
    const v = chosenVoice(); return v ? shortVoiceName(v) : 'Celular';
  }
  const c = voiceChoice();
  if (c.kind === 'rec') return recName(c.id);
  if (c.kind === 'cloud') return 'Nuvem';
  if (c.kind === 'local') return 'Faber';
  const v = chosenVoice(); return v ? shortVoiceName(v) : 'Celular';
}
// aviso para quando a voz gravada escolhida ainda não tem o capítulo (a leitura segue com a voz do celular); '' se não se aplica
export function recordedMissingNotice(bk, chapter) {
  const c = voiceChoice();
  if (c.kind !== 'rec' || !manifest || recordedAvailable(bk, chapter)) return '';
  const vs = recordedVoices();
  const done = [...new Set(vs.flatMap((v) => Object.keys(v.books).filter((b) => v.books[b] > 0)))].map((b) => (book(b) ? bookName(book(b), store.settings.version) : b));
  const here = book(bk) ? `${bookName(book(bk), store.settings.version)} ${chapter}` : 'este capítulo';
  const dv = chosenVoice();
  return `A voz ${recName(c.id)} ainda não gravou ${here}: lendo com a voz do celular${dv ? ` (${shortVoiceName(dv)})` : ''}.${done.length ? ` Já gravado: ${done.join(', ')}.` : ''}`;
}
// aplica a voz escolhida; se estiver lendo, troca na hora a partir do versículo atual.
// devolve { status: 'switched' | 'unavailable' | 'saved', name }
export async function chooseVoice(kind, id = '') {
  const name = kind === 'rec' ? recName(id) : kind === 'local' ? 'Faber (narrador offline)' : kind === 'cloud' ? 'do narrador na nuvem' : (id ? `${shortVoiceName(voiceById(id) || { name: 'do celular' })} (celular)` : 'automática do celular');
  if (kind === 'rec') { store.setSetting('recordedOn', true); store.setSetting('recordedVoice', id); }
  else {
    store.setSetting('recordedOn', false);
    store.setSetting('cloudOn', kind === 'cloud');
    store.setSetting('localVoiceOn', kind === 'local');
    if (kind === 'dev') store.setSetting('ttsVoice', id);
    if (kind === 'local') localEngine.reset();
    if (kind === 'cloud') cloud.resetCloud();
  }
  if (!st.active) return { status: 'saved', name };
  if (kind === 'rec') {
    if (st.engine === recEngine) return { status: await setRecordedVoice(id), name };
    const ref = st.ref, base = st.base;
    if (ref && base && recordedAvailable(ref.book, ref.chapter, id)) {
      const curV = (st.items[st.idx] || {}).v;
      let rec = null;
      try { rec = await recordedChapter(ref.book, ref.chapter, id); } catch { rec = null; }
      if (!rec || !st.active) return { status: 'saved', name };
      const texts = new Map(base.items.filter((x) => x.v).map((x) => [x.v, x.text]));
      const intro = base.items.find((x) => x.kind === 'intro');
      const items = [...(intro ? [intro] : []), ...rec.marks.v.map(([v]) => ({ v, label: `Versículo ${v}`, text: texts.get(v) || '' }))];
      const from = curV ? Math.max(0, items.findIndex((x) => x.v === curV)) : 0;
      play({ ...base, items, from, recorded: rec });
      return { status: 'switched', name };
    }
    return { status: 'unavailable', name };
  }
  if (st.engine === recEngine) {
    const base = st.base, idx = st.idx;
    if (!base) return { status: 'saved', name };
    play({ ...base, from: idx });
    return { status: 'switched', name };
  }
  restartCurrent();
  return { status: 'switched', name };
}
const recEngine = {
  kind: 'gravado', pausable: true, rec: null, token: null, triedAlt: false,
  unlock() { cloudEngine.unlock(); },
  start(rec, fromIdx) {
    const token = {}; this.token = token; this.rec = rec; this.triedAlt = false;
    const a = mediaEl();
    a.onended = null; a.onerror = null; a.ontimeupdate = null; a.onloadedmetadata = null;
    a.src = rec.url;
    this.setRate();
    const startAt = this.itemStart(fromIdx);
    // o iPhone só começa a baixar o áudio depois do play(): chamamos play já e posicionamos no versículo quando os metadados chegarem
    const seek = () => { try { if (startAt > 0 && Math.abs(a.currentTime - startAt) > 0.5) a.currentTime = startAt; } catch { /* ignora */ } };
    if (a.readyState >= 1) seek(); else a.onloadedmetadata = () => { if (this.token === token) seek(); };
    setStatus('Carregando a narração…');
    a.ontimeupdate = () => { if (this.token === token) this.sync(); };
    a.onended = () => { if (this.token === token) finish(true); };
    a.onerror = () => { if (this.token === token) this.onFail(new Error('não foi possível carregar o áudio')); };
    a.play().then(() => { if (this.token === token) { st.errors = 0; setStatus(''); updateBar(); } }).catch((e) => { if (this.token === token) this.onFail(e); });
  },
  itemStart(idx) {
    const it = st.items[idx];
    if (!it || it.kind === 'intro' || !this.rec) return 0;
    const m = this.rec.marks.v.find((x) => x[0] === it.v);
    return m ? m[1] : 0;
  },
  sync() {
    if (!this.rec) return;
    const t = mediaEl().currentTime;
    const v = this.rec.marks.v;
    let mi = -1;
    for (let i = 0; i < v.length; i++) { if (t >= v[i][1] - 0.05) mi = i; else break; }
    let idx = mi < 0 ? st.items.findIndex((x) => x.kind === 'intro') : st.items.findIndex((x) => x.v === v[mi][0]);
    if (idx < 0) {
      const last = st.items[st.items.length - 1];
      if (mi >= 0 && last && last.v && v[mi][0] > last.v) { finish(true); return; }   // passou do último versículo do trecho
      idx = mi < 0 ? 0 : st.idx;
    }
    if (st.until != null && idx > st.until) { finish(true); return; }
    if (idx !== st.idx) { st.idx = idx; const it = st.items[idx]; if (it && st.onItem) { try { st.onItem(idx, it); } catch { /* ignora */ } } updateBar(); }
  },
  seek(idx) {
    st.idx = idx;
    const a = mediaEl();
    try { a.currentTime = this.itemStart(idx); } catch { /* ignora */ }
    const it = st.items[idx]; if (it && st.onItem) { try { st.onItem(idx, it); } catch { /* ignora */ } }
    updateBar();
    if (!st.paused) a.play().catch(() => {});
  },
  onFail(e) {
    if (this.token === null) return;
    const a = mediaEl();
    if (this.rec && this.rec.alt && !this.triedAlt) { this.triedAlt = true; a.src = this.rec.alt; a.play().catch((e2) => this.onFail(e2)); return; }
    const blocked = e && e.name === 'NotAllowedError';
    const msg = blocked ? 'o navegador pediu um toque' : ((e && e.message) || 'erro');
    const opts = st.fallback;
    stop({ silent: true });
    toast(blocked ? 'Toque de novo em ouvir para começar a narração.' : `Narração gravada indisponível (${msg}). Usando outra voz.`, 4000);
    if (opts && !blocked) play(opts);
  },
  cancel() { this.token = null; this.rec = null; try { const a = mediaEl(); a.pause(); a.ontimeupdate = null; a.onended = null; a.onerror = null; a.onloadedmetadata = null; } catch { /* ignora */ } },
  pause() { try { mediaEl().pause(); } catch { /* ignora */ } },
  resume() { try { mediaEl().play().catch(() => {}); } catch { /* ignora */ } },
  setRate() { try { mediaEl().playbackRate = clamp(+store.settings.ttsRate || 1, 0.5, 2); } catch { /* ignora */ } },
};
function chooseEngine(lang) {
  if (cloud.cloudReady(lang)) return cloudEngine;
  if (store.settings.localVoiceOn && String(lang).toLowerCase().startsWith('pt') && localSupported() && !localEngine.failed) return localEngine;
  return sysEngine;
}
export function engineName() { return st.active && st.engine ? st.engine.kind : ''; }

// ---------- fila ----------
// items: [{ text, label?, kind? }] — onItem(i, item) ao começar cada item; onEnd(completed) ao terminar ou parar
export function play({ title = '', items = [], lang = 'pt-BR', from = 0, onItem = null, onEnd = null, recorded = null, until = null, ref = null } = {}) {
  if (recorded && items.length) {
    stop({ silent: true });
    recEngine.unlock();
    Object.assign(st, { title, items, lang, idx: clamp(from, 0, items.length - 1), onItem, onEnd, active: true, paused: false, pausedInPlace: false, errors: 0, engine: recEngine, status: '', fallback: { title, items: until != null ? items.slice(0, until + 1) : items, lang, from, onItem, onEnd }, voiceName: recorded.voiceName || '', recInfo: { book: recorded.book, chapter: recorded.chapter }, until, ref: ref || { book: recorded.book, chapter: recorded.chapter }, base: { title, items, lang, onItem, onEnd, ref: ref || { book: recorded.book, chapter: recorded.chapter } } });
    document.body.classList.add('has-player');
    renderBar();
    const it = st.items[st.idx]; if (it && onItem) { try { onItem(st.idx, it); } catch { /* ignora */ } }
    recEngine.start(recorded, st.idx);
    return true;
  }
  const engine = chooseEngine(lang);
  if (engine === sysEngine && !has) { toast('Seu navegador não tem leitura em voz'); return false; }
  const list = items.filter((x) => x && String(x.text || '').trim());
  if (!list.length) { toast('Nada para ler'); return false; }
  stop({ silent: true });
  if (engine.unlock) engine.unlock();
  Object.assign(st, { title, items: list, lang, idx: clamp(from, 0, list.length - 1), onItem, onEnd, active: true, paused: false, pausedInPlace: false, errors: 0, engine, status: '', ref, base: { title, items: list, lang, onItem, onEnd, ref } });
  document.body.classList.add('has-player');
  renderBar();
  if (engine === sysEngine) startNudge();
  speakItem();
  return true;
}
function speakItem() {
  if (!st.active) return;
  if (st.idx >= st.items.length) { finish(true); return; }
  const it = st.items[st.idx];
  st.chunks = chunksOf(it.text, it.kind);
  st.chunk = 0;
  if (st.onItem) { try { st.onItem(st.idx, it); } catch { /* ignora */ } }
  updateBar();
  speakChunk();
}
function upcomingTexts(n) {
  const out = [];
  let i = st.idx, c = st.chunk + 1, chunks = st.chunks;
  while (out.length < n && i < st.items.length) {
    if (c < chunks.length) { out.push(chunks[c].text); c++; }
    else { i++; c = 0; chunks = i < st.items.length ? chunksOf(st.items[i].text, st.items[i].kind) : []; }
  }
  return out;
}
function speakChunk() {
  if (!st.active || st.paused) return;
  if (st.chunk >= st.chunks.length) { st.idx++; speakItem(); return; }
  const chunk = st.chunks[st.chunk];
  const engine = st.engine;
  let started = false;
  const cb = {
    onstart: () => { started = true; st.errors = 0; clearTimeout(st.watchdog); if (engine.prefetch) engine.prefetch(upcomingTexts(2)); },
    onend: () => { if (!st.active || st.paused || st.engine !== engine) return; clearTimeout(st.watchdog); afterChunk(chunk); },
    onerror: (e) => {
      if (!st.active || st.engine !== engine) return;
      clearTimeout(st.watchdog);
      if (engine === cloudEngine || engine === localEngine) {
        // narrador na nuvem/offline falhou: avisa e continua com a voz do aparelho
        const msg = (e && e.message) || 'erro';
        const name = engine === cloudEngine ? 'Narrador na nuvem' : 'Narrador offline';
        if (engine === localEngine) localEngine.fail(msg);
        st.engine = sysEngine; setStatus('');
        if (has) { toast(`${name} indisponível (${msg}). Usando a voz do aparelho.`, 4000); startNudge(); updateBar(); speakChunk(); }
        else { stop(); toast(`${name} indisponível: ${msg}`, 4000); }
        return;
      }
      st.errors = (st.errors || 0) + 1;
      if (st.errors >= 3) { stop(); toast('Não foi possível ler em voz alta neste aparelho'); return; }
      st.chunk++; speakChunk();
    },
  };
  clearTimeout(st.watchdog);
  st.watchdog = setTimeout(() => {
    if (started || !st.active || st.paused) return;
    if (engine === sysEngine && !voices().length) { stop(); toast('Nenhuma voz de leitura disponível neste aparelho'); }
  }, engine === localEngine ? 180000 : 8000);
  engine.speak(chunk.text, cb);
}
function afterChunk(chunk) {
  st.chunk++;
  clearTimeout(st.gap);
  if (chunk.gap > 0) st.gap = setTimeout(() => { if (st.active && !st.paused) speakChunk(); }, chunk.gap);
  else speakChunk();
}
// Chrome (computador) interrompe falas longas em silêncio; pausar/retomar a cada 10 s evita isso
function startNudge() {
  if (!isDesktopChrome || st.nudge) return;
  st.nudge = setInterval(() => {
    try { if (st.active && !st.paused && st.engine === sysEngine && speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); } } catch { /* ignora */ }
  }, 10000);
}
function stopNudge() { clearInterval(st.nudge); st.nudge = null; }

export function pause() {
  if (!st.active || st.paused) return;
  st.paused = true;
  clearTimeout(st.watchdog); clearTimeout(st.gap);
  if (st.engine.pausable) { st.pausedInPlace = true; st.engine.pause(); }
  else { st.pausedInPlace = false; st.engine.cancel(); }
  updateBar();
}
export function resume() {
  if (!st.active || !st.paused) return;
  st.paused = false;
  updateBar();
  if (st.pausedInPlace) { st.pausedInPlace = false; st.engine.resume(); }
  else speakChunk();                       // recomeça o trecho atual
}
export function toggle() { if (!st.active) return; if (st.paused) resume(); else pause(); }
export function skip(delta) {
  if (!st.active) return;
  if (st.engine === recEngine) { st.paused = false; st.pausedInPlace = false; recEngine.seek(clamp(st.idx + delta, 0, st.items.length - 1)); return; }
  st.idx = clamp(st.idx + delta, 0, st.items.length - 1);
  st.paused = false; st.pausedInPlace = false;
  clearTimeout(st.gap);
  st.engine.cancel();
  speakItem();
}
function teardown() {
  const onEnd = st.onEnd;
  const engine = st.engine;
  st.active = false; st.paused = false; st.pausedInPlace = false; st.onEnd = null; st.onItem = null; st.items = []; st.status = ''; st.fallback = null; st.voiceName = ''; st.recInfo = null; st.until = null; st.ref = null; st.base = null;
  clearTimeout(st.watchdog); clearTimeout(st.restart); clearTimeout(st.gap);
  stopNudge();
  if (engine) engine.cancel(); else sysEngine.cancel();
  document.body.classList.remove('has-player');
  try { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'; } catch { /* ignora */ }
  renderBar();
  return onEnd;
}
export function stop({ silent = false } = {}) {
  const was = st.active;
  const onEnd = teardown();
  if (was && onEnd && !silent) { try { onEnd(false); } catch { /* ignora */ } }
}
function finish(completed) {
  const onEnd = teardown();
  if (onEnd) { try { onEnd(completed); } catch { /* ignora */ } }
}
// mudança de voz/velocidade/tom/estilo durante a leitura: recomeça o trecho atual com os novos valores
function restartCurrent() {
  if (!st.active || st.paused) return;
  if (st.engine === recEngine) { recEngine.setRate(); return; }
  clearTimeout(st.restart);
  st.restart = setTimeout(() => {
    if (!st.active || st.paused) return;
    clearTimeout(st.gap);
    st.engine.cancel();
    st.engine = chooseEngine(st.lang);
    if (st.engine.unlock) st.engine.unlock();
    if (st.engine === sysEngine) startNudge();
    updateBar();
    speakChunk();
  }, 350);
}
function applyRateLive() {
  if (st.active && st.engine.setRate) st.engine.setRate();
  else restartCurrent();
}

// ---------- continuar no próximo capítulo ----------
export function requestAutoplay(key) { st.autoplay = { key, at: Date.now() }; }
export function consumeAutoplay(key) {
  const a = st.autoplay; st.autoplay = null;
  return !!(a && a.key === key && Date.now() - a.at < 20000);
}

// ---------- temporizador ----------
export function timer() { return st.timerEnd ? { end: st.timerEnd, remaining: Math.max(0, st.timerEnd - Date.now()), mode: st.timerMode, value: st.timerValue } : null; }
// mode: 'off' | 'min' (value = minutos) | 'time' (value = "HH:MM")
export function setTimer(mode, value) {
  clearInterval(st.timerTick);
  st.timerEnd = null; st.timerMode = null; st.timerValue = null;
  if (mode === 'min' && +value > 0) { st.timerEnd = Date.now() + (+value) * 60000; st.timerMode = 'min'; st.timerValue = +value; }
  else if (mode === 'time' && /^\d{1,2}:\d{2}$/.test(String(value || ''))) {
    const [hh, mm] = String(value).split(':').map(Number);
    const d = new Date(); d.setHours(hh, mm, 0, 0);
    if (d.getTime() <= Date.now() + 1000) d.setDate(d.getDate() + 1);
    st.timerEnd = d.getTime(); st.timerMode = 'time'; st.timerValue = value;
  }
  if (st.timerEnd) st.timerTick = setInterval(tick, 1000);
  updateTimerLabels();
  return st.timerEnd;
}
function tick() {
  if (!st.timerEnd) { clearInterval(st.timerTick); return; }
  if (Date.now() >= st.timerEnd) {
    clearInterval(st.timerTick);
    st.timerEnd = null; st.timerMode = null; st.timerValue = null;
    if (st.active) { stop(); toast('Leitura encerrada pelo temporizador'); }
    updateTimerLabels();
    return;
  }
  updateTimerLabels();
}
export function fmtRemaining(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
}
function fmtClock(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function updateTimerLabels() {
  const t = timer();
  const bar = $('#player-root .p-timer');
  if (bar) { bar.innerHTML = t ? `${I.timer}${fmtRemaining(t.remaining)}` : ''; bar.hidden = !t; }
  const lab = $('#au-timer-state');
  if (lab) lab.textContent = t ? `A leitura para em ${fmtRemaining(t.remaining)} (às ${fmtClock(t.end)}).` : 'Temporizador desligado: a leitura vai até o fim do texto.';
  $$('#au-timer-chips .chip').forEach((c) => {
    if (c.dataset.min !== undefined) c.classList.toggle('on', t ? (t.mode === 'min' && +c.dataset.min === t.value) : +c.dataset.min === 0);
    else c.classList.toggle('on', !!t && t.mode === 'time');
  });
}

// ---------- tela de bloqueio (Media Session) ----------
function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    const it = st.items[st.idx] || {};
    navigator.mediaSession.metadata = new MediaMetadata({ title: st.title || 'Leitura', artist: 'Bíblia Católica', album: it.label || '' });
    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('stop', () => stop());
    navigator.mediaSession.setActionHandler('previoustrack', () => skip(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => skip(1));
    navigator.mediaSession.playbackState = st.paused ? 'paused' : 'playing';
  } catch { /* ignora */ }
}

// ---------- barra de controle ----------
function root() {
  let r = document.getElementById('player-root');
  if (!r) { r = h('<div id="player-root"></div>'); document.body.append(r); }
  return r;
}
function renderBar() {
  const r = root();
  if (!st.active) { r.innerHTML = ''; return; }
  r.innerHTML = `<div class="player" role="region" aria-label="Leitura em voz alta">
    <div class="p-info"><div class="p-title"></div><div class="p-sub"><span class="p-pos"></span><span class="p-rate"></span><span class="p-engine" hidden title="Narrador na nuvem">${I.cloud}</span><span class="p-timer" hidden></span><button class="p-voice" data-act="voice" aria-label="Trocar a voz">${I.mic}<span></span></button></div></div>
    <div class="p-ctl">
      <button data-act="prev" aria-label="Trecho anterior">${I.prev}</button>
      <button data-act="toggle" class="big" aria-label="Pausar">${I.pause}</button>
      <button data-act="next" aria-label="Próximo trecho">${I.next}</button>
      <button data-act="cfg" aria-label="Voz, velocidade e temporizador">${I.sliders}</button>
      <button data-act="stop" aria-label="Parar leitura">${icon('close')}</button>
    </div></div>`;
  $('[data-act=prev]', r).onclick = () => skip(-1);
  $('[data-act=next]', r).onclick = () => skip(1);
  $('[data-act=toggle]', r).onclick = () => toggle();
  $('[data-act=cfg]', r).onclick = () => openAudioSheet();
  $('[data-act=voice]', r).onclick = () => openVoicePicker();
  $('[data-act=stop]', r).onclick = () => stop();
  updateBar();
}
function updateBar() {
  const r = root();
  if (!st.active || !r.firstChild) return;
  const it = st.items[st.idx] || {};
  $('.p-title', r).textContent = st.title || 'Leitura';
  $('.p-pos', r).textContent = `${st.status || (it.label ? it.label : `${st.idx + 1} de ${st.items.length}`)} · `;
  $('.p-rate', r).textContent = fmtRate(store.settings.ttsRate);
  const pv = $('.p-voice span', r); if (pv) pv.textContent = voiceLabel();
  const eng = $('.p-engine', r); eng.hidden = !(st.engine === cloudEngine || st.engine === localEngine || st.engine === recEngine); eng.innerHTML = st.engine === recEngine ? I.mic : st.engine === localEngine ? I.chip : I.cloud; eng.title = st.engine === recEngine ? `Narração gravada${st.voiceName ? ' · ' + st.voiceName : ''}` : st.engine === localEngine ? 'Narrador offline' : 'Narrador na nuvem';
  const tg = $('[data-act=toggle]', r);
  tg.innerHTML = st.paused ? icon('play') : I.pause;
  tg.setAttribute('aria-label', st.paused ? 'Continuar' : 'Pausar');
  updateTimerLabels();
  mediaSession();
}

// ---------- painel de voz e áudio ----------
const SAMPLE = 'No princípio criou Deus o céu e a terra. E a terra era vazia e vaga, e as trevas cobriam a face do abismo. E disse Deus: Faça-se a luz. E a luz foi feita.';
function testDeviceVoice(id) {
  if (!has) { toast('Seu navegador não tem leitura em voz'); return; }
  const wasPlaying = st.active && !st.paused;
  if (wasPlaying) pause();
  const s = store.settings;
  const v = id === undefined ? (chosenVoice() || pickVoice('pt-BR')) : (id ? voiceById(id) : pickVoice('pt-BR'));
  const u = new SpeechSynthesisUtterance(SAMPLE);
  u.lang = v ? v.lang : 'pt-BR';
  u.rate = clamp(+s.ttsRate || 1, 0.5, 2);
  u.pitch = clamp(+s.ttsPitch || 1, 0.5, 2);
  if (v) u.voice = v;
  u.onend = () => { if (wasPlaying) resume(); };
  u.onerror = () => { if (wasPlaying) resume(); };
  try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { toast('Não foi possível testar a voz'); }
}
function testCloudVoice() {
  const s = store.settings;
  if (!s.cloudKey) { toast('Cole a chave da API primeiro'); return; }
  if (!s.cloudVoice) { toast('Toque em "Verificar chave e listar vozes" para escolher uma voz'); return; }
  cloud.resetCloud();
  const wasOff = !s.cloudOn;
  if (wasOff) store.setSetting('cloudOn', true);
  const ok = play({ title: 'Teste do narrador', items: [{ text: SAMPLE, label: 'Gênesis 1' }], lang: 'pt-BR', onEnd: () => { if (wasOff) store.setSetting('cloudOn', false); } });
  if (!ok && wasOff) store.setSetting('cloudOn', false);
}

function cloudHelp() {
  const { el, close } = openModal(`<div class="au-help">
    <h3>Narrador humano na nuvem</h3>
    <p class="small">As vozes do celular são limitadas. Com uma chave do <b>Google Cloud Text-to-Speech</b>, o app usa as vozes neurais do Google, masculinas e muito naturais, com controles na tela de bloqueio e leitura mesmo com a tela apagada. A chave é sua, fica só neste aparelho e não entra no backup.</p>
    <ol class="small">
      <li>Entre em <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> com sua conta Google e crie um projeto.</li>
      <li>Em <b>APIs e serviços › Biblioteca</b>, procure <b>Cloud Text-to-Speech API</b> e toque em <b>Ativar</b>.</li>
      <li>Ative o <b>faturamento</b> do projeto (pede um cartão). Há uma cota gratuita mensal, em geral 1 milhão de caracteres nas vozes neurais, o que dá cerca de 250 capítulos por mês; acima disso o Google cobra por caractere. Confira a <a href="https://cloud.google.com/text-to-speech/pricing" target="_blank" rel="noopener">página de preços</a>.</li>
      <li>Em <b>APIs e serviços › Credenciais</b>, toque em <b>Criar credenciais › Chave de API</b>. Em restrições, limite a chave à API Cloud Text-to-Speech e aos sites do app (por exemplo <code>https://jokanaka.github.io/*</code>).</li>
      <li>Cole a chave no painel de áudio e toque em <b>Verificar chave</b>. Escolha a voz (Charon, Orus e Fenrir são masculinas e muito naturais) e ligue <b>Usar narrador na nuvem</b>.</li>
    </ol>
    <p class="small muted">Cada trecho lido fica guardado no aparelho; reler o mesmo capítulo não gasta a cota de novo.</p>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn primary" data-act="x">Entendi</button></div>
  </div>`);
  $('[data-act=x]', el).onclick = () => close();
}

// Seletor único de voz: vozes gravadas, vozes do celular e (no modo avançado) os outros narradores
export function openVoicePicker() {
  const s = store.settings;
  const advanced = s.uiMode === 'avancado';
  const hm = /^#\/biblia\/([a-z0-9]+)\/(\d+)/.exec(location.hash || '');
  const cur = st.ref || (hm && book(hm[1]) ? { book: hm[1], chapter: +hm[2] } : null);
  const curName = cur && book(cur.book) ? `${bookName(book(cur.book), s.version)} ${cur.chapter}` : '';
  const list = voices();
  const pt = list.filter((v) => lb(v.lang).startsWith('pt'));
  const others = list.filter((v) => !lb(v.lang).startsWith('pt'));
  const gtag = (v) => { const g = voiceGender(v); return g === 'M' ? ' · masculina' : g === 'F' ? ' · feminina' : ''; };
  const row = (kind, id, name, desc, on, sample) => `<div class="voice-row ${on ? 'on' : ''}" data-kind="${kind}" data-id="${esc(id)}">
      <button class="vmain" data-act="pick"><span class="vname">${esc(name)}</span><span class="vdesc">${desc}</span></button>
      ${sample ? `<button class="vplay" data-act="sample" aria-label="Ouvir amostra de ${esc(name)}">${icon('play')}</button>` : ''}
    </div>`;
  const recRows = () => {
    const c = voiceChoice();
    const vs = recordedVoices();
    const items = vs.length ? vs : Object.entries(VOICE_INFO).map(([id, v]) => ({ id, name: v.name, desc: v.desc, count: 0, books: {} }));
    return items.map((v) => {
      const here = cur ? voiceHas(v, cur.book, cur.chapter) : false;
      const desc = `${esc(v.desc)} · ${v.count ? `${v.count} ${v.count === 1 ? 'capítulo' : 'capítulos'}` : 'em preparação'}${cur ? (here ? ` · <b>lê ${esc(curName)}</b>` : (v.count ? ` · ainda não tem ${esc(curName)}` : '')) : ''}`;
      return row('rec', v.id, v.name, desc, c.kind === 'rec' && c.id === v.id, !!recordedSampleUrl(v.id));
    }).join('');
  };
  const c = voiceChoice();
  const devRows = [
    row('dev', '', 'Automática', `a melhor voz em português do celular${s.ttsMale ? ', masculina se houver' : ''}`, c.kind === 'dev' && !c.id, true),
    ...pt.map((v) => row('dev', v.voiceURI, shortVoiceName(v), `${esc(v.lang)}${gtag(v)}${v.localService ? '' : ' · online'}`, c.kind === 'dev' && c.id === v.voiceURI, true)),
    ...(advanced ? others.map((v) => row('dev', v.voiceURI, shortVoiceName(v), `${esc(v.lang)}${gtag(v)}`, c.kind === 'dev' && c.id === v.voiceURI, true)) : []),
  ].join('');
  const extra = advanced ? [
    localSupported() ? row('local', 'faber', 'Faber (narrador offline)', 'voz masculina gerada no celular; baixa cerca de 90 MB uma vez', c.kind === 'local', false) : '',
    cloud.cloudConfigured() ? row('cloud', '', 'Narrador na nuvem', 'Google Cloud com a sua chave', c.kind === 'cloud', false) : '',
  ].join('') : '';
  const { el, close } = openSheet(`<h3>Voz da leitura</h3>
    <p class="small muted">Toque numa voz para ler com ela agora. As vozes gravadas leem os capítulos já narrados; nos outros, o app usa a voz do celular.</p>
    <div class="section-title">Vozes gravadas (humanas)</div><div id="vp-rec">${recRows()}</div>
    <div class="section-title" style="margin-top:14px">Vozes do celular</div><div id="vp-dev">${devRows}</div>
    ${extra ? `<div class="section-title" style="margin-top:14px">Outros narradores</div>${extra}` : ''}
    <div class="row" style="margin-top:14px"><span class="grow"></span><button class="btn primary" data-act="ok">Pronto</button></div>`);
  const explain = (res) => {
    if (res.status === 'switched') return `Lendo com a voz ${res.name}`;
    if (res.status === 'unavailable') {
      const done = [...new Set(recordedVoices().flatMap((v) => Object.keys(v.books).filter((b) => v.books[b] > 0)))].map((b) => (book(b) ? bookName(book(b), s.version) : b));
      return `${res.name} vai ler os capítulos já gravados${done.length ? ` (${done.join(', ')})` : ''}. ${curName || 'Este capítulo'} ainda não tem gravação e continua com ${voiceLabel()}.`;
    }
    return `Voz escolhida: ${res.name}`;
  };
  const bind = () => {
    $$('.voice-row', el).forEach((r) => {
      $('[data-act=pick]', r).onclick = async () => {
        $$('.voice-row', el).forEach((x) => x.classList.toggle('on', x === r));
        unlock();
        const res = await chooseVoice(r.dataset.kind, r.dataset.id);
        toast(explain(res), res.status === 'unavailable' ? 5000 : 2500);
        close();
      };
      const sp = $('[data-act=sample]', r);
      if (sp) sp.onclick = () => { unlock(); if (r.dataset.kind === 'rec') playRecordedSample(r.dataset.id); else testDeviceVoice(r.dataset.id); };
    });
  };
  bind();
  loadAudioManifest().then(() => { const x = $('#vp-rec', el); if (x) { x.innerHTML = recRows(); bind(); } });
  $('[data-act=ok]', el).onclick = () => close();
}

export function openAudioSheet() {
  const s = store.settings;
  const simple = s.uiMode !== 'avancado';
  // capítulo aberto no leitor (para dizer se ele tem narração gravada)
  const hm = /^#\/biblia\/([a-z0-9]+)\/(\d+)/.exec(location.hash || '');
  const cur = hm && book(hm[1]) ? { book: hm[1], chapter: +hm[2] } : null;
  const curName = cur ? `${bookName(book(cur.book), s.version)} ${cur.chapter}` : '';
  const list = voices();
  const pt = list.filter((v) => lb(v.lang).startsWith('pt'));
  const others = list.filter((v) => !lb(v.lang).startsWith('pt'));
  const sel = (v) => s.ttsVoice && (s.ttsVoice === v.voiceURI || s.ttsVoice === v.name);
  const gtag = (v) => { const g = voiceGender(v); return g === 'M' ? ' · masculina' : g === 'F' ? ' · feminina' : ''; };
  const opt = (v) => `<option value="${esc(v.voiceURI)}" ${sel(v) ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}${gtag(v)}${v.localService ? '' : ' · online'}</option>`;
  const cv = s.cloudVoices || [];
  const copt = (v) => `<option value="${esc(v.name)}" ${s.cloudVoice === v.name ? 'selected' : ''}>${esc(cloud.describeVoice(v))}</option>`;
  const mins = [0, 5, 10, 15, 30, 45, 60];
  const voiceRowHtml = `<div class="setting"><span>Voz</span><button class="btn sm primary" data-act="voice" id="au-voice-btn">${I.mic} <span>${esc(voiceLabel())}</span> ▾</button></div>
    <p class="small muted" style="margin:-4px 0 8px">Toque em Voz para escolher entre as vozes gravadas (Alex, Santa, Dora) e as vozes do celular. A troca vale na hora.</p>`;
  const voiceSelect = `<select id="au-voice" class="input" aria-label="Voz do aparelho">
      <option value="">Automática (${s.ttsMale ? 'masculina em português, se houver' : 'português'})</option>
      ${pt.length ? `<optgroup label="Português">${pt.map(opt).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="Outras línguas">${others.map(opt).join('')}</optgroup>` : ''}
    </select>`;
  const nowHtml = `<p class="small" id="au-now" style="margin:0 0 6px;line-height:1.45"></p><p class="small muted" id="au-diag" style="margin:0 0 10px;font-family:ui-monospace,monospace;font-size:11px;word-break:break-all" hidden></p>`;
  const deviceHtml = `
    <div class="setting"><span>Preferir voz masculina</span><button class="switch ${s.ttsMale ? 'on' : ''}" data-act="male" aria-label="Preferir voz masculina"></button></div>
    <div class="setting"><span>Estilo</span><div class="seg" id="au-style"><button data-v="normal" class="${s.ttsStyle === 'normal' ? 'on' : ''}">Normal</button><button data-v="narracao" class="${s.ttsStyle !== 'normal' ? 'on' : ''}">Narração</button></div></div>
    <p class="small muted" style="margin:-4px 0 8px">Narração: fala mais pausada, com respiro entre as frases e os versículos, e apresenta o capítulo como quem conta uma história.</p>
    <label class="au-label" for="au-voice">Voz do aparelho</label>
    ${voiceSelect}
    <p class="small muted" style="margin-top:6px">${list.length ? 'Para uma voz masculina melhor no aparelho: no Android, em Configurações › Sistema › Idiomas › Saída de conversão de texto em voz, instale as vozes em português do Google e escolha uma masculina; no iPhone, em Ajustes › Acessibilidade › Conteúdo falado › Vozes › Português, baixe a voz "Felipe".' : 'Nenhuma voz encontrada ainda. No Android, instale o "Serviço de conversão de texto em voz do Google" e as vozes em português; no iPhone, as vozes ficam em Ajustes › Acessibilidade › Conteúdo falado.'}</p>`;
  const rateHtml = `
    <div class="setting"><span>Velocidade</span><b id="au-rate-v">${fmtRate(s.ttsRate)}</b></div>
    <div class="row au-range"><button class="btn sm" data-act="slower" aria-label="Mais devagar">−</button><input type="range" id="au-rate" min="0.5" max="2" step="0.05" value="${+s.ttsRate || 1}" aria-label="Velocidade da voz"><button class="btn sm" data-act="faster" aria-label="Mais rápido">+</button></div>`;
  const pitchHtml = `
    <div class="setting"><span>Tom da voz</span><b id="au-pitch-v">${fmtNum(s.ttsPitch)}</b></div>
    <div class="row au-range"><span class="small muted">grave</span><input type="range" id="au-pitch" min="0.5" max="2" step="0.05" value="${+s.ttsPitch || 1}" aria-label="Tom da voz"><span class="small muted">agudo</span></div>`;
  const contHtml = `<div class="setting"><span>Continuar no próximo capítulo</span><button class="switch ${s.ttsContinue ? 'on' : ''}" data-act="cont" aria-label="Continuar no próximo capítulo"></button></div>`;
  const timerHtml = `
    <div class="section-title" style="margin-top:14px">Parar de ler</div>
    <div class="chips" id="au-timer-chips">${mins.map((m) => `<button class="chip" data-min="${m}">${m ? `${m} min` : 'Desligado'}</button>`).join('')}<button class="chip" data-act="attime">No horário…</button></div>
    <div class="row" id="au-time-row" style="margin-top:10px" hidden><input type="time" id="au-time" class="input" value="${esc(s.ttsTimerTime || '22:00')}" aria-label="Horário para parar"><button class="btn sm primary" data-act="settime">Parar nesse horário</button></div>
    <p class="small muted" id="au-timer-state" style="margin-top:8px"></p>`;
  const localHtml = `
    <div class="section-title" style="margin-top:16px">Narrador masculino grátis (no aparelho)</div>
    <p class="small muted">Voz masculina brasileira "Faber", gerada no próprio celular, sem conta nem chave. Baixa cerca de 90 MB uma única vez (use Wi-Fi) e precisa de um aparelho razoavelmente recente; soa mais natural que a maioria das vozes do celular, mas menos que a narração gravada.</p>
    <div class="setting"><span>Usar narrador offline</span><button class="switch ${s.localVoiceOn ? 'on' : ''}" data-act="local-on" aria-label="Usar narrador offline"></button></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="local-prepare">Baixar a voz agora</button><span class="small muted" id="au-local-state"></span></div>`;
  const cloudHtml = `
    <div class="section-title" style="margin-top:16px">Narrador na nuvem (opcional, com conta própria)</div>
    <p class="small muted">Vozes neurais do Google com a sua própria chave do Google Cloud. Tem cota gratuita mensal, mas exige conta com cartão. <a href="#" data-act="cloud-help">Como conseguir a chave</a></p>
    <div class="setting"><span>Usar narrador na nuvem</span><button class="switch ${s.cloudOn ? 'on' : ''}" data-act="cloud-on" aria-label="Usar narrador na nuvem"></button></div>
    <div class="row" style="gap:8px"><input type="password" id="au-key" class="input" placeholder="Chave da API do Google Cloud" value="${esc(s.cloudKey || '')}" autocomplete="off" spellcheck="false" aria-label="Chave da API"><button class="btn sm" data-act="showkey" aria-label="Mostrar chave">👁</button></div>
    <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="cloud-check">Verificar chave e listar vozes</button><span class="small muted" id="au-cloud-state">${cv.length ? `${cv.length} vozes disponíveis` : ''}</span></div>
    <select id="au-cloud-voice" class="input" style="margin-top:8px" aria-label="Voz do narrador" ${cv.length ? '' : 'hidden'}>${cv.map(copt).join('')}</select>`;
  const footer = simple
    ? `<div class="row" style="margin-top:14px;gap:8px"><button class="btn" data-act="advanced">Opções avançadas</button><span class="grow"></span><button class="btn primary" data-act="ok">Pronto</button></div>`
    : `<div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap"><button class="btn" data-act="test">${icon('play')} Testar voz do aparelho</button><button class="btn" data-act="cloud-test">${I.cloud} Testar narrador</button><span class="grow"></span><button class="btn primary" data-act="ok">Pronto</button></div>
       <p class="small muted" style="margin-top:10px"><a href="#" data-act="simple">Voltar ao modo simples</a></p>`;
  const { el, close } = openSheet(simple
    ? `<h3>Voz e áudio</h3>${nowHtml}${voiceRowHtml}${rateHtml}${contHtml}${timerHtml}${footer}`
    : `<h3>Voz e áudio</h3>${nowHtml}${voiceRowHtml}${deviceHtml}${rateHtml}${pitchHtml}${contHtml}${timerHtml}${localHtml}${cloudHtml}${footer}`);
  const q = (selector) => $(selector, el);
  const on = (selector, fn) => { const x = q(selector); if (x) x.onclick = fn; return x; };
  const setRate = (x) => {
    const r = clamp(Math.round(x * 20) / 20, 0.5, 2);
    store.setSetting('ttsRate', r);
    if (q('#au-rate')) q('#au-rate').value = r;
    if (q('#au-rate-v')) q('#au-rate-v').textContent = fmtRate(r);
    const pr = $('#player-root .p-rate'); if (pr) pr.textContent = fmtRate(r);
    applyRateLive();
  };
  on('[data-act=voice]', () => { close(); openVoicePicker(); });
  on('[data-act=advanced]', () => { store.setSetting('uiMode', 'avancado'); close(); openAudioSheet(); });
  on('[data-act=simple]', (e) => { e.preventDefault(); store.setSetting('uiMode', 'simples'); close(); openAudioSheet(); });
  on('[data-act=male]', (e) => { store.setSetting('ttsMale', !store.settings.ttsMale); e.currentTarget.classList.toggle('on', store.settings.ttsMale); const o = q('#au-voice option[value=""]'); if (o) o.textContent = `Automática (${store.settings.ttsMale ? 'masculina em português, se houver' : 'português'})`; restartCurrent(); });
  $$('#au-style button', el).forEach((b) => b.onclick = () => { $$('#au-style button', el).forEach((x) => x.classList.remove('on')); b.classList.add('on'); store.setSetting('ttsStyle', b.dataset.v); restartCurrent(); });
  if (q('#au-voice')) q('#au-voice').onchange = (e) => { store.setSetting('ttsVoice', e.target.value); restartCurrent(); };
  if (q('#au-rate')) q('#au-rate').oninput = (e) => setRate(+e.target.value);
  on('[data-act=slower]', () => setRate((+store.settings.ttsRate || 1) - 0.1));
  on('[data-act=faster]', () => setRate((+store.settings.ttsRate || 1) + 0.1));
  if (q('#au-pitch')) q('#au-pitch').oninput = (e) => { const p = clamp(+e.target.value, 0.5, 2); store.setSetting('ttsPitch', p); q('#au-pitch-v').textContent = fmtNum(p); restartCurrent(); };
  on('[data-act=cont]', (e) => { store.setSetting('ttsContinue', !store.settings.ttsContinue); e.currentTarget.classList.toggle('on', store.settings.ttsContinue); });
  $$('#au-timer-chips [data-min]', el).forEach((c) => c.onclick = () => {
    const m = +c.dataset.min;
    q('#au-time-row').hidden = true;
    if (m) store.setSetting('ttsTimerMin', m);
    setTimer(m ? 'min' : 'off', m);
    toast(m ? `A leitura para em ${m} min` : 'Temporizador desligado');
  });
  on('[data-act=attime]', () => { const row = q('#au-time-row'); row.hidden = !row.hidden; if (!row.hidden) q('#au-time').focus(); });
  on('[data-act=settime]', () => {
    const v = q('#au-time').value;
    if (!v) { toast('Escolha um horário'); return; }
    store.setSetting('ttsTimerTime', v);
    const end = setTimer('time', v);
    if (end) toast(`A leitura para às ${fmtClock(end)}`);
  });
  // narração gravada
  const engineLabel = () => {
    if (!st.active || !st.engine) return '';
    if (st.engine === recEngine) return `a voz <b>${esc(st.voiceName || 'gravada')}</b> (narração gravada)`;
    if (st.engine === cloudEngine) return 'o narrador na nuvem';
    if (st.engine === localEngine) return 'o narrador offline';
    return 'a <b>voz do aparelho</b>';
  };
  // o que está lendo agora e se o capítulo aberto tem narração gravada
  const fillNow = () => {
    const x = q('#au-now'); if (!x) return;
    const vs = recordedVoices();
    const here = cur ? vs.filter((v) => voiceHas(v, cur.book, cur.chapter)).map((v) => v.name) : [];
    const doneIds = [...new Set(vs.flatMap((v) => Object.keys(v.books).filter((id) => v.books[id] > 0)))];
    const doneNames = doneIds.map((id) => (book(id) ? bookName(book(id), s.version) : id));
    const parts = [];
    if (st.active) parts.push(`Lendo agora: <b>${esc(st.title)}</b> com ${engineLabel()}.`);
    if (cur && here.length) parts.push(`${esc(curName)} tem narração gravada (${esc(here.join(', '))}).`);
    else if (cur && manifest) parts.push(`<b>${esc(curName)}</b> ainda não tem narração gravada, então a leitura usa a voz do aparelho.${doneIds.length ? ` Já gravado: ${esc(doneNames.join(', '))}. <a href="#" data-act="go-rec">Ouvir ${esc(doneNames[0])} 1</a>` : ' Os primeiros capítulos estão sendo produzidos.'}`);
    x.innerHTML = parts.join(' ');
    x.hidden = !parts.length;
    // linha técnica para diagnóstico (motor, voz, arquivo tocando, estado do áudio, aparelho)
    const d = q('#au-diag');
    if (d) {
      if (st.active && st.engine) {
        const a = st.engine === sysEngine ? null : mediaEl();
        const src = a && a.src && !a.src.startsWith('data:') ? a.src.replace(/^.*\/([^/]+\/[^/]+\/[^/]+)$/, '$1') : '';
        const ua = /iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'desktop';
        const c = voiceChoice();
        d.textContent = `motor ${st.engine.kind} · escolha ${c.kind}:${c.id || 'auto'}${src ? ` · ${src}` : ''}${a ? ` · ${a.paused ? 'pausado' : 'tocando'} ${a.readyState}/${Math.round(a.currentTime)}s` : ''} · ${ua}${navigator.serviceWorker && navigator.serviceWorker.controller ? ' · sw' : ''}`;
        d.hidden = false;
      } else d.hidden = true;
    }
    const go = q('[data-act=go-rec]'); if (go) go.onclick = (e) => { e.preventDefault(); close(); location.hash = `#/biblia/${doneIds[0]}/1`; };
  };
  fillNow();
  loadAudioManifest().then(fillNow);
  // narrador offline
  const localState = (x) => {
    const el2 = q('#au-local-state'); if (!el2) return;
    el2.textContent = x.s === 'pronto' ? 'Voz pronta ✓' : x.s === 'carregando' ? (x.pct != null ? `Baixando a voz… ${x.pct}%` : 'Preparando a voz…') : x.s === 'erro' ? `Erro: ${x.msg}` : (localSupported() ? '' : 'Este navegador não suporta o narrador offline.');
    el2.style.color = x.s === 'erro' ? 'var(--accent)' : '';
  };
  if (!simple) { localState(localEngine.state()); localEngine.listeners.add(localState); }
  on('[data-act=local-on]', (e) => {
    const onv = !store.settings.localVoiceOn;
    if (onv && !localSupported()) { toast('Este navegador não suporta o narrador offline'); return; }
    store.setSetting('localVoiceOn', onv);
    e.currentTarget.classList.toggle('on', onv);
    if (onv) { localEngine.reset(); localEngine.ensure(); toast('Narrador offline ligado: a voz será baixada na primeira leitura'); }
    else toast('Narrador offline desligado');
    restartCurrent();
  });
  on('[data-act=local-prepare]', () => { if (!localSupported()) { toast('Este navegador não suporta o narrador offline'); return; } localEngine.reset(); localEngine.ensure(); });
  // narrador na nuvem
  const cloudState = (msg, bad) => { const x = q('#au-cloud-state'); if (!x) return; x.textContent = msg; x.style.color = bad ? 'var(--accent)' : ''; };
  on('[data-act=cloud-help]', (e) => { e.preventDefault(); cloudHelp(); });
  on('[data-act=showkey]', () => { const k = q('#au-key'); k.type = k.type === 'password' ? 'text' : 'password'; });
  if (q('#au-key')) q('#au-key').onchange = (e) => { store.setSetting('cloudKey', e.target.value.trim()); cloud.resetCloud(); };
  on('[data-act=cloud-on]', (e) => {
    const onv = !store.settings.cloudOn;
    if (onv && !store.settings.cloudKey) { toast('Cole a chave da API e toque em "Verificar chave"'); return; }
    if (onv && !store.settings.cloudVoice) { toast('Toque em "Verificar chave e listar vozes" primeiro'); return; }
    store.setSetting('cloudOn', onv); cloud.resetCloud();
    e.currentTarget.classList.toggle('on', onv);
    toast(onv ? 'Narrador na nuvem ligado' : 'Usando a voz do aparelho');
    restartCurrent();
  });
  on('[data-act=cloud-check]', async () => {
    const key = q('#au-key').value.trim();
    store.setSetting('cloudKey', key); cloud.resetCloud();
    if (!key) { cloudState('Cole a chave primeiro.', true); return; }
    cloudState('Verificando…');
    try {
      const vs = await cloud.listVoices(key);
      if (!vs.length) throw new Error('nenhuma voz em português nesta conta');
      store.setSetting('cloudVoices', vs);
      if (!vs.some((v) => v.name === store.settings.cloudVoice)) store.setSetting('cloudVoice', cloud.pickDefaultVoice(vs));
      const sv = q('#au-cloud-voice'); sv.innerHTML = vs.map(copt).join(''); sv.hidden = false;
      cloudState(`Chave válida: ${vs.length} vozes disponíveis ✓`);
      toast('Chave verificada');
    } catch (err) {
      cloudState(`Erro: ${err.message}`, true);
    }
  });
  if (q('#au-cloud-voice')) q('#au-cloud-voice').onchange = (e) => { store.setSetting('cloudVoice', e.target.value); cloud.resetCloud(); restartCurrent(); };
  on('[data-act=cloud-test]', () => testCloudVoice());
  on('[data-act=test]', () => testDeviceVoice());
  on('[data-act=ok]', () => { localEngine.listeners.delete(localState); close(); });
  updateTimerLabels();
  // a lista de vozes pode chegar depois (Android/Chrome)
  if (!simple && has && !list.length) {
    const once = () => { speechSynthesis.removeEventListener('voiceschanged', once); if (document.body.contains(el)) { close(); openAudioSheet(); } };
    try { speechSynthesis.addEventListener('voiceschanged', once); } catch { /* ignora */ }
  }
}
