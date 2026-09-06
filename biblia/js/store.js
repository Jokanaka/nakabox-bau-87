// Persistência local (localStorage): configurações e dados do usuário
import { todayISO, parseISO, addDays } from './util.js';

const KEY = 'bibliaCatolica.v1';
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
  },
  last: { book: 'gn', chapter: 1 },
  highlights: {},   // "gn.1.1" -> color
  notes: {},        // "gn.1.1" -> { text, at }
  bookmarks: {},    // "gn.1.1" -> at
  history: [],      // [{book, chapter, at}] (últimos 40)
  readChapters: {}, // "gn.1" -> date  (capítulos concluídos)
  plans: {},        // planId -> { started: iso, done: { dayIndex: true } }
  favPrayers: {},   // prayerId -> true
  streak: { last: null, count: 0, days: {} },
  rosary: { count: 0 },
  installed: false,
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULTS), ...data, settings: { ...DEFAULTS.settings, ...(data.settings || {}) } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let saveTimer;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
  }, 60);
}

export const store = {
  get settings() { return state.settings; },
  setSetting(k, v) { state.settings[k] = v; save(); },
  get last() { return state.last; },
  setLast(book, chapter) { state.last = { book, chapter }; save(); },

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
    save();
  },
  isRead(book, chapter) { return !!state.readChapters[`${book}.${chapter}`]; },
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

  rosaryDone() { state.rosary.count = (state.rosary.count || 0) + 1; this.touchStreak(); save(); },
  get rosaryCount() { return state.rosary.count || 0; },

  export() { const copy = JSON.parse(JSON.stringify(state)); if (copy.settings) delete copy.settings.cloudKey; return JSON.stringify(copy, null, 1); },
  import(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object' || !data.settings) throw new Error('Arquivo inválido');
    state = { ...structuredClone(DEFAULTS), ...data, settings: { ...DEFAULTS.settings, ...data.settings } };
    save();
  },
  reset() { state = structuredClone(DEFAULTS); save(); },
};

export function refKey(book, chapter, verse) { return `${book}.${chapter}.${verse}`; }
export function parseRefKey(k) { const [book, c, v] = k.split('.'); return { book, chapter: +c, verse: +v }; }
