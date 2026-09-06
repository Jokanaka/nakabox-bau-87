// Catálogo de livros, versões e carregamento de capítulos
import { norm } from './util.js';

export const VERSIONS = [
  { id: 'figueiredo', name: 'Bíblia Sagrada — Pe. Antônio Pereira de Figueiredo', short: 'FIG', lang: 'pt-BR', nameKey: 'name', desc: 'Tradução católica da Vulgata Latina (edição de 1950), ortografia atualizada. 73 livros.' },
  { id: 'vulgata', name: 'Vulgata Clementina (Latim)', short: 'VULG', lang: 'la', nameKey: 'la', desc: 'Biblia Sacra iuxta Vulgatam Clementinam — texto latino oficial da Igreja até 1979.' },
  { id: 'drb', name: 'Douay-Rheims (Inglês)', short: 'DRB', lang: 'en', nameKey: 'en', desc: 'Tradução católica inglesa da Vulgata (revisão Challoner, 1752).' },
];
export function version(id) { return VERSIONS.find((v) => v.id === id) || VERSIONS[0]; }

let BOOKS = null;
const byId = new Map();
const BASE = new URL('.', document.baseURI).href.replace(/\/js\/$/, '/');

export async function loadBooks() {
  if (BOOKS) return BOOKS;
  const res = await fetch('data/books.json');
  BOOKS = await res.json();
  BOOKS.forEach((b, i) => { b.index = i; byId.set(b.id, b); });
  return BOOKS;
}
export function books() { return BOOKS || []; }
export function book(id) { return byId.get(id); }
export function bookName(b, ver = 'figueiredo') {
  const key = version(ver).nameKey;
  return (b && b[key]) || (b && b.name) || '';
}
export function groups(test) {
  const out = [];
  for (const b of books()) {
    if (test && b.test !== test) continue;
    let g = out.find((x) => x.name === b.group);
    if (!g) { g = { name: b.group, books: [] }; out.push(g); }
    g.books.push(b);
  }
  return out;
}
export function nextChapter(bookId, chapter) {
  const b = book(bookId);
  if (!b) return null;
  if (chapter < b.chapters) return { book: bookId, chapter: chapter + 1 };
  const nb = books()[b.index + 1];
  return nb ? { book: nb.id, chapter: 1 } : null;
}
export function prevChapter(bookId, chapter) {
  const b = book(bookId);
  if (!b) return null;
  if (chapter > 1) return { book: bookId, chapter: chapter - 1 };
  const pb = books()[b.index - 1];
  return pb ? { book: pb.id, chapter: pb.chapters } : null;
}

const cache = new Map();
export function loadBook(ver, id) {
  const k = `${ver}/${id}`;
  if (!cache.has(k)) {
    const p = fetch(`data/${ver}/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`Não foi possível carregar ${k}`);
      return r.json();
    }).catch((e) => { cache.delete(k); throw e; });
    cache.set(k, p);
  }
  return cache.get(k);
}
export async function getChapter(ver, id, n) {
  const b = await loadBook(ver, id);
  return b.chapters.find((c) => c.n === n) || null;
}
export async function getVerses(ver, id, n, from, to) {
  const ch = await getChapter(ver, id, n);
  if (!ch) return [];
  const out = [];
  for (let v = from; v <= (to || from); v++) {
    const t = ch.verses[v - 1];
    if (t) out.push({ v, t });
  }
  return out;
}
export function dataUrls() {
  const urls = [];
  for (const v of VERSIONS) for (const b of books()) urls.push(`${BASE}data/${v.id}/${b.id}.json`);
  return urls;
}

// Numeração hebraica (Bíblias modernas) correspondente ao Salmo da Vulgata
export function psalmHebrew(n) {
  if (n <= 8 || n >= 148) return String(n);
  if (n === 9) return '9–10';
  if (n <= 112) return String(n + 1);
  if (n === 113) return '114–115';
  if (n === 114) return '116,1-9';
  if (n === 115) return '116,10-19';
  if (n <= 145) return String(n + 1);
  if (n === 146) return '147,1-11';
  return '147,12-20';
}

// Referência no estilo católico: "Jo 3,16" / "Gn 1,1-3"
export function refString(bookId, chapter, v1, v2) {
  const b = book(bookId);
  const name = b ? b.abbr : bookId;
  if (!v1) return `${name} ${chapter}`;
  if (v2 && v2 !== v1) return `${name} ${chapter},${v1}-${v2}`;
  return `${name} ${chapter},${v1}`;
}
export function refLong(bookId, chapter, v1, v2) {
  const b = book(bookId);
  const name = b ? b.name : bookId;
  if (!v1) return `${name} ${chapter}`;
  if (v2 && v2 !== v1) return `${name} ${chapter},${v1}-${v2}`;
  return `${name} ${chapter},${v1}`;
}

// Interpreta "Jo 3,16", "João 3:16", "1 Cor 13, 4-7", "Sl 23", "gn1,1"
export function parseRef(input) {
  if (!input) return null;
  const raw = input.trim();
  const m = raw.match(/^\s*([1-3]?\s*[A-Za-zÀ-ÿ]+\.?)\s*(\d+)?(?:\s*[,:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/);
  if (!m) return null;
  let name = m[1].replace(/\./g, '').replace(/\s+/g, '').toLowerCase();
  const nname = norm(name);
  let found = null;
  const list = books();
  // Jó (Job) vs Jo (João)
  if (nname === 'jo') found = book(name.includes('ó') ? 'job' : 'jo');
  if (!found) found = list.find((b) => b.aliases.some((a) => norm(a).replace(/\s+/g, '') === nname));
  if (!found) found = list.find((b) => norm(b.abbr).replace(/\s+/g, '') === nname);
  if (!found && nname.length >= 3) found = list.find((b) => norm(b.name).replace(/\s+/g, '').startsWith(nname));
  if (!found) return null;
  const chapter = m[2] ? Math.min(Math.max(+m[2], 1), found.chapters) : 1;
  const out = { book: found.id, chapter };
  if (m[3]) { out.verse = +m[3]; if (m[4]) out.verseEnd = +m[4]; }
  return out;
}

// Versículo do dia: lista curada (livro, capítulo, v1, v2)
export const VOTD = [
  ['jo', 3, 16], ['sl', 22, 1, 4], ['mt', 11, 28, 30], ['jo', 14, 6], ['fl', 4, 13], ['rm', 8, 28], ['is', 41, 10], ['pr', 3, 5, 6],
  ['mt', 5, 3, 10], ['jo', 6, 51], ['mt', 16, 18, 19], ['lc', 1, 28], ['lc', 1, 38], ['lc', 1, 46, 49], ['sb', 3, 1, 3], ['eclo', 2, 1, 6],
  ['tb', 4, 7, 11], ['2mc', 12, 46], ['jt', 8, 14, 17], ['br', 3, 9, 14], ['1cor', 13, 4, 7], ['1cor', 13, 13], ['sl', 26, 1], ['sl', 90, 1, 2],
  ['sl', 118, 105], ['sl', 50, 3, 4], ['sl', 33, 9], ['sl', 45, 2, 3], ['sl', 102, 1, 4], ['sl', 129, 1, 4], ['sl', 22, 4], ['sl', 26, 4],
  ['is', 9, 6], ['is', 53, 4, 5], ['is', 40, 31], ['is', 43, 1, 2], ['jr', 29, 11, 13], ['lm', 3, 22, 23], ['ez', 36, 26], ['os', 6, 6],
  ['mq', 6, 8], ['hab', 3, 17, 18], ['sf', 3, 17], ['ml', 3, 10], ['mt', 6, 33], ['mt', 6, 9, 13], ['mt', 7, 7, 8], ['mt', 18, 20], ['mt', 22, 37, 39],
  ['mt', 25, 40], ['mt', 28, 19, 20], ['mc', 10, 45], ['mc', 12, 30, 31], ['mc', 16, 15], ['lc', 6, 36, 38], ['lc', 11, 9, 10], ['lc', 12, 32],
  ['lc', 15, 20], ['lc', 22, 19], ['lc', 23, 34], ['lc', 24, 32], ['jo', 1, 1, 5], ['jo', 1, 14], ['jo', 8, 12], ['jo', 10, 10, 11], ['jo', 11, 25, 26],
  ['jo', 13, 34, 35], ['jo', 15, 5], ['jo', 15, 12, 13], ['jo', 16, 33], ['jo', 19, 26, 27], ['jo', 20, 29], ['jo', 21, 15, 17], ['at', 2, 42], ['at', 4, 12],
  ['at', 20, 35], ['rm', 5, 5], ['rm', 8, 31], ['rm', 8, 38, 39], ['rm', 12, 2], ['rm', 12, 12], ['rm', 12, 21], ['1cor', 10, 13], ['1cor', 11, 23, 26],
  ['1cor', 15, 55, 57], ['2cor', 5, 17], ['2cor', 12, 9], ['gl', 2, 20], ['gl', 5, 22, 23], ['ef', 2, 8, 10], ['ef', 4, 32], ['ef', 6, 10, 11],
  ['fl', 1, 21], ['fl', 2, 5, 8], ['fl', 4, 4, 7], ['cl', 3, 12, 14], ['cl', 3, 23], ['1ts', 5, 16, 18], ['2tm', 1, 7], ['2tm', 4, 7, 8], ['tt', 3, 4, 7],
  ['hb', 4, 12], ['hb', 11, 1], ['hb', 12, 1, 2], ['hb', 13, 8], ['tg', 1, 5], ['tg', 2, 17], ['tg', 5, 16], ['1pd', 5, 7], ['1pd', 2, 9], ['1pd', 3, 15],
  ['2pd', 1, 4], ['1jo', 4, 7, 8], ['1jo', 4, 16], ['1jo', 4, 18, 19], ['1jo', 1, 9], ['ap', 3, 20], ['ap', 21, 4, 5], ['ap', 22, 20], ['ap', 12, 1],
  ['gn', 1, 27, 28], ['gn', 12, 2, 3], ['gn', 28, 15], ['ex', 3, 14], ['ex', 20, 2, 3], ['ex', 14, 14], ['dt', 6, 4, 7], ['dt', 30, 19, 20], ['dt', 31, 6],
  ['js', 1, 9], ['js', 24, 15], ['rt', 1, 16], ['1sm', 3, 9, 10], ['1sm', 16, 7], ['2sm', 22, 2, 3], ['1rs', 19, 11, 12], ['2rs', 6, 16], ['1cr', 16, 8, 11],
  ['2cr', 7, 14], ['esd', 3, 11], ['ne', 8, 10], ['est', 4, 14], ['1mc', 2, 61, 64], ['2mc', 7, 28], ['job', 1, 21], ['job', 19, 25, 27], ['job', 42, 2, 5],
  ['sl', 1, 1, 3], ['sl', 8, 4, 6], ['sl', 15, 11], ['sl', 18, 2], ['sl', 24, 4, 5], ['sl', 30, 2, 3], ['sl', 36, 5], ['sl', 41, 2, 3], ['sl', 42, 1, 2],
  ['sl', 62, 2, 4], ['sl', 83, 2, 5], ['sl', 85, 5], ['sl', 94, 1, 2], ['sl', 99, 1, 5], ['sl', 115, 12, 13], ['sl', 120, 1, 2], ['sl', 126, 1], ['sl', 130, 1, 2],
  ['sl', 138, 1, 4], ['sl', 142, 8], ['sl', 144, 8, 9], ['sl', 150, 1, 6], ['pr', 16, 3], ['pr', 22, 6], ['pr', 31, 30], ['ecl', 3, 1, 8], ['ct', 8, 6, 7],
  ['sb', 1, 1, 2], ['sb', 7, 7, 8], ['sb', 11, 24, 26], ['eclo', 3, 3, 6], ['eclo', 6, 14, 16], ['eclo', 15, 1, 3], ['eclo', 35, 16, 17], ['eclo', 51, 1],
  ['tb', 12, 6, 8], ['tb', 13, 1, 4], ['jt', 16, 15], ['dn', 3, 57, 58], ['dn', 12, 3], ['jl', 2, 12, 13], ['am', 5, 24], ['jn', 2, 3, 8], ['na', 1, 7],
  ['ag', 2, 5], ['zc', 9, 9], ['1tm', 6, 12], ['fm', 1, 7], ['jd', 1, 24, 25], ['2jo', 1, 6], ['3jo', 1, 11], ['2ts', 3, 16], ['1ts', 4, 11, 12], ['2pd', 3, 8, 9],
];
export function verseOfTheDay(dateISO) {
  let h = 0;
  for (const c of dateISO) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return VOTD[h % VOTD.length];
}
