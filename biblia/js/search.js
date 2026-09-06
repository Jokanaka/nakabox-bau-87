// Busca por texto em toda a Bíblia (sem acentos, sem diferenciar maiúsculas)
import { norm } from './util.js';
import { books, loadBook } from './data.js';

const indexes = new Map();

export async function ensureIndex(ver, onProgress) {
  if (indexes.has(ver)) return indexes.get(ver);
  const list = books();
  const idx = [];
  let done = 0;
  // carrega em lotes de 6 livros
  for (let i = 0; i < list.length; i += 6) {
    const batch = list.slice(i, i + 6);
    const loaded = await Promise.all(batch.map((b) => loadBook(ver, b.id).catch(() => null)));
    loaded.forEach((bk, j) => {
      const b = batch[j];
      if (!bk) return;
      for (const ch of bk.chapters) {
        ch.verses.forEach((t, k) => {
          if (t) idx.push({ b: b.id, c: ch.n, v: k + 1, t, n: norm(t), test: b.test });
        });
      }
    });
    done += batch.length;
    if (onProgress) onProgress(done, list.length);
  }
  indexes.set(ver, idx);
  return idx;
}

export function search(idx, query, { testament = null, limit = 300 } = {}) {
  const q = norm(query).trim();
  if (!q) return { results: [], total: 0 };
  let phrase = null;
  let words;
  const pm = q.match(/^"(.+)"$/);
  if (pm) { phrase = pm[1].trim(); words = [phrase]; }
  else words = q.split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  if (!words.length) return { results: [], total: 0 };
  const results = [];
  let total = 0;
  for (const e of idx) {
    if (testament && e.test !== testament) continue;
    let ok = true;
    if (phrase) ok = e.n.includes(phrase);
    else for (const w of words) { if (!e.n.includes(w)) { ok = false; break; } }
    if (!ok) continue;
    total++;
    if (results.length < limit) results.push(e);
  }
  // ordena: frase exata primeiro (quando várias palavras)
  if (!phrase && words.length > 1) {
    const full = words.join(' ');
    results.sort((a, b) => (b.n.includes(full) ? 1 : 0) - (a.n.includes(full) ? 1 : 0));
  }
  return { results, total, words };
}

// realça as palavras no texto original (mantém acentos)
export function highlightText(text, words, esc) {
  if (!words || !words.length) return esc(text);
  const n = norm(text);
  // mapa de posições: norm() pode alterar comprimento (raro); assume mesmo comprimento por caractere base
  const marks = new Array(text.length).fill(false);
  for (const w of words) {
    let pos = 0;
    while ((pos = n.indexOf(w, pos)) !== -1) {
      for (let i = pos; i < Math.min(pos + w.length, marks.length); i++) marks[i] = true;
      pos += w.length;
    }
  }
  let out = '';
  let open = false;
  for (let i = 0; i < text.length; i++) {
    if (marks[i] && !open) { out += '<mark>'; open = true; }
    if (!marks[i] && open) { out += '</mark>'; open = false; }
    out += esc(text[i]);
  }
  if (open) out += '</mark>';
  return out;
}
