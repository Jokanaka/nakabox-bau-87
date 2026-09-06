// Planos de leitura — gerados a partir do catálogo de livros
import { books, book } from './data.js';

function chaptersOf(ids) {
  const out = [];
  for (const id of ids) {
    const b = book(id);
    if (!b) continue;
    for (let c = 1; c <= b.chapters; c++) out.push({ book: id, chapter: c });
  }
  return out;
}
function split(list, days) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const a = Math.floor(i * list.length / days);
    const b = Math.floor((i + 1) * list.length / days);
    out.push(list.slice(a, b));
  }
  return out.filter((d) => d.length);
}
const r = (book, chapter) => ({ book, chapter });
const OT = () => books().filter((b) => b.test === 'AT').map((b) => b.id);
const NT = () => books().filter((b) => b.test === 'NT').map((b) => b.id);
const ALL = () => books().map((b) => b.id);

export const PLANS = [
  { id: 'biblia-1-ano', name: 'Bíblia em 1 ano', emoji: '📖', color: '#7B1E3B', days: 365,
    desc: 'Os 73 livros na ordem canônica, cerca de 4 capítulos por dia.', build: () => split(chaptersOf(ALL()), 365) },
  { id: 'biblia-2-anos', name: 'Bíblia em 2 anos', emoji: '🕊️', color: '#1F3A5F', days: 730,
    desc: 'Ritmo tranquilo: 2 capítulos por dia, toda a Bíblia em dois anos.', build: () => split(chaptersOf(ALL()), 730) },
  { id: 'nt-90', name: 'Novo Testamento em 90 dias', emoji: '✝️', color: '#8A5A1F', days: 90,
    desc: 'Evangelhos, Atos, Cartas e Apocalipse em três meses.', build: () => split(chaptersOf(NT()), 90) },
  { id: 'evangelhos-40', name: 'Os quatro Evangelhos em 40 dias', emoji: '🐟', color: '#2E5E4E', days: 40,
    desc: 'Mateus, Marcos, Lucas e João. Ideal para a Quaresma.', build: () => split(chaptersOf(['mt', 'mc', 'lc', 'jo']), 40) },
  { id: 'salmos-30', name: 'Salmos em 30 dias', emoji: '🎵', color: '#5B3A8C', days: 30,
    desc: 'Os 150 Salmos, cinco por dia, como na oração da Igreja.', build: () => split(chaptersOf(['sl']), 30) },
  { id: 'deuterocanonicos-30', name: 'Livros Deuterocanônicos em 30 dias', emoji: '📜', color: '#B0632C', days: 30,
    desc: 'Tobias, Judite, Sabedoria, Eclesiástico, Baruc e Macabeus — os livros que só a Bíblia Católica traz.',
    build: () => split([...chaptersOf(['tb', 'jt']), ...[10, 11, 12, 13, 14, 15, 16].map((c) => r('est', c)), ...chaptersOf(['sb', 'eclo', 'br']), r('dn', 13), r('dn', 14), ...chaptersOf(['1mc', '2mc'])], 30) },
  { id: 'sabedoria-60', name: 'Livros Sapienciais em 60 dias', emoji: '🕯️', color: '#5A6B2F', days: 60,
    desc: 'Jó, Provérbios, Eclesiastes, Cântico dos Cânticos, Sabedoria e Eclesiástico.', build: () => split(chaptersOf(['job', 'pr', 'ecl', 'ct', 'sb', 'eclo']), 60) },
  { id: 'pentateuco-60', name: 'Pentateuco em 60 dias', emoji: '🔥', color: '#9C3B1F', days: 60,
    desc: 'Gênesis, Êxodo, Levítico, Números e Deuteronômio.', build: () => split(chaptersOf(['gn', 'ex', 'lv', 'nm', 'dt']), 60) },
  { id: 'historicos-90', name: 'Livros Históricos em 90 dias', emoji: '🏛️', color: '#6B4E2E', days: 90,
    desc: 'De Josué aos Macabeus: a história do povo de Deus.', build: () => split(chaptersOf(['js', 'jz', 'rt', '1sm', '2sm', '1rs', '2rs', '1cr', '2cr', 'esd', 'ne', 'tb', 'jt', 'est', '1mc', '2mc']), 90) },
  { id: 'profetas-90', name: 'Profetas em 90 dias', emoji: '📯', color: '#2F5D8A', days: 90,
    desc: 'De Isaías a Malaquias, incluindo Baruc e Daniel.', build: () => split(chaptersOf(['is', 'jr', 'lm', 'br', 'ez', 'dn', 'os', 'jl', 'am', 'ab', 'jn', 'mq', 'na', 'hab', 'sf', 'ag', 'zc', 'ml']), 90) },
  { id: 'atos-cartas-60', name: 'Atos, Cartas e Apocalipse em 60 dias', emoji: '✉️', color: '#8C2F5B', days: 60,
    desc: 'A vida da Igreja nascente e os escritos apostólicos.', build: () => split(chaptersOf(NT().filter((id) => !['mt', 'mc', 'lc', 'jo'].includes(id))), 60) },
  { id: 'advento-24', name: 'Advento: a promessa do Messias', emoji: '🕯️', color: '#5B3A8C', days: 24,
    desc: 'Um capítulo por dia, de 1º a 24 de dezembro, com as profecias e a infância de Jesus.',
    build: () => [r('is', 2), r('is', 7), r('is', 9), r('is', 11), r('is', 12), r('is', 25), r('is', 35), r('is', 40), r('is', 42), r('is', 49), r('is', 52), r('is', 53), r('is', 55), r('is', 60), r('is', 61), r('is', 62), r('mq', 5), r('ml', 3), r('mt', 1), r('lc', 1), r('mt', 2), r('lc', 2), r('jo', 1), r('tt', 2)].map((x) => [x]) },
  { id: 'quaresma-40', name: 'Quaresma: Marcos, João e os salmos penitenciais', emoji: '🌿', color: '#5A2A83', days: 40,
    desc: 'Os Evangelhos de Marcos e João, Isaías 53 e os salmos Miserere e De profundis.',
    build: () => [...chaptersOf(['mc', 'jo']), r('is', 53), r('sl', 50), r('sl', 129)].map((x) => [x]) },
  { id: 'semana-santa', name: 'Semana Santa', emoji: '🌴', color: '#7B1E3B', days: 8,
    desc: 'Do Domingo de Ramos ao Domingo da Ressurreição, dia a dia com os Evangelhos.',
    build: () => [[r('mt', 21)], [r('jo', 12)], [r('jo', 13)], [r('mt', 26)], [r('jo', 14), r('jo', 15), r('jo', 16), r('jo', 17)], [r('jo', 18), r('jo', 19)], [r('mt', 27), r('sl', 21)], [r('jo', 20), r('lc', 24)]] },
  { id: 'maria-9', name: 'Novena: Maria na Bíblia', emoji: '🌹', color: '#2F5D8A', days: 9,
    desc: 'Nove dias com as passagens em que a Igreja contempla a Virgem Maria.',
    build: () => [[r('gn', 3)], [r('is', 7)], [r('mq', 5)], [r('lc', 1)], [r('lc', 2)], [r('jo', 2)], [r('jo', 19)], [r('at', 1)], [r('ap', 12)]] },
  { id: 'eucaristia-7', name: 'A Eucaristia nas Escrituras', emoji: '🍞', color: '#B08A1F', days: 7,
    desc: 'Do maná ao Pão da Vida: sete dias sobre o mistério eucarístico.',
    build: () => [[r('ex', 12)], [r('ex', 16)], [r('1rs', 19)], [r('jo', 6)], [r('mt', 26)], [r('1cor', 10), r('1cor', 11)], [r('lc', 24)]] },
  { id: 'misericordia-7', name: 'A misericórdia de Deus', emoji: '💗', color: '#B3264A', days: 7,
    desc: 'Sete dias com as páginas mais belas sobre o perdão e a misericórdia.',
    build: () => [[r('sl', 50)], [r('os', 11)], [r('lc', 15)], [r('jo', 8)], [r('mt', 18)], [r('sb', 11)], [r('rm', 5)]] },
];

export function plan(id) { return PLANS.find((p) => p.id === id); }
const built = new Map();
export function planDays(id) {
  if (!built.has(id)) { const p = plan(id); built.set(id, p ? p.build() : []); }
  return built.get(id);
}
export function planProgress(id, state) {
  const days = planDays(id);
  const done = state ? Object.keys(state.done || {}).length : 0;
  return { total: days.length, done, pct: days.length ? Math.round(done * 100 / days.length) : 0 };
}
export function nextDay(id, state) {
  const days = planDays(id);
  for (let i = 0; i < days.length; i++) if (!state || !state.done || !state.done[i]) return i;
  return -1;
}
