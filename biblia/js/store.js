// Persistência local (localStorage): perfis, configurações e dados de cada pessoa
import { todayISO, parseISO, addDays } from './util.js';

const KEY = 'bibliaCatolica.v1';          // dados do primeiro perfil (compatível com as versões anteriores)
const PKEY = 'bibliaCatolica.profiles';   // lista de perfis e perfil atual
const DEFAULTS = {
  settings: {
    theme: 'auto',        // auto | light | sepia | dark
    fontSize: 19,
    fontFamily: 'serif',  // serif | sans
    lineHeight: 1.65,
    showVerseNumbers: true,
    version: 'figueiredo',
    ttsRate: 1,
    ttsPitch: 1,
    ttsVoice: '',        // voiceURI da voz escolhida ('' = automática)
    ttsContinue: true,   // continuar lendo no próximo capítulo
    ttsTimerMin: 15,
    ttsTimerTime: '22:00',
    ttsMale: true,       // preferir voz masculina
    ttsStyle: 'narracao', // normal | narracao
    cloudOn: false,      // narrador na nuvem (Google Cloud Text-to-Speech)
    cloudKey: '',
    cloudVoice: '',
    cloudVoices: [],
    localVoiceOn: false, // narrador offline (Piper, voz masculina Faber)
    recordedOn: true,    // narração gravada (MP3 por capítulo) quando existir
    recordedVoice: 'alex', // alex | santa | dora
    uiMode: 'simples',   // simples | avancado
    todayStrip: true,    // resumo do dia no alto do leitor
  },
  last: { book: 'gn', chapter: 1 },
  highlights: {},   // "gn.1.1" -> color
  notes: {},        // "gn.1.1" -> { text, at }
  bookmarks: {},    // "gn.1.1" -> at
  history: [],      // [{book, chapter, at}] (últimos 40)
  readPos: {},      // "gn.2" -> { v, at }  (versículo onde parou de ler o capítulo)
  readChapters: {}, // "gn.1" -> date  (capítulos concluídos)
  plans: {},        // planId -> { started: iso, done: { dayIndex: true } }
  favPrayers: {},   // prayerId -> true
  routines: [],     // grupos de orações do dia: [{ id, name, items: [prayerId | rosario | misericordia | leitura | missa] }]
  routineDone: {},  // "AAAA-MM-DD" -> { routineId: { itemId: true } }
  streak: { last: null, count: 0, days: {} },
  rosary: { count: 0 },
  installed: false,
};

// ---------- Perfis (cada pessoa com os seus dados) ----------
function loadProfiles() {
  try {
    const raw = localStorage.getItem(PKEY);
    if (raw) { const p = JSON.parse(raw); if (p && Array.isArray(p.list) && p.list.length && p.list.some((x) => x.id === p.current)) return p; }
  } catch { /* recomeça */ }
  return { list: [{ id: 'p1', name: 'Eu', emoji: '🙂', created: Date.now() }], current: 'p1' };
}
let profiles = loadProfiles();
function saveProfiles() { try { localStorage.setItem(PKEY, JSON.stringify(profiles)); } catch (e) { console.warn('save profiles failed', e); } }
function keyFor(id) { return id === 'p1' ? KEY : `${KEY}.${id}`; }

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(keyFor(profiles.current));
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULTS), ...data, settings: { ...DEFAULTS.settings, ...(data.settings || {}) } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let saveTimer;
function write() { try { localStorage.setItem(keyFor(profiles.current), JSON.stringify(state)); } catch (e) { console.warn('save failed', e); } }
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 60);
}
export function flushSave() { clearTimeout(saveTimer); write(); }

const SPECIAL_ITEMS = ['rosario', 'misericordia', 'leitura', 'missa'];

export const store = {
  get settings() { return state.settings; },
  setSetting(k, v) { state.settings[k] = v; save(); },
  get last() { return state.last; },
  setLast(book, chapter) { state.last = { book, chapter }; save(); },
  // onde a pessoa parou de ler no capítulo (0 = do início)
  readPos(book, chapter) { const p = (state.readPos || {})[`${book}.${chapter}`]; return p ? p.v : 0; },
  setReadPos(book, chapter, v) {
    if (!state.readPos) state.readPos = {};
    const k = `${book}.${chapter}`, cur = state.readPos[k];
    if (v > 1) { if (cur && cur.v === v) return; state.readPos[k] = { v, at: Date.now() }; }
    else { if (!cur) return; delete state.readPos[k]; }
    save();
  },

  // perfis
  get profiles() { return profiles.list; },
  get profile() { return profiles.list.find((p) => p.id === profiles.current) || profiles.list[0]; },
  addProfile({ name, emoji }) {
    const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
    profiles.list.push({ id, name: String(name || 'Perfil').trim().slice(0, 30), emoji: emoji || '🙂', created: Date.now() });
    saveProfiles();
    return id;
  },
  updateProfile(id, patch) {
    const p = profiles.list.find((x) => x.id === id); if (!p) return;
    if (patch.name !== undefined) p.name = String(patch.name).trim().slice(0, 30) || p.name;
    if (patch.emoji) p.emoji = patch.emoji;
    saveProfiles();
  },
  deleteProfile(id) {
    if (profiles.list.length <= 1) return false;
    profiles.list = profiles.list.filter((x) => x.id !== id);
    try { localStorage.removeItem(keyFor(id)); } catch { /* */ }
    if (profiles.current === id) { profiles.current = profiles.list[0].id; saveProfiles(); state = load(); }
    else saveProfiles();
    return true;
  },
  switchProfile(id) {   // depois de trocar, a tela é recarregada pelo chamador
    if (!profiles.list.some((x) => x.id === id) || id === profiles.current) return false;
    flushSave();
    profiles.current = id; saveProfiles();
    state = load();
    return true;
  },

  // destaques
  highlight(ref) { return state.highlights[ref]; },
  setHighlight(refs, color) {
    refs.forEach((r) => { if (color) state.highlights[r] = color; else delete state.highlights[r]; });
    save();
  },
  allHighlights() { return state.highlights; },

  // notas
  note(ref) { return state.notes[ref]; },
  setNote(ref, text) {
    if (text && text.trim()) state.notes[ref] = { text: text.trim(), at: Date.now() };
    else delete state.notes[ref];
    save();
  },
  allNotes() { return state.notes; },

  // favoritos
  isBookmarked(ref) { return !!state.bookmarks[ref]; },
  toggleBookmark(ref) {
    if (state.bookmarks[ref]) delete state.bookmarks[ref]; else state.bookmarks[ref] = Date.now();
    save();
    return !!state.bookmarks[ref];
  },
  allBookmarks() { return state.bookmarks; },

  // histórico
  pushHistory(book, chapter) {
    state.history = state.history.filter((h) => !(h.book === book && h.chapter === chapter));
    state.history.unshift({ book, chapter, at: Date.now() });
    state.history = state.history.slice(0, 40);
    this.touchStreak();
    save();
  },
  get history() { return state.history; },

  // capítulos lidos
  markRead(book, chapter, on = true) {
    const k = `${book}.${chapter}`;
    if (on) state.readChapters[k] = todayISO(); else delete state.readChapters[k];
    if (on && state.readPos) delete state.readPos[k];   // capítulo concluído reabre do início
    if (on) this.markRoutineItemEverywhere('leitura');
    save();
  },
  isRead(book, chapter) { return !!state.readChapters[`${book}.${chapter}`]; },
  readCountBook(book) { let n = 0; const p = book + '.'; for (const k in state.readChapters) if (k.startsWith(p)) n++; return n; },
  get readChapters() { return state.readChapters; },

  // planos
  plan(id) { return state.plans[id]; },
  startPlan(id) { if (!state.plans[id]) state.plans[id] = { started: todayISO(), done: {} }; save(); },
  stopPlan(id) { delete state.plans[id]; save(); },
  setPlanDay(id, day, on) {
    const p = state.plans[id]; if (!p) return;
    if (on) p.done[day] = todayISO(); else delete p.done[day];
    this.touchStreak();
    save();
  },
  get plans() { return state.plans; },

  // orações favoritas
  isFavPrayer(id) { return !!state.favPrayers[id]; },
  toggleFavPrayer(id) { if (state.favPrayers[id]) delete state.favPrayers[id]; else state.favPrayers[id] = true; save(); return !!state.favPrayers[id]; },

  // grupos de orações do dia
  get routines() { return state.routines; },
  routine(id) { return state.routines.find((r) => r.id === id); },
  saveRoutine(r) {
    const items = (r.items || []).filter((x, i, a) => x && a.indexOf(x) === i);
    if (!r.id) r.id = 'r' + Date.now().toString(36);
    const rec = { id: r.id, name: String(r.name || 'Minhas orações').trim().slice(0, 40) || 'Minhas orações', items };
    const i = state.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) state.routines[i] = rec; else state.routines.push(rec);
    save();
    return rec.id;
  },
  deleteRoutine(id) { state.routines = state.routines.filter((r) => r.id !== id); save(); },
  routineDoneToday(rid) { const d = state.routineDone[todayISO()]; return (d && d[rid]) || {}; },
  isRoutineItemDone(rid, item) { return !!this.routineDoneToday(rid)[item]; },
  setRoutineItem(rid, item, on) {
    const today = todayISO();
    if (!state.routineDone[today]) state.routineDone[today] = {};
    const d = state.routineDone[today];
    if (!d[rid]) d[rid] = {};
    if (on) d[rid][item] = true; else delete d[rid][item];
    if (on) this.touchStreak();
    const keys = Object.keys(state.routineDone).sort();   // guarda só os últimos 60 dias
    if (keys.length > 60) keys.slice(0, keys.length - 60).forEach((k) => delete state.routineDone[k]);
    save();
  },
  markRoutineItemEverywhere(item) {   // o Rosário rezado no app, a leitura do dia etc. contam em todos os grupos que os têm
    let n = 0;
    for (const r of state.routines) if (r.items.includes(item) && !this.isRoutineItemDone(r.id, item)) { this.setRoutineItem(r.id, item, true); n++; }
    return n;
  },
  routineProgress(rid) {
    const r = this.routine(rid); if (!r) return { done: 0, total: 0, all: false };
    const d = this.routineDoneToday(rid);
    const done = r.items.filter((x) => d[x]).length;
    return { done, total: r.items.length, all: r.items.length > 0 && done === r.items.length };
  },
  routinesSummary() {
    let done = 0, total = 0;
    for (const r of state.routines) { const p = this.routineProgress(r.id); done += p.done; total += p.total; }
    return { done, total, all: total > 0 && done === total, count: state.routines.length };
  },

  // sequência de dias
  touchStreak() {
    const today = todayISO();
    const s = state.streak;
    if (s.days[today]) return;
    s.days[today] = true;
    const yesterday = todayISO(addDays(new Date(), -1));
    s.count = (s.last === yesterday || s.last === today) ? s.count + 1 : 1;
    s.last = today;
    // limita histórico a 400 dias
    const keys = Object.keys(s.days).sort();
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((k) => delete s.days[k]);
    save();
  },
  get streak() {
    const s = state.streak;
    const today = todayISO();
    const yesterday = todayISO(addDays(new Date(), -1));
    if (s.last !== today && s.last !== yesterday) return { count: 0, today: false, days: s.days };
    return { count: s.count, today: s.last === today, days: s.days };
  },

  rosaryDone(kind = 'rosario') { state.rosary.count = (state.rosary.count || 0) + 1; this.touchStreak(); this.markRoutineItemEverywhere(kind); save(); },
  get rosaryCount() { return state.rosary.count || 0; },

  export() { const copy = JSON.parse(JSON.stringify(state)); if (copy.settings) delete copy.settings.cloudKey; copy.profile = { name: this.profile.name, emoji: this.profile.emoji }; return JSON.stringify(copy, null, 1); },
  import(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object' || !data.settings) throw new Error('Arquivo inválido');
    delete data.profile;
    state = { ...structuredClone(DEFAULTS), ...data, settings: { ...DEFAULTS.settings, ...data.settings } };
    save();
  },
  reset() { state = structuredClone(DEFAULTS); save(); },
};

export const ROUTINE_SPECIAL = SPECIAL_ITEMS;
export function refKey(book, chapter, verse) { return `${book}.${chapter}.${verse}`; }
export function parseRefKey(k) { const [book, c, v] = k.split('.'); return { book, chapter: +c, verse: +v }; }
