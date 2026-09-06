// Leitura em voz alta (síntese de voz do sistema): fila de trechos, barra de controle,
// escolha de voz, velocidade, tom e temporizador para parar (por duração ou no horário).
import { $, $$, h, esc, icon, toast } from './util.js';
import { store } from './store.js';
import { openSheet } from './ui.js';

const has = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const CHUNK = 180; // caracteres por trecho falado (o Chrome corta falas longas)
const st = {
  active: false, paused: false, items: [], idx: 0, chunks: [], chunk: 0, title: '', lang: 'pt-BR',
  onItem: null, onEnd: null, utter: null, watchdog: null, restart: null, nudge: null,
  timerEnd: null, timerTick: null, timerMode: null, timerValue: null, autoplay: null,
};
const I = {
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zm6 0h4v14h-4z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
  sliders: '<svg viewBox="0 0 24 24"><path d="M3 7h9v2H3zm15 0h3v2h-3zM3 15h3v2H3zm9 0h9v2h-9zm3-9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM9 12.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-1 2h2v4.6l3 1.8-1 1.7-4-2.4z"/></svg>',
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const fmtNum = (x) => (+x || 1).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
export const fmtRate = (x) => `${fmtNum(x)}×`;
const isDesktopChrome = has && /Chrome\//.test(navigator.userAgent) && !/Android|iPhone|iPad|Mobile/.test(navigator.userAgent);

export function audioAvailable() { return has; }
export function isActive() { return st.active; }
export function isPaused() { return st.paused; }

// ---------- vozes ----------
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
export function chosenVoice() {
  const id = store.settings.ttsVoice;
  if (!id) return null;
  const list = voices();
  return list.find((v) => v.voiceURI === id) || list.find((v) => v.name === id) || null;
}
// voz para um idioma: a escolhida pelo usuário (se for do mesmo idioma), senão a melhor automática
export function pickVoice(lang) {
  const want = chosenVoice();
  if (want && lb(want.lang).slice(0, 2) === lb(lang).slice(0, 2)) return want;
  const list = voices();
  const base = lb(lang).slice(0, 2), full = lb(lang);
  const c = list.filter((v) => lb(v.lang).startsWith(base));
  return c.find((v) => lb(v.lang) === full && v.localService) || c.find((v) => lb(v.lang) === full) || c.find((v) => v.localService) || c[0] || want || null;
}

// ---------- fala ----------
function chunksOf(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (t.length <= CHUNK) return [t];
  const out = [];
  let cur = '';
  for (const s of t.split(/(?<=[.!?;:])\s+/)) {
    if (cur && cur.length + s.length + 1 > CHUNK) { out.push(cur); cur = s; }
    else cur = cur ? cur + ' ' + s : s;
  }
  if (cur) out.push(cur);
  return out;
}

// items: [{ text, label? , ...}] — onItem(i, item) ao começar cada item; onEnd(completed) ao terminar ou parar
export function play({ title = '', items = [], lang = 'pt-BR', from = 0, onItem = null, onEnd = null } = {}) {
  if (!has) { toast('Seu navegador não tem leitura em voz'); return false; }
  const list = items.filter((x) => x && String(x.text || '').trim());
  if (!list.length) { toast('Nada para ler'); return false; }
  stop({ silent: true });
  Object.assign(st, { title, items: list, lang, idx: clamp(from, 0, list.length - 1), onItem, onEnd, active: true, paused: false, errors: 0 });
  document.body.classList.add('has-player');
  renderBar();
  startNudge();
  speakItem();
  return true;
}
function speakItem() {
  if (!st.active) return;
  if (st.idx >= st.items.length) { finish(true); return; }
  const it = st.items[st.idx];
  st.chunks = chunksOf(it.text);
  st.chunk = 0;
  if (st.onItem) { try { st.onItem(st.idx, it); } catch { /* ignora */ } }
  updateBar();
  speakChunk();
}
function speakChunk() {
  if (!st.active || st.paused) return;
  if (st.chunk >= st.chunks.length) { st.idx++; speakItem(); return; }
  const s = store.settings;
  const u = new SpeechSynthesisUtterance(st.chunks[st.chunk]);
  u.lang = st.lang;
  u.rate = clamp(+s.ttsRate || 1, 0.5, 2);
  u.pitch = clamp(+s.ttsPitch || 1, 0.5, 2);
  const v = pickVoice(st.lang);
  if (v) u.voice = v;
  let started = false;
  u.onstart = () => { started = true; st.errors = 0; clearTimeout(st.watchdog); };
  u.onend = () => { if (st.utter !== u) return; st.chunk++; speakChunk(); };
  u.onerror = (e) => {
    if (st.utter !== u) return;
    if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
    st.errors = (st.errors || 0) + 1;
    if (st.errors >= 3) { stop(); toast('Não foi possível ler em voz alta neste aparelho'); return; }
    st.chunk++; speakChunk();
  };
  st.utter = u;
  clearTimeout(st.watchdog);
  st.watchdog = setTimeout(() => {
    if (started || !st.active || st.utter !== u) return;
    if (!voices().length) { stop(); toast('Nenhuma voz de leitura disponível neste aparelho'); }
  }, 7000);
  try { speechSynthesis.speak(u); } catch { st.chunk++; speakChunk(); }
}
// Chrome (computador) interrompe falas longas em silêncio; pausar/retomar a cada 10 s evita isso
function startNudge() {
  if (!isDesktopChrome || st.nudge) return;
  st.nudge = setInterval(() => {
    try { if (st.active && !st.paused && speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); } } catch { /* ignora */ }
  }, 10000);
}
function stopNudge() { clearInterval(st.nudge); st.nudge = null; }

export function pause() {
  if (!st.active || st.paused) return;
  st.paused = true; st.utter = null;
  clearTimeout(st.watchdog);
  speechSynthesis.cancel();
  updateBar();
}
export function resume() {
  if (!st.active || !st.paused) return;
  st.paused = false; st.chunk = 0;      // recomeça o trecho atual
  updateBar();
  speakChunk();
}
export function toggle() { if (!st.active) return; if (st.paused) resume(); else pause(); }
export function skip(delta) {
  if (!st.active) return;
  st.idx = clamp(st.idx + delta, 0, st.items.length - 1);
  st.utter = null; st.paused = false;
  speechSynthesis.cancel();
  speakItem();
}
function teardown() {
  const onEnd = st.onEnd;
  st.active = false; st.paused = false; st.utter = null; st.onEnd = null; st.onItem = null; st.items = [];
  clearTimeout(st.watchdog); clearTimeout(st.restart);
  stopNudge();
  if (has) { try { speechSynthesis.cancel(); } catch { /* ignora */ } }
  document.body.classList.remove('has-player');
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
// mudança de voz/velocidade/tom durante a leitura: recomeça o trecho atual com os novos valores
function restartCurrent() {
  if (!st.active || st.paused) return;
  clearTimeout(st.restart);
  st.restart = setTimeout(() => {
    if (!st.active || st.paused) return;
    st.utter = null; speechSynthesis.cancel(); speakChunk();
  }, 350);
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
    <div class="p-info"><div class="p-title"></div><div class="p-sub"><span class="p-pos"></span><span class="p-rate"></span><span class="p-timer" hidden></span></div></div>
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
  const tg = $('[data-act=toggle]', r);
  tg.innerHTML = st.paused ? icon('play') : I.pause;
  tg.setAttribute('aria-label', st.paused ? 'Continuar' : 'Pausar');
  updateTimerLabels();
}

// ---------- painel de voz e áudio ----------
function testVoice() {
  if (!has) { toast('Seu navegador não tem leitura em voz'); return; }
  const wasPlaying = st.active && !st.paused;
  if (wasPlaying) pause();
  const s = store.settings;
  const v = chosenVoice() || pickVoice('pt-BR');
  const u = new SpeechSynthesisUtterance('Esta é a voz escolhida para a leitura da Bíblia. O Senhor é o meu pastor, nada me faltará.');
  u.lang = v ? v.lang : 'pt-BR';
  u.rate = clamp(+s.ttsRate || 1, 0.5, 2);
  u.pitch = clamp(+s.ttsPitch || 1, 0.5, 2);
  if (v) u.voice = v;
  u.onend = () => { if (wasPlaying) resume(); };
  u.onerror = () => { if (wasPlaying) resume(); };
  try { speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { toast('Não foi possível testar a voz'); }
}

export function openAudioSheet() {
  const s = store.settings;
  const list = voices();
  const pt = list.filter((v) => lb(v.lang).startsWith('pt'));
  const others = list.filter((v) => !lb(v.lang).startsWith('pt'));
  const sel = (v) => s.ttsVoice && (s.ttsVoice === v.voiceURI || s.ttsVoice === v.name);
  const opt = (v) => `<option value="${esc(v.voiceURI)}" ${sel(v) ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}${v.localService ? '' : ' · online'}</option>`;
  const mins = [0, 5, 10, 15, 30, 45, 60];
  const { el, close } = openSheet(`
    <h3>Voz e áudio</h3>
    <label class="au-label" for="au-voice">Voz</label>
    <select id="au-voice" class="input" aria-label="Voz">
      <option value="">Automática (português)</option>
      ${pt.length ? `<optgroup label="Português">${pt.map(opt).join('')}</optgroup>` : ''}
      ${others.length ? `<optgroup label="Outras línguas">${others.map(opt).join('')}</optgroup>` : ''}
    </select>
    ${list.length ? '' : '<p class="small muted" style="margin-top:6px">Nenhuma voz encontrada ainda. No Android, instale ou atualize o "Serviço de conversão de texto em voz do Google" e as vozes em português; no iPhone, as vozes ficam em Ajustes › Acessibilidade › Conteúdo falado.</p>'}
    <div class="setting"><span>Velocidade</span><b id="au-rate-v">${fmtRate(s.ttsRate)}</b></div>
    <div class="row au-range"><button class="btn sm" data-act="slower" aria-label="Mais devagar">−</button><input type="range" id="au-rate" min="0.5" max="2" step="0.05" value="${+s.ttsRate || 1}" aria-label="Velocidade da voz"><button class="btn sm" data-act="faster" aria-label="Mais rápido">+</button></div>
    <div class="setting"><span>Tom da voz</span><b id="au-pitch-v">${fmtNum(s.ttsPitch)}</b></div>
    <div class="row au-range"><span class="small muted">grave</span><input type="range" id="au-pitch" min="0.5" max="2" step="0.05" value="${+s.ttsPitch || 1}" aria-label="Tom da voz"><span class="small muted">agudo</span></div>
    <div class="setting"><span>Continuar no próximo capítulo</span><button class="switch ${s.ttsContinue ? 'on' : ''}" data-act="cont" aria-label="Continuar no próximo capítulo"></button></div>
    <div class="section-title" style="margin-top:14px">Parar de ler</div>
    <div class="chips" id="au-timer-chips">${mins.map((m) => `<button class="chip" data-min="${m}">${m ? `${m} min` : 'Desligado'}</button>`).join('')}<button class="chip" data-act="attime">No horário…</button></div>
    <div class="row" id="au-time-row" style="margin-top:10px" hidden><input type="time" id="au-time" class="input" value="${esc(s.ttsTimerTime || '22:00')}" aria-label="Horário para parar"><button class="btn sm primary" data-act="settime">Parar nesse horário</button></div>
    <p class="small muted" id="au-timer-state" style="margin-top:8px"></p>
    <div class="row" style="margin-top:14px"><button class="btn" data-act="test">${icon('play')} Testar voz</button><span class="grow"></span><button class="btn primary" data-act="ok">Pronto</button></div>`);
  const setRate = (x) => {
    const r = clamp(Math.round(x * 20) / 20, 0.5, 2);
    store.setSetting('ttsRate', r);
    $('#au-rate', el).value = r; $('#au-rate-v', el).textContent = fmtRate(r);
    const pr = $('#player-root .p-rate'); if (pr) pr.textContent = fmtRate(r);
    restartCurrent();
  };
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
  $('[data-act=test]', el).onclick = () => testVoice();
  $('[data-act=ok]', el).onclick = () => close();
  updateTimerLabels();
  // a lista de vozes pode chegar depois (Android/Chrome)
  if (has && !list.length) {
    const once = () => { speechSynthesis.removeEventListener('voiceschanged', once); if (document.body.contains(el)) { close(); openAudioSheet(); } };
    try { speechSynthesis.addEventListener('voiceschanged', once); } catch { /* ignora */ }
  }
}
