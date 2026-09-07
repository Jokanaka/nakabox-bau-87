// Leitor da Bíblia: capítulo, seleção de versículos, destaques, notas, áudio, comparação, seletor de livros, busca
import { $, $$, h, esc, icon, toast, copyText, norm } from './util.js';
import { store, refKey } from './store.js';
import { VERSIONS, version, books, book, bookName, groups, nextChapter, prevChapter, loadBook, getChapter, getVerses, refString, refLong, parseRef, psalmHebrew } from './data.js';
import { openSheet, openModal, topbar, closeAll } from './ui.js';
import { makeVerseImage, shareImage, shareText } from './share.js';
import { ensureIndex, search, highlightText } from './search.js';
import { PLANS, plan as getPlan, planDays, nextDay } from './plans.js';
import { liturgicalDay, readingsFor } from './liturgy.js';
import { MYSTERIES, mysteryOfDay } from './rosary.js';
import * as audio from './audio.js';

const HL_COLORS = ['amarelo', 'verde', 'azul', 'rosa', 'laranja', 'roxo'];
let selected = new Set();
let current = { book: 'gn', chapter: 1 };

export function applySettings() {
  const s = store.settings;
  const rootEl = document.documentElement;
  const theme = s.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme;
  rootEl.setAttribute('data-theme', theme);
  rootEl.style.setProperty('--read-size', s.fontSize + 'px');
  rootEl.style.setProperty('--read-lh', s.lineHeight);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = theme === 'dark' ? '#1C1B1A' : theme === 'sepia' ? '#F4ECD8' : '#7B1E3B';
}

export function currentRef() { return current; }

// ---------- Leitor ----------
export async function renderReader(view, { book: bid, chapter, verse, verseEnd, plan, day }) {
  stopTTS();
  const s = store.settings;
  const ver = s.version;
  const b = book(bid) || book('gn');
  chapter = Math.min(Math.max(+chapter || 1, 1), b.chapters);
  current = { book: b.id, chapter };
  selected = new Set();
  store.setLast(b.id, chapter);

  view.innerHTML = `
    ${topbar({ title: '', right: `
      <button class="pill-btn" data-act="pick">${esc(bookName(b, ver))} ${chapter} ${icon('chevD')}</button>
      ${s.uiMode === 'avancado' ? `<button class="pill-btn ver" data-act="ver">${esc(version(ver).short)}</button>` : ''}
      <span class="spacer"></span>
      <button class="icon-btn" data-act="font" aria-label="Aparência">${icon('font')}</button>
      <button class="icon-btn" data-act="search" aria-label="Buscar">${icon('search')}</button>
      <button class="icon-btn" data-act="tts" aria-label="Ouvir">${icon('play')}</button>`
    })}
    ${todayStrip(b, chapter, ver)}
    ${plan ? planBar(plan, +day, b.id, chapter) : ''}
    <div id="chapter" class="reader ${s.fontFamily === 'sans' ? 'sans' : ''} ${s.showVerseNumbers ? '' : 'hide-vn'}">
      <div class="skel" style="width:40%;margin:30px auto"></div><div class="skel"></div><div class="skel"></div><div class="skel" style="width:80%"></div>
    </div>
    <div class="ch-nav">
      <button class="btn nav" data-act="prev" aria-label="Capítulo anterior">${icon('chevL')}</button>
      <button class="btn primary" data-act="done">${icon('check')} ${store.isRead(b.id, chapter) ? 'Lido · próximo capítulo' : 'Concluir capítulo'}</button>
      <button class="btn nav" data-act="next" aria-label="Próximo capítulo">${icon('chevR')}</button>
    </div>
    <div class="fab-nav"><div class="inner">
      <button data-act="prev" aria-label="Capítulo anterior">${icon('chevL')}</button>
      <button data-act="next" aria-label="Próximo capítulo">${icon('chevR')}</button>
    </div></div>`;
  view.querySelector('.topbar h1').remove();

  const prev = prevChapter(b.id, chapter);
  const next = nextChapter(b.id, chapter);
  $$('[data-act=prev]', view).forEach((el) => { el.disabled = !prev; el.onclick = () => prev && go(prev.book, prev.chapter, plan, day); });
  $$('[data-act=next]', view).forEach((el) => { el.disabled = !next; el.onclick = () => next && go(next.book, next.chapter, plan, day); });
  $('[data-act=pick]', view).onclick = () => openBookPicker(b.id, chapter);
  { const vb = $('[data-act=ver]', view); if (vb) vb.onclick = () => openVersionPicker(); }
  $('[data-act=font]', view).onclick = () => openFontSheet();
  $('[data-act=search]', view).onclick = () => { location.hash = '#/busca'; };
  $('[data-act=tts]', view).onclick = () => toggleTTS(view);
  $('[data-act=done]', view).onclick = () => {
    store.markRead(b.id, chapter, true);
    if (plan) completePlanReading(plan, +day, b.id, chapter);
    else { toast('Capítulo concluído ✓'); if (next) go(next.book, next.chapter); }
  };

  let ch;
  try { ch = await getChapter(ver, b.id, chapter); }
  catch (e) {
    $('#chapter', view).innerHTML = `<div class="missing">Não foi possível carregar o texto.<br><span class="small">Verifique sua conexão. Os capítulos já lidos ficam disponíveis sem internet.</span><br><br><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`;
    return;
  }
  const cont = $('#chapter', view);
  if (!ch || !ch.verses || !ch.verses.length) {
    cont.innerHTML = `<div class="missing">Este capítulo ainda não está disponível nesta versão.</div>`;
    return;
  }
  const html = [];
  html.push(`<h2 class="ch-title">${esc(bookName(b, ver))}${b.deutero ? ' <span class="badge">Deuterocanônico</span>' : ''}</h2>`);
  html.push(`<div class="ch-num">${chapter}</div>`);
  html.push(`<div class="ch-summary read-flag" id="read-flag" ${store.isRead(b.id, chapter) ? '' : 'hidden'}>✓ Capítulo já lido</div>`);
  if (b.id === 'sl' && psalmHebrew(chapter) !== String(chapter)) html.push(`<div class="ch-summary" style="margin-bottom:6px">Salmo ${psalmHebrew(chapter)} na numeração hebraica (Bíblias modernas)</div>`);
  if (ch.title) html.push(`<div class="ch-summary">${esc(ch.title)}</div>`);
  if (ch.heading) html.push(`<p class="heading">${esc(ch.heading)}</p>`);
  ch.verses.forEach((t, i) => {
    const v = i + 1;
    const key = refKey(b.id, chapter, v);
    const hl = store.highlight(key);
    const cls = ['verse'];
    if (hl) cls.push('hl-' + hl);
    if (store.note(key)) cls.push('has-note');
    if (store.isBookmarked(key)) cls.push('bm');
    if (!t) { html.push(`<p class="verse empty-v" data-v="${v}"><span class="vn">${v}</span>${ch.src === 'ocr' ? '(número não reconhecido pelo OCR; o texto deste versículo está no anterior)' : '[versículo não disponível nesta edição]'}</p>`); return; }
    html.push(`<p class="${cls.join(' ')}" data-v="${v}" id="v${v}"><span class="vn">${v}</span>${esc(t)}</p>`);
  });
  if (ch.src === 'ocr') {
    html.push(`<div class="ocr-note">${icon('warn')}<div>Texto extraído por reconhecimento óptico (OCR) da edição de 1950; pode conter pequenos erros. <a href="https://bibliatraduzida.com/edicoes/figueiredo/${esc(b.slug || '')}/${chapter}.pdf" target="_blank" rel="noopener">Ver a página original</a>.</div></div>`);
  }
  cont.innerHTML = html.join('');
  current.title = ch.title || '';
  setupProgress(view, cont, b, chapter);
  fillTodayChips(view);
  store.pushHistory(b.id, chapter);
  const playing = audio.isActive() ? audio.currentRef() : null;
  if (playing && playing.book === b.id && playing.chapter === chapter) { audio.attach({ onItem: ttsOnItem, onEnd: ttsOnEnd }); setTtsButton(true); }
  cont.addEventListener('click', (e) => {
    const p = e.target.closest('.verse');
    if (!p || p.classList.contains('empty-v')) return;
    const v = +p.dataset.v;
    if (selected.has(v)) { selected.delete(v); p.classList.remove('sel'); }
    else { selected.add(v); p.classList.add('sel'); }
    if (selected.size) openVerseSheet(b, chapter, ch, ver);
  });
  // rolar até o versículo
  if (verse) {
    const el = cont.querySelector(`#v${verse}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      el.classList.add('sel');
      selected.add(+verse);
      if (verseEnd) for (let v = +verse + 1; v <= +verseEnd; v++) { const x = cont.querySelector(`#v${v}`); if (x) { x.classList.add('sel'); selected.add(v); } }
      setTimeout(() => { selected.clear(); $$('.verse.sel', cont).forEach((x) => x.classList.remove('sel')); }, 3500);
    }
  } else {
    // volta ao versículo onde a pessoa parou de ler neste capítulo
    const rv = store.readPos(b.id, chapter);
    const el = rv > 1 ? cont.querySelector(`#v${rv}`) : null;
    if (el) { scrollToVerseTop(view, el); toast(`Continuando do versículo ${rv}`); }
    else window.scrollTo(0, 0);
  }
  // gesto de deslizar (remove os ouvintes do capítulo anterior antes de registrar os novos)
  let sx = 0, sy = 0;
  if (view._swipe) { view.removeEventListener('touchstart', view._swipe[0]); view.removeEventListener('touchend', view._swipe[1]); }
  const onStart = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
  const onEnd = (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 80 && Math.abs(dy) < 60) {
      if (dx < 0 && next) go(next.book, next.chapter, plan, day);
      if (dx > 0 && prev) go(prev.book, prev.chapter, plan, day);
    }
  };
  view._swipe = [onStart, onEnd];
  view.addEventListener('touchstart', onStart, { passive: true });
  view.addEventListener('touchend', onEnd, { passive: true });
  // esconde as setas flutuantes quando a barra de navegação do fim do capítulo está visível
  const fab = $('.fab-nav', view); const chnav = $('.ch-nav', view);
  if (fab && chnav && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { fab.style.opacity = entries[0].isIntersecting ? '0' : '1'; fab.style.pointerEvents = entries[0].isIntersecting ? 'none' : ''; }, { threshold: 0.2 }).observe(chnav);
  }
  // marca o capítulo como lido ao chegar ao fim dele (depois de pelo menos 8 s de leitura)
  const openedAt = Date.now();
  const lastVerse = $$('#chapter .verse', view).pop();
  if (lastVerse && 'IntersectionObserver' in window && !store.isRead(b.id, chapter)) {
    let visible = false, timer = null;
    const io = new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; tryMark(); }, { threshold: 0.4 });
    const tryMark = () => {
      clearTimeout(timer);
      if (!visible || store.isRead(b.id, chapter)) return;
      if (current.book !== b.id || current.chapter !== chapter) { io.disconnect(); return; }
      const left = 8000 - (Date.now() - openedAt);
      if (left > 0) { timer = setTimeout(tryMark, left); return; }
      io.disconnect(); markChapterRead(b.id, chapter);
    };
    io.observe(lastVerse);
  }
  // pré-carrega o próximo livro
  if (next && next.book !== b.id) loadBook(ver, next.book).catch(() => {});
}

// ---------- Resumo do dia e progresso do capítulo (alto do leitor) ----------
function todayStrip(b, chapter, ver) {
  return `<div class="today" id="today">
    <div class="today-prog"><span class="tp-label"><b>${esc(bookName(b, ver))} ${chapter}</b> · capítulo ${chapter} de ${b.chapters}</span><span class="tp-pct" id="tp-pct">faltam 100% do capítulo</span></div>
    <div class="progress thin"><i id="tp-bar" style="width:0%"></i></div>
    ${store.settings.todayStrip !== false ? `<div class="today-chips" id="today-chips">${todayChips()}</div>` : ''}
  </div>`;
}
function todayChips() {
  const now = new Date();
  const lit = liturgicalDay(now);
  const chips = [];
  for (const p of PLANS) {
    const st = store.plan(p.id); if (!st) continue;
    const nd = nextDay(p.id, st); if (nd < 0) continue;
    const d = planDays(p.id)[nd]; if (!d || !d.length) continue;
    chips.push(`<a class="chip" href="#/biblia/${d[0].book}/${d[0].chapter}?plan=${p.id}&day=${nd}">${esc(p.emoji)} ${esc(d.map((r) => refString(r.book, r.chapter)).join(' · '))}</a>`);
  }
  const rs = store.routinesSummary();
  chips.push(rs.count ? `<a class="chip ${rs.all ? 'done' : ''}" href="#/oracoes/dia">🙏 Orações ${rs.done}/${rs.total}</a>` : `<a class="chip" href="#/oracoes/dia/novo">🙏 Orações do dia</a>`);
  const my = MYSTERIES[mysteryOfDay(now, lit.season === 'triduo' ? 'quaresma' : lit.season)];
  chips.push(`<a class="chip" href="#/rosario">📿 ${esc(my.name.replace('Mistérios ', ''))}</a>`);
  chips.push(`<a class="chip" href="#/missa" id="chip-missa">🕊 Missa de hoje</a>`);
  chips.push(`<a class="chip" href="#/liturgia"><span class="lit-dot" style="background:${lit.colorHex}"></span>${esc(lit.name)}</a>`);
  return chips.join('');
}
async function fillTodayChips(view) {
  const c = $('#chip-missa', view); if (!c) return;
  try {
    const { readings } = await readingsFor(new Date());
    if (readings && readings.gospel && c.isConnected) c.innerHTML = `🕊 Evangelho: ${esc(readings.gospel.disp || readings.gospel.raw)}`;
  } catch { /* sem leituras na base local */ }
}
// altura do que fica fixo no alto (barra do leitor), para alinhar um versículo logo abaixo
function topOffset(view) { const tb = $('.topbar', view); return (tb ? tb.getBoundingClientRect().height : 0) + 6; }
function scrollToVerseTop(view, el) { window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - topOffset(view))); }
// primeiro versículo visível na tela (o que a pessoa está lendo)
function topVisibleVerse(view, cont) {
  const off = topOffset(view);
  for (const p of $$('.verse', cont)) { if (p.getBoundingClientRect().bottom > off) return +p.dataset.v; }
  return 1;
}

function setupProgress(view, cont, b, chapter) {
  const pctEl = $('#tp-pct', view), bar = $('#tp-bar', view);
  if (view._progH) { window.removeEventListener('scroll', view._progH); window.removeEventListener('resize', view._progH); }
  clearTimeout(view._posT);
  let ticking = false, pct = 0;
  const update = () => {
    ticking = false;
    if (current.book !== b.id || current.chapter !== chapter || !cont.isConnected) return;
    const rect = cont.getBoundingClientRect();
    const total = rect.height || 1;
    const seen = Math.min(total, Math.max(0, window.innerHeight - rect.top));
    pct = Math.max(0, Math.min(100, Math.round(seen * 100 / total)));
    if (pctEl && bar) {
      bar.style.width = pct + '%';
      pctEl.textContent = pct >= 99 ? '✓ fim do capítulo' : `faltam ${100 - pct}% do capítulo`;
    }
    // guarda onde parou (pouco depois de a rolagem parar); concluir o capítulo apaga a posição
    clearTimeout(view._posT);
    view._posT = setTimeout(() => {
      if (current.book !== b.id || current.chapter !== chapter || !cont.isConnected) return;
      store.setReadPos(b.id, chapter, topVisibleVerse(view, cont));
    }, 400);
  };
  const h = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  view._progH = h;
  window.addEventListener('scroll', h, { passive: true });
  window.addEventListener('resize', h, { passive: true });
  update();
}

function go(bid, chapter, plan, day) {
  const q = plan ? `?plan=${plan}&day=${day}` : '';
  location.hash = `#/biblia/${bid}/${chapter}${q}`;
}

function planBar(planId, day, bid, chapter) {
  const p = getPlan(planId); if (!p) return '';
  const readings = planDays(planId)[day] || [];
  const idx = readings.findIndex((r) => r.book === bid && r.chapter === chapter);
  return `<div class="section" style="padding:10px 16px 0"><div class="card gold row between" style="padding:10px 14px">
    <div><b>${esc(p.emoji)} ${esc(p.name)}</b><div class="small muted">Dia ${day + 1} · leitura ${idx + 1} de ${readings.length}</div></div>
    <a class="btn sm" href="#/planos/${planId}">Ver plano</a></div></div>`;
}
function completePlanReading(planId, day, bid, chapter) {
  const readings = planDays(planId)[day] || [];
  const idx = readings.findIndex((r) => r.book === bid && r.chapter === chapter);
  const nxt = readings[idx + 1];
  if (nxt) { toast('Leitura concluída ✓'); go(nxt.book, nxt.chapter, planId, day); }
  else { store.setPlanDay(planId, day, true); toast('Dia concluído! 🎉'); location.hash = `#/planos/${planId}`; }
}

// ---------- Folha de ações do versículo ----------
let sheetRef = null;
function openVerseSheet(b, chapter, ch, ver) {
  if (sheetRef) { updateVerseSheet(b, chapter, ch); return; }
  const { el, close } = openSheet(`<div id="vs"></div>`, { onClose: () => { sheetRef = null; selected.clear(); $$('.verse.sel').forEach((x) => x.classList.remove('sel')); } });
  sheetRef = { el, close, ver };
  updateVerseSheet(b, chapter, ch);
}
function selRange() {
  const vs = [...selected].sort((a, b) => a - b);
  return { vs, v1: vs[0], v2: vs[vs.length - 1] };
}
function selText(ch) {
  const { vs } = selRange();
  return vs.map((v) => (store.settings.showVerseNumbers && vs.length > 1 ? `${v} ` : '') + (ch.verses[v - 1] || '')).join(' ').trim();
}
function updateVerseSheet(b, chapter, ch) {
  if (!sheetRef) return;
  if (!selected.size) { sheetRef.close(); return; }
  const { vs, v1, v2 } = selRange();
  const ref = refString(b.id, chapter, v1, v2);
  const keys = vs.map((v) => refKey(b.id, chapter, v));
  const bm = keys.every((k) => store.isBookmarked(k));
  const cur = store.highlight(keys[0]);
  const text = selText(ch);
  $('#vs', sheetRef.el).innerHTML = `
    <div class="ref">${esc(ref)}</div>
    <div class="preview">${esc(text)}</div>
    <div class="hl-colors">
      ${HL_COLORS.map((c) => `<button data-hl="${c}" style="background:var(--hl-${c});${cur === c ? 'border-color:var(--accent)' : ''}" aria-label="Destacar ${c}"></button>`).join('')}
      <button class="none" data-hl="" aria-label="Remover destaque"></button>
    </div>
    <div class="actions-grid">
      <button data-act="copy">${icon('copy')}Copiar</button>
      <button data-act="note">${icon('note')}Nota</button>
      <button data-act="bm">${bm ? icon('bookmark') : icon('bookmarkO')}${bm ? 'Salvo' : 'Salvar'}</button>
      <button data-act="share">${icon('share')}Imagem</button>
      <button data-act="sharetxt">${icon('share')}Texto</button>
      <button data-act="compare">${icon('compare')}Comparar</button>
      <button data-act="listen">${icon('play')}Ouvir</button>
      <button data-act="clear">${icon('close')}Limpar</button>
    </div>`;
  const el = sheetRef.el;
  $$('[data-hl]', el).forEach((btn) => btn.onclick = () => {
    const c = btn.dataset.hl || null;
    store.setHighlight(keys, c);
    vs.forEach((v) => { const p = $(`#v${v}`); if (!p) return; HL_COLORS.forEach((x) => p.classList.remove('hl-' + x)); if (c) p.classList.add('hl-' + c); });
    toast(c ? 'Destacado' : 'Destaque removido');
    updateVerseSheet(b, chapter, ch);
  });
  $('[data-act=copy]', el).onclick = () => copyText(`"${text}" (${ref})`);
  $('[data-act=note]', el).onclick = () => openNoteEditor(keys[0], ref, text, () => { const p = $(`#v${v1}`); if (p) p.classList.toggle('has-note', !!store.note(keys[0])); });
  $('[data-act=bm]', el).onclick = () => {
    const on = !bm;
    keys.forEach((k) => { if (store.isBookmarked(k) !== on) store.toggleBookmark(k); });
    vs.forEach((v) => { const p = $(`#v${v}`); if (p) p.classList.toggle('bm', on); });
    toast(on ? 'Salvo nos favoritos' : 'Removido dos favoritos');
    updateVerseSheet(b, chapter, ch);
  };
  $('[data-act=share]', el).onclick = () => openShareImage(text, ref);
  $('[data-act=sharetxt]', el).onclick = async () => { const ok = await shareText(`"${text}" (${ref}) — Bíblia Católica`); if (!ok) copyText(`"${text}" (${ref})`); };
  $('[data-act=compare]', el).onclick = () => openCompare(b, chapter, v1, v2);
  $('[data-act=listen]', el).onclick = () => { sheetRef.close(); startTTS(v1).catch(() => {}); };
  $('[data-act=clear]', el).onclick = () => sheetRef.close();
}

function openNoteEditor(key, ref, text, onSave) {
  const existing = store.note(key);
  const { el, close } = openSheet(`
    <h3>Nota · ${esc(ref)}</h3>
    <div class="preview">${esc(text)}</div>
    <textarea class="input" id="note-txt" placeholder="Escreva sua reflexão…">${esc(existing ? existing.text : '')}</textarea>
    <div class="row" style="margin-top:12px">
      ${existing ? `<button class="btn danger" data-act="del">${icon('trash')} Apagar</button>` : ''}
      <span class="grow"></span>
      <button class="btn primary" data-act="save">Salvar</button>
    </div>`);
  $('#note-txt', el).focus();
  $('[data-act=save]', el).onclick = () => { store.setNote(key, $('#note-txt', el).value); toast('Nota salva'); close(); onSave && onSave(); };
  const del = $('[data-act=del]', el);
  if (del) del.onclick = () => { store.setNote(key, ''); toast('Nota apagada'); close(); onSave && onSave(); };
}

function openShareImage(text, ref) {
  let palette = 0;
  const { el, close } = openSheet(`
    <h3>Compartilhar imagem</h3>
    <img class="share-preview" id="share-img" alt="Pré-visualização">
    <div class="row" style="margin-top:12px">
      <button class="btn" data-act="pal">🎨 Outra cor</button>
      <span class="grow"></span>
      <button class="btn primary" data-act="go">${icon('share')} Compartilhar</button>
    </div>
    <p class="small muted" style="margin-top:8px">Se o compartilhamento não abrir, a imagem será baixada.</p>`);
  const render = () => { const c = makeVerseImage(text, ref, { palette, size: 720 }); $('#share-img', el).src = c.toDataURL('image/png'); };
  render();
  $('[data-act=pal]', el).onclick = () => { palette = (palette + 1) % 6; render(); };
  $('[data-act=go]', el).onclick = async () => { const c = makeVerseImage(text, ref, { palette, size: 1080 }); const r = await shareImage(c, ref, text); if (r === 'downloaded') toast('Imagem baixada'); if (r === 'shared') close(); };
}

async function openCompare(b, chapter, v1, v2) {
  const { el } = openSheet(`<h3>${esc(refLong(b.id, chapter, v1, v2))}</h3><div id="cmp"><div class="skel"></div><div class="skel"></div></div>`);
  const parts = [];
  for (const v of VERSIONS) {
    try {
      const vs = await getVerses(v.id, b.id, chapter, v1, v2);
      parts.push(`<div class="cmp-ver">${esc(v.name)}</div><div class="cmp-txt">${vs.map((x) => `<sup>${x.v}</sup> ${esc(x.t)}`).join(' ') || '<span class="muted">—</span>'}</div>`);
    } catch { parts.push(`<div class="cmp-ver">${esc(v.name)}</div><div class="muted small">Indisponível</div>`); }
  }
  $('#cmp', el).innerHTML = parts.join('');
}

// ---------- Seletor de livros / capítulos ----------
export function openBookPicker(curBook, curChapter) {
  const ver = store.settings.version;
  const { el, close } = openModal(`
    ${topbar({ title: 'Livros', back: true, right: `<button class="icon-btn" data-act="close" aria-label="Fechar">${icon('close')}</button>` })}
    <div class="section" style="padding-bottom:8px"><div class="search-box">${icon('search')}<input id="bk-q" placeholder="Livro ou referência (ex.: Jo 3,16)" autocomplete="off"></div></div>
    <div class="picker-tabs chips"><button class="chip on" data-t="">Todos</button><button class="chip" data-t="AT">Antigo Testamento</button><button class="chip" data-t="NT">Novo Testamento</button><span class="chip" style="opacity:.7">${esc(version(ver).short)}</span></div>
    <div id="bk-list"></div>`);
  $('[data-act=back]', el).onclick = close; $('[data-act=close]', el).onclick = close;
  let test = '';
  const render = (q = '') => {
    const nq = norm(q);
    const gs = groups(test || null).map((g) => {
      const bs = g.books.filter((b) => !nq || norm(b.name).includes(nq) || norm(b.abbr).includes(nq) || b.aliases.some((a) => norm(a).startsWith(nq)));
      if (!bs.length) return '';
      return `<div class="book-group"><h4>${esc(g.name)}${g.books[0].test === 'AT' && g.name === 'Pentateuco' ? ' · Antigo Testamento' : ''}</h4>
        ${bs.map((b) => `<button class="book-row ${b.id === curBook ? 'cur' : ''}" data-b="${b.id}"><span class="abbr">${esc(b.abbr)}</span><span>${esc(bookName(b, ver))}${b.deutero ? ' <span class="badge">DC</span>' : ''}</span><span class="cnt">${store.readCountBook(b.id) ? `${store.readCountBook(b.id)}/${b.chapters}` : `${b.chapters} cap.`}</span></button>`).join('')}</div>`;
    }).join('');
    $('#bk-list', el).innerHTML = gs || `<div class="empty">Nenhum livro encontrado</div>`;
    $$('.book-row', el).forEach((row) => row.onclick = () => showChapters(row.dataset.b));
  };
  const showChapters = (bid) => {
    const b = book(bid);
    $('#bk-list', el).innerHTML = `<div class="section" style="padding-bottom:4px"><div class="row between"><h3>${esc(bookName(b, ver))}${b.deutero ? ' <span class="badge">Deuterocanônico</span>' : ''}</h3><button class="btn sm" data-act="back2">${icon('chevL')} Livros</button></div>
      <p class="small muted" style="margin-top:4px">${esc(b.group)} · ${b.chapters} capítulo${b.chapters > 1 ? 's' : ''}</p></div>
      <div class="grid-ch">${Array.from({ length: b.chapters }, (_, i) => `<button data-c="${i + 1}" class="${b.id === curBook && i + 1 === curChapter ? 'cur' : ''} ${store.isRead(b.id, i + 1) ? 'read' : ''}">${i + 1}</button>`).join('')}</div>`;
    $('[data-act=back2]', el).onclick = () => render($('#bk-q', el).value);
    $$('.grid-ch button', el).forEach((btn) => btn.onclick = () => { close(); location.hash = `#/biblia/${bid}/${btn.dataset.c}`; });
    el.scrollTop = 0;
  };
  $$('.picker-tabs .chip', el).forEach((c) => c.onclick = () => { $$('.picker-tabs .chip', el).forEach((x) => x.classList.remove('on')); c.classList.add('on'); test = c.dataset.t; render($('#bk-q', el).value); });
  $('#bk-q', el).addEventListener('input', (e) => render(e.target.value));
  $('#bk-q', el).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const r = parseRef(e.target.value); if (r) { close(); location.hash = `#/biblia/${r.book}/${r.chapter}${r.verse ? '/' + r.verse : ''}`; } }
  });
  render();
  if (curBook) { const row = $(`.book-row[data-b="${curBook}"]`, el); if (row) row.scrollIntoView({ block: 'center' }); }
}

function openVersionPicker() {
  const cur = store.settings.version;
  const { el, close } = openSheet(`<h3>Versão</h3><div class="list">${VERSIONS.map((v) => `
    <button class="list-item" data-v="${v.id}"><div class="grow"><div class="title">${esc(v.name)} ${v.id === cur ? '✓' : ''}</div><div class="sub">${esc(v.desc)}</div></div></button>`).join('')}</div>`);
  $$('[data-v]', el).forEach((b) => b.onclick = () => { store.setSetting('version', b.dataset.v); close(); renderCurrent(); });
}
function renderCurrent() { const c = current; location.hash = `#/biblia/${c.book}/${c.chapter}`; window.dispatchEvent(new HashChangeEvent('hashchange')); }

export function openFontSheet() {
  const s = store.settings;
  const { el } = openSheet(`
    <h3>Aparência</h3>
    <div class="setting"><span>Tema</span><div class="seg" data-k="theme"><button data-v="auto" class="${s.theme === 'auto' ? 'on' : ''}">Auto</button><button data-v="light" class="${s.theme === 'light' ? 'on' : ''}">Claro</button><button data-v="sepia" class="${s.theme === 'sepia' ? 'on' : ''}">Sépia</button><button data-v="dark" class="${s.theme === 'dark' ? 'on' : ''}">Escuro</button></div></div>
    <div class="setting"><span>Tamanho do texto</span><div class="row"><button class="btn sm" data-act="minus">A−</button><b id="fs">${s.fontSize}</b><button class="btn sm" data-act="plus">A+</button></div></div>
    <div class="setting"><span>Fonte</span><div class="seg" data-k="fontFamily"><button data-v="serif" class="${s.fontFamily === 'serif' ? 'on' : ''}">Serifa</button><button data-v="sans" class="${s.fontFamily === 'sans' ? 'on' : ''}">Sem serifa</button></div></div>
    <div class="setting"><span>Espaçamento</span><div class="seg" data-k="lineHeight"><button data-v="1.45" class="${s.lineHeight == 1.45 ? 'on' : ''}">Compacto</button><button data-v="1.65" class="${s.lineHeight == 1.65 ? 'on' : ''}">Normal</button><button data-v="1.9" class="${s.lineHeight == 1.9 ? 'on' : ''}">Amplo</button></div></div>
    <div class="setting"><span>Números dos versículos</span><button class="switch ${s.showVerseNumbers ? 'on' : ''}" data-act="vn" aria-label="Mostrar números"></button></div>`);
  const apply = () => { applySettings(); const r = $('#chapter'); if (r) { r.classList.toggle('sans', store.settings.fontFamily === 'sans'); r.classList.toggle('hide-vn', !store.settings.showVerseNumbers); } };
  $('[data-act=minus]', el).onclick = () => { store.setSetting('fontSize', Math.max(13, s.fontSize - 1)); $('#fs', el).textContent = s.fontSize; apply(); };
  $('[data-act=plus]', el).onclick = () => { store.setSetting('fontSize', Math.min(32, s.fontSize + 1)); $('#fs', el).textContent = s.fontSize; apply(); };
  $$('.seg', el).forEach((seg) => $$('button', seg).forEach((btn) => btn.onclick = () => {
    $$('button', seg).forEach((x) => x.classList.remove('on')); btn.classList.add('on');
    const k = seg.dataset.k; const v = k === 'lineHeight' ? +btn.dataset.v : btn.dataset.v;
    store.setSetting(k, v); apply();
  }));
  $('[data-act=vn]', el).onclick = (e) => { store.setSetting('showVerseNumbers', !s.showVerseNumbers); e.currentTarget.classList.toggle('on', s.showVerseNumbers); apply(); };
}

// ---------- Áudio (leitura em voz alta, motor em audio.js) ----------
function ttsLang() { const l = version(store.settings.version).lang; return l === 'la' ? 'it-IT' : l; }
// ouvir a partir do versículo que está na tela (do início, se a página estiver no alto)
function toggleTTS(view) { if (audio.isActive()) stopTTS(); else { const cont = view && $('#chapter', view); startTTS(cont ? topVisibleVerse(view, cont) : 1).catch(() => {}); } }
function setTtsButton(on) { const btn = $('[data-act=tts]'); if (btn) { btn.innerHTML = on ? icon('stop') : icon('play'); btn.classList.toggle('active', on); } }
function clearSpeaking() { $$('#chapter .verse.speaking').forEach((x) => x.classList.remove('speaking')); }
function markChapterRead(bid, chapter) {
  if (store.isRead(bid, chapter)) return;
  store.markRead(bid, chapter, true);
  toast('Capítulo marcado como lido ✓');
  if (current.book === bid && current.chapter === chapter) {
    const f = $('#read-flag'); if (f) f.hidden = false;
    const d = $('[data-act=done]'); if (d) d.innerHTML = `${icon('check')} Lido · próximo capítulo`;
  }
}
// destaque do versículo e fim da leitura: usados ao começar e ao reatar a leitura em andamento
function ttsOnItem(i, it) {
  clearSpeaking();
  if (!it.v) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const p = $(`#v${it.v}`);
  if (p) { p.classList.add('speaking'); p.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
function ttsOnEnd(completed, ref) {
  clearSpeaking(); setTtsButton(false);
  if (completed) { const r = ref || current; markChapterRead(r.book, r.chapter); }
}
// a troca de capítulo é feita pelo motor de áudio (funciona com a tela desligada);
// a página acompanha quando estiver à frente
let pendingChapter = null;
function followAudio() {
  const r = pendingChapter;
  if (!r || document.visibilityState !== 'visible') return;
  if (!location.hash.startsWith('#/biblia/')) return;   // fora do leitor, não puxa a pessoa para lá
  pendingChapter = null;
  if (current.book === r.book && current.chapter === r.chapter) return;
  go(r.book, r.chapter);
}
window.addEventListener('bc:chapter', (e) => { pendingChapter = e.detail; followAudio(); });
document.addEventListener('visibilitychange', () => followAudio());

let noticedKey = '';
async function startTTS(fromVerse) {
  audio.unlock();   // ainda dentro do toque: no iPhone o áudio só inicia num gesto (antes de qualquer await)
  const b = book(current.book);
  const chapter = current.chapter;
  const domItems = $$('#chapter .verse:not(.empty-v)').map((p) => ({ v: +p.dataset.v, label: `Versículo ${p.dataset.v}`, text: p.textContent.replace(/^\d+\s*/, '') }));
  const head = b.id === 'sl' ? `Salmo ${chapter}` : `${bookName(b, store.settings.version)}, capítulo ${chapter}`;
  const introText = `${head}.${current.title ? ' ' + current.title : ''}`;
  const common = {
    title: `${bookName(b, store.settings.version)} ${chapter}`, lang: ttsLang(), ref: { book: b.id, chapter },
    onItem: ttsOnItem, onEnd: ttsOnEnd,
  };
  // narração gravada (voz neural) quando existir para este capítulo e na versão em português
  if (store.settings.recordedOn !== false && store.settings.version === 'figueiredo') {
    try {
      await audio.loadAudioManifest();
      // avisa uma vez por capítulo quando a voz gravada escolhida ainda não o tem (a leitura segue com a voz do celular)
      const notice = audio.recordedMissingNotice(b.id, chapter);
      if (notice && noticedKey !== `${b.id}.${chapter}`) { noticedKey = `${b.id}.${chapter}`; toast(notice, 5000); }
      if (audio.recordedAvailable(b.id, chapter)) {
        const rec = await audio.recordedChapter(b.id, chapter);
        if (rec && current.book === b.id && current.chapter === chapter) {
          const textOf = new Map(domItems.map((x) => [x.v, x.text]));
          const items = [{ kind: 'intro', label: 'Introdução', text: introText }, ...rec.marks.v.map(([v]) => ({ v, label: `Versículo ${v}`, text: textOf.get(v) || '' }))];
          const from = fromVerse <= 1 ? 0 : Math.max(0, items.findIndex((x) => x.v && x.v >= fromVerse));
          if (audio.play({ ...common, items, from, recorded: rec })) setTtsButton(true);
          return;
        }
      }
    } catch { /* usa as outras vozes */ }
  }
  const items = domItems.slice();
  const from = Math.max(0, items.findIndex((x) => x.v >= fromVerse));
  if (from === 0 && fromVerse <= 1 && store.settings.ttsStyle !== 'normal') items.unshift({ kind: 'intro', label: 'Introdução', text: introText });
  if (audio.play({ ...common, items, from })) setTtsButton(true);
}
export function stopTTS() { audio.stop(); }

// ---------- Busca ----------
export function renderSearch(view, { q = '' } = {}) {
  const ver = store.settings.version;
  view.innerHTML = `
    ${topbar({ title: 'Buscar', back: true })}
    <div class="section" style="padding-bottom:8px"><div class="search-box">${icon('search')}<input id="q" placeholder="Palavra, frase ou referência (Jo 3,16)" value="${esc(q)}" autocomplete="off" enterkeyhint="search"></div></div>
    <div class="section chips" style="padding-top:0;padding-bottom:8px"><button class="chip on" data-t="">Toda a Bíblia</button><button class="chip" data-t="AT">Antigo Testamento</button><button class="chip" data-t="NT">Novo Testamento</button><button class="chip" data-act="pickbook" id="bookchip">Um livro…</button><span class="chip" style="opacity:.7">${esc(version(ver).short)}</span></div>
    <div id="res"><div class="empty">${icon('search')}<div>Busque por palavras (ex.: <i>misericórdia</i>), frases entre aspas ("pão da vida") ou referências (Sl 22).</div></div></div>`;
  $('[data-act=back]', view).onclick = () => history.back();
  let test = '';
  let onlyBook = null;
  const input = $('#q', view);
  $('[data-act=pickbook]', view).onclick = () => {
    const { el, close } = openSheet(`<h3>Buscar em um livro</h3><div class="search-box" style="margin-bottom:10px">${icon('search')}<input id="bq" placeholder="Nome do livro" autocomplete="off"></div><div id="bl" class="list"></div>`);
    const renderList = (q = '') => {
      const nq = norm(q);
      const bs = books().filter((b) => !nq || norm(b.name).includes(nq) || norm(b.abbr).includes(nq));
      $('#bl', el).innerHTML = `<button class="list-item" data-b=""><div class="grow"><div class="title">Toda a Bíblia</div></div></button>` + bs.map((b) => `<button class="list-item" data-b="${b.id}"><div class="grow"><div class="title">${esc(b.name)}</div><div class="sub">${esc(b.group)}</div></div></button>`).join('');
      $$('[data-b]', el).forEach((btn) => btn.onclick = () => { onlyBook = btn.dataset.b || null; $('#bookchip', view).textContent = onlyBook ? book(onlyBook).name : 'Um livro…'; $('#bookchip', view).classList.toggle('on', !!onlyBook); close(); run(); });
    };
    renderList();
    $('#bq', el).addEventListener('input', (e) => renderList(e.target.value));
  };
  const run = async () => {
    const query = input.value.trim();
    const res = $('#res', view);
    if (!query) return;
    const ref = parseRef(query);
    let head = '';
    if (ref) head = `<div class="section"><a class="card row between" href="#/biblia/${ref.book}/${ref.chapter}${ref.verse ? '/' + ref.verse : ''}"><div><b>Ir para ${esc(refLong(ref.book, ref.chapter, ref.verse, ref.verseEnd))}</b><div class="small muted">Abrir no leitor</div></div>${icon('chevR')}</a></div>`;
    if (query.length < 2) { res.innerHTML = head; return; }
    res.innerHTML = head + `<div class="section"><div class="skel" style="width:60%"></div><div class="skel"></div><p class="small muted" id="prog">Preparando busca…</p></div>`;
    const idx = await ensureIndex(ver, (d, t) => { const p = $('#prog', view); if (p) p.textContent = `Carregando livros… ${d}/${t}`; });
    let { results, total, words } = search(idx, query, { testament: test || null, limit: onlyBook ? 5000 : 300 });
    if (onlyBook) { results = results.filter((r) => r.b === onlyBook); total = results.length; results = results.slice(0, 300); }
    if (!results.length) { res.innerHTML = head + `<div class="empty">Nenhum resultado para “${esc(query)}”</div>`; return; }
    res.innerHTML = head + `<p class="section small muted" style="padding-bottom:4px">${total} resultado${total > 1 ? 's' : ''}${total > results.length ? ` (mostrando ${results.length})` : ''}</p>` +
      results.map((r) => `<div class="result" data-b="${r.b}" data-c="${r.c}" data-v="${r.v}"><div class="ref">${esc(refString(r.b, r.c, r.v))}</div><div class="txt">${highlightText(r.t, words, esc)}</div></div>`).join('');
    $$('.result', res).forEach((el) => el.onclick = () => { location.hash = `#/biblia/${el.dataset.b}/${el.dataset.c}/${el.dataset.v}`; });
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); run(); } });
  $$('.chip[data-t]', view).forEach((c) => c.onclick = () => { $$('.chip[data-t]', view).forEach((x) => x.classList.remove('on')); c.classList.add('on'); test = c.dataset.t; run(); });
  if (q) run(); else setTimeout(() => input.focus(), 100);
}
