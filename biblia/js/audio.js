// Leitura em voz alta: fila de trechos, barra de controle, escolha de voz (do aparelho ou narrador na nuvem),
// preferência por voz masculina, estilo de narração, velocidade, tom e temporizador para parar.
import { $, $$, h, esc, icon, toast } from './util.js';
import { store } from './store.js';
import { openSheet, openModal } from './ui.js';
import * as cloud from './cloudtts.js';

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
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmtNum = (x) => (+x || 1).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
export const fmtRate = (x) => `${fmtNum(x)}×`;
const isDesktopChrome = has && /Chrome\//.test(navigator.userAgent) && !/Android|iPhone|iPad|Mobile/.test(navigator.userAgent);
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

export function audioAvailable() { return has || cloud.cloudConfigured(); }
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
export function chosenVoice() {
  const id = store.settings.ttsVoice;
  if (!id) return null;
  const list = voices();
  return list.find((v) => v.voiceURI === id) || list.find((v) => v.name === id) || null;
}
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
function chooseEngine(lang) { return cloud.cloudReady(lang) ? cloudEngine : sysEngine; }
export function engineName() { return st.active && st.engine ? st.engine.kind : ''; }

// ---------- fila ----------
// items: [{ text, label?, kind? }] — onItem(i, item) ao começar cada item; onEnd(completed) ao terminar ou parar
export function play({ title = '', items = [], lang = 'pt-BR', from = 0, onItem = null, onEnd = null } = {}) {
  const engine = chooseEngine(lang);
  if (engine === sysEngine && !has) { toast('Seu navegador não tem leitura em voz'); return false; }
  const list = items.filter((x) => x && String(x.text || '').trim());
  if (!list.length) { toast('Nada para ler'); return false; }
  stop({ silent: true });
  if (engine === cloudEngine) cloudEngine.unlock();
  Object.assign(st, { title, items: list, lang, idx: clamp(from, 0, list.length - 1), onItem, onEnd, active: true, paused: false, pausedInPlace: false, errors: 0, engine });
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
    onstart: () => { started = true; st.errors = 0; clearTimeout(st.watchdog); if (engine === cloudEngine) engine.prefetch(upcomingTexts(2)); },
    onend: () => { if (!st.active || st.paused || st.engine !== engine) return; clearTimeout(st.watchdog); afterChunk(chunk); },
    onerror: (e) => {
      if (!st.active || st.engine !== engine) return;
      clearTimeout(st.watchdog);
      if (engine === cloudEngine) {
        // narrador na nuvem falhou: avisa e continua com a voz do aparelho
        const msg = (e && e.message) || 'erro';
        st.engine = sysEngine;
        if (has) { toast(`Narrador na nuvem indisponível (${msg}). Usando a voz do aparelho.`, 4000); startNudge(); updateBar(); speakChunk(); }
        else { stop(); toast(`Narrador na nuvem indisponível: ${msg}`, 4000); }
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
  }, 8000);
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
  st.idx = clamp(st.idx + delta, 0, st.items.length - 1);
  st.paused = false; st.pausedInPlace = false;
  clearTimeout(st.gap);
  st.engine.cancel();
  speakItem();
}
function teardown() {
  const onEnd = st.onEnd;
  const engine = st.engine;
  st.active = false; st.paused = false; st.pausedInPlace = false; st.onEnd = null; st.onItem = null; st.items = [];
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
  clearTimeout(st.restart);
  st.restart = setTimeout(() => {
    if (!st.active || st.paused) return;
    clearTimeout(st.gap);
    st.engine.cancel();
    st.engine = chooseEngine(st.lang);
    if (st.engine === cloudEngine) cloudEngine.unlock(); else startNudge();
    updateBar();
    speakChunk();
  }, 350);
}
function applyRateLive() {
  if (st.active && st.engine === cloudEngine) cloudEngine.setRate();
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
    <div class="p-info"><div class="p-title"></div><div class="p-sub"><span class="p-pos"></span><span class="p-rate"></span><span class="p-engine" hidden title="Narrador na nuvem">${I.cloud}</span><span class="p-timer" hidden></span></div></div>
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
  $('[data-act=stop]', r).onclick = () => stop();
  updateBar();
}
function updateBar() {
  const r = root();
  if (!st.active || !r.firstChild) return;
  const it = st.items[st.idx] || {};
  $('.p-title', r).textContent = st.title || 'Leitura';
  $('.p-pos', r).textContent = `${it.label ? it.label : `${st.idx + 1} de ${st.items.length}`} · `;
  $('.p-rate', r).textContent = fmtRate(store.settings.ttsRate);
  $('.p-engine', r).hidden = st.engine !== cloudEngine;
  const tg = $('[data-act=toggle]', r);
  tg.innerHTML = st.paused ? icon('play') : I.pause;
  tg.setAttribute('aria-label', st.paused ? 'Continuar' : 'Pausar');
  updateTimerLabels();
  mediaSession();
}

// ---------- painel de voz e áudio ----------
const SAMPLE = 'No princípio criou Deus o céu e a terra. E a terra era vazia e vaga, e as trevas cobriam a face do abismo. E disse Deus: Faça-se a luz. E a luz foi feita.';
function testDeviceVoice() {
  if (!has) { toast('Seu navegador não tem leitura em voz'); return; }
  const wasPlaying = st.active && !st.paused;
  if (wasPlaying) pause();
  const s = store.settings;
  const v = chosenVoice() || pickVoice('pt-BR');
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

export function openAudioSheet() {
  const s = store.settings;
  const list = voices();
  const pt = list.filter((v) => lb(v.lang).startsWith('pt'));
  const others = list.filter((v) => !lb(v.lang).startsWith('pt'));
  const sel = (v) => s.ttsVoice && (s.ttsVoice === v.voiceURI || s.ttsVoice === v.name);
  const gtag = (v) => { const g = voiceGender(v); return g === 'M' ? ' · masculina' : g === 'F' ? ' · feminina' : ''; };
  const opt = (v) => `<option value="${esc(v.voiceURI)}" ${sel(v) ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}${gtag(v)}${v.localService ? '' : ' · online'}</option>`;
  const cv = s.cloudVoices || [];
  const copt = (v) => `<option value="${esc(v.name)}" ${s.cloudVoice === v.name ? 'selected' : ''}>${esc(cloud.describeVoice(v))}</option>`;
  const mins = [0, 5, 10, 15, 30, 45, 60];
  const { el, close } = openSheet(`
    <h3>Voz e áudio</h3>
    <div class="setting"><span>Preferir voz masculina</span><button class="switch ${s.ttsMale ? 'on' : ''}" data-act="male" aria-label="Preferir voz masculina"></button></div>
    <div class="setting"><span>Estilo</span><div class="seg" id="au-style"><button data-v="normal" class="${s.ttsStyle === 'normal' ? 'on' : ''}">Normal</button><button data-v="narracao" class="${s.ttsStyle !== 'normal' ? 'on' : ''}">Narração</button></div></div>
    <p class="small muted" style="margin:-4px 0 8px">Narração: fala mais pausada, com respiro entre as frases e os versículos, e apresenta o capítulo como quem conta uma história.</p>
    <label class="au-label" for="au-voice">Voz do aparelho</label>
    <select id="au-voice" class="input" aria-label="Voz do aparelho">
      <option value="">Automática (${s.ttsMale ? 'masculina em português, se houver' : 'português'})</option>
      ${pt.length ? `<optgroup label="Português">${pt.map(opt).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="Outras línguas">${others.map(opt).join('')}</optgroup>` : ''}
    </select>
    <p class="small muted" style="margin-top:6px">${list.length ? 'Para uma voz masculina melhor no aparelho: no Android, em Configurações › Sistema › Idiomas › Saída de conversão de texto em voz, instale as vozes em português do Google e escolha uma masculina; no iPhone, em Ajustes › Acessibilidade › Conteúdo falado › Vozes › Português, baixe a voz "Felipe".' : 'Nenhuma voz encontrada ainda. No Android, instale o "Serviço de conversão de texto em voz do Google" e as vozes em português; no iPhone, as vozes ficam em Ajustes › Acessibilidade › Conteúdo falado.'}</p>
    <div class="setting"><span>Velocidade</span><b id="au-rate-v">${fmtRate(s.ttsRate)}</b></div>
    <div class="row au-range"><button class="btn sm" data-act="slower" aria-label="Mais devagar">−</button><input type="range" id="au-rate" min="0.5" max="2" step="0.05" value="${+s.ttsRate || 1}" aria-label="Velocidade da voz"><button class="btn sm" data-act="faster" aria-label="Mais rápido">+</button></div>
    <div class="setting"><span>Tom da voz</span><b id="au-pitch-v">${fmtNum(s.ttsPitch)}</b></div>
    <div class="row au-range"><span class="small muted">grave</span><input type="range" id="au-pitch" min="0.5" max="2" step="0.05" value="${+s.ttsPitch || 1}" aria-label="Tom da voz"><span class="small muted">agudo</span></div>
    <div class="setting"><span>Continuar no próximo capítulo</span><button class="switch ${s.ttsContinue ? 'on' : ''}" data-act="cont" aria-label="Continuar no próximo capítulo"></button></div>
    <div class="section-title" style="margin-top:14px">Parar de ler</div>
    <div class="chips" id="au-timer-chips">${mins.map((m) => `<button class="chip" data-min="${m}">${m ? `${m} min` : 'Desligado'}</button>`).join('')}<button class="chip" data-act="attime">No horário…</button></div>
    <div class="row" id="au-time-row" style="margin-top:10px" hidden><input type="time" id="au-time" class="input" value="${esc(s.ttsTimerTime || '22:00')}" aria-label="Horário para parar"><button class="btn sm primary" data-act="settime">Parar nesse horário</button></div>
    <p class="small muted" id="au-timer-state" style="margin-top:8px"></p>
    <div class="section-title" style="margin-top:16px">Narrador humano na nuvem</div>
    <p class="small muted">Vozes neurais do Google, masculinas e muito naturais, com a sua chave gratuita do Google Cloud. <a href="#" data-act="cloud-help">Como conseguir a chave</a></p>
    <div class="setting"><span>Usar narrador na nuvem</span><button class="switch ${s.cloudOn ? 'on' : ''}" data-act="cloud-on" aria-label="Usar narrador na nuvem"></button></div>
    <div class="row" style="gap:8px"><input type="password" id="au-key" class="input" placeholder="Chave da API do Google Cloud" value="${esc(s.cloudKey || '')}" autocomplete="off" spellcheck="false" aria-label="Chave da API"><button class="btn sm" data-act="showkey" aria-label="Mostrar chave">👁</button></div>
    <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="cloud-check">Verificar chave e listar vozes</button><span class="small muted" id="au-cloud-state">${cv.length ? `${cv.length} vozes disponíveis` : ''}</span></div>
    <select id="au-cloud-voice" class="input" style="margin-top:8px" aria-label="Voz do narrador" ${cv.length ? '' : 'hidden'}>${cv.map(copt).join('')}</select>
    <div class="row" style="margin-top:14px;gap:8px;flex-wrap:wrap"><button class="btn" data-act="test">${icon('play')} Testar voz do aparelho</button><button class="btn" data-act="cloud-test">${I.cloud} Testar narrador</button><span class="grow"></span><button class="btn primary" data-act="ok">Pronto</button></div>`);
  const setRate = (x) => {
    const r = clamp(Math.round(x * 20) / 20, 0.5, 2);
    store.setSetting('ttsRate', r);
    $('#au-rate', el).value = r; $('#au-rate-v', el).textContent = fmtRate(r);
    const pr = $('#player-root .p-rate'); if (pr) pr.textContent = fmtRate(r);
    applyRateLive();
  };
  $('[data-act=male]', el).onclick = (e) => { store.setSetting('ttsMale', !store.settings.ttsMale); e.currentTarget.classList.toggle('on', store.settings.ttsMale); $('#au-voice option[value=""]', el).textContent = `Automática (${store.settings.ttsMale ? 'masculina em português, se houver' : 'português'})`; restartCurrent(); };
  $$('#au-style button', el).forEach((b) => b.onclick = () => { $$('#au-style button', el).forEach((x) => x.classList.remove('on')); b.classList.add('on'); store.setSetting('ttsStyle', b.dataset.v); restartCurrent(); });
  $('#au-voice', el).onchange = (e) => { store.setSetting('ttsVoice', e.target.value); restartCurrent(); };
  $('#au-rate', el).oninput = (e) => setRate(+e.target.value);
  $('[data-act=slower]', el).onclick = () => setRate((+store.settings.ttsRate || 1) - 0.1);
  $('[data-act=faster]', el).onclick = () => setRate((+store.settings.ttsRate || 1) + 0.1);
  $('#au-pitch', el).oninput = (e) => { const p = clamp(+e.target.value, 0.5, 2); store.setSetting('ttsPitch', p); $('#au-pitch-v', el).textContent = fmtNum(p); restartCurrent(); };
  $('[data-act=cont]', el).onclick = (e) => { store.setSetting('ttsContinue', !store.settings.ttsContinue); e.currentTarget.classList.toggle('on', store.settings.ttsContinue); };
  $$('#au-timer-chips [data-min]', el).forEach((c) => c.onclick = () => {
    const m = +c.dataset.min;
    $('#au-time-row', el).hidden = true;
    if (m) store.setSetting('ttsTimerMin', m);
    setTimer(m ? 'min' : 'off', m);
    toast(m ? `A leitura para em ${m} min` : 'Temporizador desligado');
  });
  $('[data-act=attime]', el).onclick = () => { const row = $('#au-time-row', el); row.hidden = !row.hidden; if (!row.hidden) $('#au-time', el).focus(); };
  $('[data-act=settime]', el).onclick = () => {
    const v = $('#au-time', el).value;
    if (!v) { toast('Escolha um horário'); return; }
    store.setSetting('ttsTimerTime', v);
    const end = setTimer('time', v);
    if (end) toast(`A leitura para às ${fmtClock(end)}`);
  };
  // narrador na nuvem
  const cloudState = (msg, bad) => { const x = $('#au-cloud-state', el); x.textContent = msg; x.style.color = bad ? 'var(--accent)' : ''; };
  $('[data-act=cloud-help]', el).onclick = (e) => { e.preventDefault(); cloudHelp(); };
  $('[data-act=showkey]', el).onclick = () => { const k = $('#au-key', el); k.type = k.type === 'password' ? 'text' : 'password'; };
  $('#au-key', el).onchange = (e) => { store.setSetting('cloudKey', e.target.value.trim()); cloud.resetCloud(); };
  $('[data-act=cloud-on]', el).onclick = (e) => {
    const on = !store.settings.cloudOn;
    if (on && !store.settings.cloudKey) { toast('Cole a chave da API e toque em "Verificar chave"'); return; }
    if (on && !store.settings.cloudVoice) { toast('Toque em "Verificar chave e listar vozes" primeiro'); return; }
    store.setSetting('cloudOn', on); cloud.resetCloud();
    e.currentTarget.classList.toggle('on', on);
    toast(on ? 'Narrador na nuvem ligado' : 'Usando a voz do aparelho');
    restartCurrent();
  };
  $('[data-act=cloud-check]', el).onclick = async () => {
    const key = $('#au-key', el).value.trim();
    store.setSetting('cloudKey', key); cloud.resetCloud();
    if (!key) { cloudState('Cole a chave primeiro.', true); return; }
    cloudState('Verificando…');
    try {
      const vs = await cloud.listVoices(key);
      if (!vs.length) throw new Error('nenhuma voz em português nesta conta');
      store.setSetting('cloudVoices', vs);
      if (!vs.some((v) => v.name === store.settings.cloudVoice)) store.setSetting('cloudVoice', cloud.pickDefaultVoice(vs));
      const sv = $('#au-cloud-voice', el); sv.innerHTML = vs.map(copt).join(''); sv.hidden = false;
      cloudState(`Chave válida: ${vs.length} vozes disponíveis ✓`);
      toast('Chave verificada');
    } catch (err) {
      cloudState(`Erro: ${err.message}`, true);
    }
  };
  $('#au-cloud-voice', el).onchange = (e) => { store.setSetting('cloudVoice', e.target.value); cloud.resetCloud(); restartCurrent(); };
  $('[data-act=cloud-test]', el).onclick = () => testCloudVoice();
  $('[data-act=test]', el).onclick = () => testDeviceVoice();
  $('[data-act=ok]', el).onclick = () => close();
  updateTimerLabels();
  // a lista de vozes pode chegar depois (Android/Chrome)
  if (has && !list.length) {
    const once = () => { speechSynthesis.removeEventListener('voiceschanged', once); if (document.body.contains(el)) { close(); openAudioSheet(); } };
    try { speechSynthesis.addEventListener('voiceschanged', once); } catch { /* ignora */ }
  }
}
