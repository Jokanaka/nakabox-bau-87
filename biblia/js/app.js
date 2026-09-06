// Bíblia Católica — aplicação principal (roteador, início, "mais", configurações)
import { $, $$, esc, icon, toast, fmtDate, todayISO, parseISO, copyText } from './util.js';
import { store, parseRefKey } from './store.js';
import { loadBooks, books, book, VERSIONS, version, refString, refLong, getVerses, verseOfTheDay, dataUrls, parseRef } from './data.js';
import { renderReader, renderSearch, applySettings, openBookPicker, openFontSheet, stopTTS } from './reader.js';
import { openAudioSheet } from './audio.js';
import { renderMissa } from './missa.js';
import { renderPlans, renderPlanDetail, renderPrayers, renderPrayer, renderRosary, renderLiturgy } from './features.js';
import { PLANS, planDays, nextDay, planProgress } from './plans.js';
import { liturgicalDay, readingsFor } from './liturgy.js';
import { MYSTERIES, mysteryOfDay } from './rosary.js';
import { openSheet, topbar, closeAll, confirm } from './ui.js';
import { makeVerseImage, shareImage } from './share.js';

const view = document.getElementById('view');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

// ---------- Roteador ----------
function parseHash() {
  const raw = (location.hash || '#/inicio').slice(1);
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) queryPart.split('&').forEach((kv) => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return { parts, query };
}

async function route() {
  closeAll();
  stopTTS();
  const { parts, query } = parseHash();
  const tab = parts[0] || 'inicio';
  $$('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (['biblia', 'busca'].includes(tab) ? 'biblia' : ['oracoes', 'rosario'].includes(tab) ? 'oracoes' : tab)));
  view.className = 'view';
  try {
    switch (tab) {
      case 'inicio': return renderHome(view);
      case 'biblia': {
        const last = store.last;
        const bid = parts[1] || last.book;
        const chapter = +(parts[2] || (parts[1] ? 1 : last.chapter));
        let verse = null, verseEnd = null;
        if (parts[3]) { const m = parts[3].match(/^(\d+)(?:-(\d+))?/); if (m) { verse = +m[1]; verseEnd = m[2] ? +m[2] : null; } }
        return renderReader(view, { book: bid, chapter, verse, verseEnd, plan: query.plan, day: query.day });
      }
      case 'busca': return renderSearch(view, { q: query.q || '' });
      case 'planos': return parts[1] ? renderPlanDetail(view, parts[1]) : renderPlans(view);
      case 'oracoes': return parts[1] ? renderPrayer(view, parts[1]) : renderPrayers(view);
      case 'rosario': return renderRosary(view);
      case 'liturgia': return renderLiturgy(view, parts[1]);
      case 'missa': return renderMissa(view, parts[1]);
      case 'mais': return renderMore(view, parts[1]);
      default: location.hash = '#/inicio';
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `${topbar({ title: 'Erro' })}<div class="empty">Algo deu errado ao abrir esta tela.<br><span class="small">${esc(e.message)}</span><br><br><a class="btn" href="#/inicio">Voltar ao início</a></div>`;
  }
}

// ---------- Início ----------
async function renderHome(v) {
  const now = new Date();
  const lit = liturgicalDay(now);
  const hour = now.getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const [bid, ch, v1, v2] = verseOfTheDay(todayISO(now));
  const last = store.last;
  const lb = book(last.book);
  const streak = store.streak;
  const mine = PLANS.filter((p) => store.plan(p.id) && nextDay(p.id, store.plan(p.id)) >= 0);
  const myst = MYSTERIES[mysteryOfDay(now, lit.season === 'triduo' ? 'quaresma' : lit.season)];
  const prog = readProgress();
  v.innerHTML = `
    <div class="hero">
      <div class="date">${esc(cap(fmtDate(now)))}</div>
      <h1>${greet}! ✝</h1>
      <a class="lit" href="#/liturgia"><span class="lit-dot" style="background:${lit.colorHex}"></span>${esc(lit.name)} · Ano ${lit.cycle}</a>
      ${lit.memorial ? `<div class="small muted" style="margin-top:2px">🕯️ ${esc(lit.memorial.n)}</div>` : ''}
    </div>
    <div class="section">
      <div class="card accent" id="votd">
        <div class="small" style="opacity:.85">Versículo do dia</div>
        <div class="votd"><span class="skel" style="display:block;background:rgba(255,255,255,.2)"></span></div>
        <div class="votd-ref">${esc(refString(bid, ch, v1, v2))}</div>
        <div class="row" style="margin-top:12px">
          <a class="btn sm" style="background:rgba(255,255,255,.15);color:#fff;border-color:transparent" href="#/biblia/${bid}/${ch}/${v1}">${icon('book')} Ler</a>
          <button class="btn sm" style="background:rgba(255,255,255,.15);color:#fff;border-color:transparent" data-act="share-votd">${icon('share')} Compartilhar</button>
        </div>
      </div>
    </div>
    <div class="section" style="padding-top:0"><div class="quick">
      <a href="#/biblia">${icon('book')}<span>Bíblia</span></a>
      <a href="#/rosario">${icon('rosary')}<span>Rosário</span></a>
      <a href="#/liturgia">${icon('cal')}<span>Liturgia</span></a>
      <a href="#/busca">${icon('search')}<span>Buscar</span></a>
    </div></div>
    <div class="section" style="padding-top:0"><div class="stack">
      ${lb ? `<a class="card row" href="#/biblia/${last.book}/${last.chapter}"><div class="ico">${icon('history')}</div><div class="grow"><div class="small muted">Continuar lendo</div><b>${esc(lb.name)} ${last.chapter}</b></div>${icon('chevR')}</a>` : ''}
      ${mine.map((p) => { const st = store.plan(p.id); const nd = nextDay(p.id, st); const d = planDays(p.id)[nd]; const pr = planProgress(p.id, st); return `<a class="card row" href="#/biblia/${d[0].book}/${d[0].chapter}?plan=${p.id}&day=${nd}"><div class="plan-cover" style="background:${p.color};width:44px;height:44px;font-size:20px">${p.emoji}</div><div class="grow"><div class="small muted">${esc(p.name)} · dia ${nd + 1} de ${pr.total}</div><b>${esc(d.map((r) => refString(r.book, r.chapter)).join(' · '))}</b><div class="progress" style="margin-top:6px"><i style="width:${pr.pct}%"></i></div></div>${icon('chevR')}</a>`; }).join('')}
      <div class="card" id="home-readings"><div class="small muted">Leituras da Missa de hoje</div><div class="skel" style="width:60%"></div></div>
      <a class="card row" href="#/missa"><div class="plan-cover" style="background:var(--accent);width:44px;height:44px;font-size:20px">🕊</div><div class="grow"><div class="small muted">Modo Missa</div><b>Siga a Missa passo a passo, com as leituras de hoje</b></div>${icon('chevR')}</a>
      <a class="card row" href="#/rosario"><div class="plan-cover" style="background:${myst.color};width:44px;height:44px;font-size:20px">📿</div><div class="grow"><div class="small muted">Rosário de hoje</div><b>${esc(myst.name)}</b></div>${icon('chevR')}</a>
      <div class="card streak"><div class="num">${streak.count}</div><div class="grow"><b>${streak.count === 1 ? 'dia seguido' : 'dias seguidos'} com a Palavra</b><div class="small muted">${streak.today ? 'Você já leu hoje. Continue assim!' : 'Leia um capítulo hoje para manter a sequência.'}</div></div>${icon('flame')}</div>
      <a class="card row" href="#/mais/progresso"><div class="ico">${icon('check')}</div><div class="grow"><div class="small muted">Progresso de leitura</div><b>${prog.read} de ${prog.total} capítulos · ${prog.pct}%</b><div class="progress" style="margin-top:6px"><i style="width:${prog.pct}%"></i></div></div>${icon('chevR')}</a>
    </div></div>`;
  // versículo do dia
  try {
    const vs = await getVerses(store.settings.version, bid, ch, v1, v2);
    const text = vs.map((x) => x.t).join(' ');
    $('#votd .votd', v).textContent = text;
    $('[data-act=share-votd]', v).onclick = async () => { const c = makeVerseImage(text, refString(bid, ch, v1, v2), { palette: now.getDate() % 6 }); const r = await shareImage(c, refString(bid, ch, v1, v2), text); if (r === 'downloaded') toast('Imagem baixada'); };
  } catch { $('#votd .votd', v).textContent = '—'; }
  // leituras
  try {
    const { readings } = await readingsFor(now);
    const box = $('#home-readings', v);
    if (readings) {
      const items = [['first', '1ª Leitura'], ['psalm', 'Salmo'], ['second', '2ª Leitura'], ['gospel', 'Evangelho']].filter(([k]) => readings[k]);
      box.innerHTML = `<div class="small muted">Leituras da Missa de hoje</div>${items.map(([k, l]) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="small muted">${l}</span><a href="${readings[k].b ? `#/biblia/${readings[k].b}/${readings[k].c}${readings[k].v1 ? '/' + readings[k].v1 : ''}` : '#/liturgia'}"><b>${esc(readings[k].disp || readings[k].raw)}</b></a></div>`).join('')}<a class="small" href="#/liturgia" style="display:block;margin-top:8px">Ver liturgia completa ${icon('chevR')}</a>`;
    } else box.innerHTML = `<div class="small muted">Leituras da Missa de hoje</div><p class="small" style="margin-top:6px">Leituras não disponíveis na base local. <a href="#/liturgia">Abrir liturgia</a></p>`;
  } catch { /* ignore */ }
}

// ---------- Mais ----------
function renderMore(v, sub) {
  if (sub === 'destaques') return renderHighlights(v);
  if (sub === 'notas') return renderNotes(v);
  if (sub === 'favoritos') return renderBookmarks(v);
  if (sub === 'historico') return renderHistory(v);
  if (sub === 'config') return renderSettings(v);
  if (sub === 'sobre') return renderAbout(v);
  if (sub === 'dados') return renderData(v);
  if (sub === 'progresso') return renderProgress(v);
  const hl = Object.keys(store.allHighlights()).length, nt = Object.keys(store.allNotes()).length, bm = Object.keys(store.allBookmarks()).length;
  const item = (href, ic, title, sub) => `<a class="list-item" href="${href}"><div class="ico">${icon(ic)}</div><div class="grow"><div class="title">${title}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="chev">${icon('chevR')}</span></a>`;
  v.innerHTML = `${topbar({ title: 'Mais' })}
    <div class="section"><div class="section-title">Minha Bíblia</div><div class="list">
      ${item('#/mais/destaques', 'highlight', 'Destaques', `${hl} versículo${hl === 1 ? '' : 's'}`)}
      ${item('#/mais/notas', 'note', 'Notas', `${nt} nota${nt === 1 ? '' : 's'}`)}
      ${item('#/mais/favoritos', 'bookmark', 'Favoritos', `${bm} versículo${bm === 1 ? '' : 's'}`)}
      ${item('#/mais/historico', 'history', 'Histórico de leitura', '')}
      ${item('#/mais/progresso', 'check', 'Progresso de leitura', `${readProgress().pct}% da Bíblia`)}
    </div></div>
    <div class="section"><div class="section-title">Aplicativo</div><div class="list">
      ${item('#/mais/config', 'settings', 'Configurações', 'Tema, fonte, versão padrão')}
      ${item('#/mais/dados', 'download', 'Uso offline e backup', 'Baixar toda a Bíblia, exportar dados')}
      ${item('#/mais/sobre', 'info', 'Sobre este app', 'Fontes dos textos e licenças')}
    </div></div>
    <div class="section" id="install-box"></div>`;
  const box = $('#install-box', v);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!standalone) {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    box.innerHTML = `<div class="card gold"><h3>📲 Instalar no celular</h3><p class="small muted" style="margin:6px 0 10px">${isIOS ? 'No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.' : 'Adicione o app à tela inicial para abrir como um aplicativo e usar sem internet.'}</p>${deferredInstall ? `<button class="btn primary" data-act="install">Instalar agora</button>` : ''}</div>`;
    const b = $('[data-act=install]', v); if (b) b.onclick = async () => { deferredInstall.prompt(); const r = await deferredInstall.userChoice; if (r.outcome === 'accepted') toast('App instalado!'); deferredInstall = null; };
  }
}

function groupByBook(keys) {
  const groups = new Map();
  keys.forEach((k) => { const r = parseRefKey(k); if (!groups.has(r.book)) groups.set(r.book, []); groups.get(r.book).push(r); });
  return [...groups.entries()].sort((a, b) => (book(a[0])?.index ?? 99) - (book(b[0])?.index ?? 99)).map(([bid, rs]) => [bid, rs.sort((x, y) => x.chapter - y.chapter || x.verse - y.verse)]);
}
async function verseLine(r, extra = '') {
  let t = '';
  try { const vs = await getVerses(store.settings.version, r.book, r.chapter, r.verse); t = vs[0] ? vs[0].t : ''; } catch { /* */ }
  return `<a class="result" href="#/biblia/${r.book}/${r.chapter}/${r.verse}"><div class="ref">${esc(refString(r.book, r.chapter, r.verse))} ${extra}</div><div class="txt">${esc(t)}</div></a>`;
}
async function renderList(v, title, keys, extra) {
  v.innerHTML = `${topbar({ title, back: true })}<div id="lst">${keys.length ? '<div class="skel" style="margin:20px"></div>' : `<div class="empty">${icon('book')}<div>Nada aqui ainda. Toque em um versículo no leitor para destacar, anotar ou salvar.</div></div>`}</div>`;
  $('[data-act=back]', v).onclick = () => history.back();
  if (!keys.length) return;
  const parts = [];
  for (const [bid, rs] of groupByBook(keys)) {
    parts.push(`<div class="section-title" style="padding:14px 16px 4px">${esc(book(bid)?.name || bid)}</div>`);
    for (const r of rs) parts.push(await verseLine(r, extra ? extra(r) : ''));
  }
  $('#lst', v).innerHTML = parts.join('');
}
function renderHighlights(v) { const hl = store.allHighlights(); return renderList(v, 'Destaques', Object.keys(hl), (r) => `<span class="badge" style="background:var(--hl-${hl[`${r.book}.${r.chapter}.${r.verse}`]})">&nbsp;&nbsp;</span>`); }
function renderBookmarks(v) { return renderList(v, 'Favoritos', Object.keys(store.allBookmarks()).sort((a, b) => store.allBookmarks()[b] - store.allBookmarks()[a])); }
async function renderNotes(v) {
  const notes = store.allNotes();
  const keys = Object.keys(notes).sort((a, b) => notes[b].at - notes[a].at);
  v.innerHTML = `${topbar({ title: 'Notas', back: true })}<div id="lst">${keys.length ? '' : `<div class="empty">${icon('note')}<div>Você ainda não escreveu notas.</div></div>`}</div>`;
  $('[data-act=back]', v).onclick = () => history.back();
  const parts = [];
  for (const k of keys) {
    const r = parseRefKey(k);
    let t = '';
    try { const vs = await getVerses(store.settings.version, r.book, r.chapter, r.verse); t = vs[0] ? vs[0].t : ''; } catch { /* */ }
    parts.push(`<a class="result" href="#/biblia/${r.book}/${r.chapter}/${r.verse}"><div class="ref">${esc(refString(r.book, r.chapter, r.verse))} · <span class="muted">${esc(new Date(notes[k].at).toLocaleDateString('pt-BR'))}</span></div><div class="txt small muted" style="font-family:var(--font-ui)">${esc(t.slice(0, 120))}${t.length > 120 ? '…' : ''}</div><div style="margin-top:6px;white-space:pre-line">${esc(notes[k].text)}</div></a>`);
  }
  $('#lst', v).innerHTML = parts.join('');
}
function renderHistory(v) {
  const h = store.history;
  v.innerHTML = `${topbar({ title: 'Histórico', back: true })}${h.length ? `<div class="list" style="margin:16px">${h.map((x) => `<a class="list-item" href="#/biblia/${x.book}/${x.chapter}"><div class="ico">${icon('book')}</div><div class="grow"><div class="title">${esc(book(x.book)?.name || x.book)} ${x.chapter}</div><div class="sub">${esc(new Date(x.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}</div></div><span class="chev">${icon('chevR')}</span></a>`).join('')}</div>` : `<div class="empty">${icon('history')}<div>Nenhuma leitura registrada ainda.</div></div>`}`;
  $('[data-act=back]', v).onclick = () => history.back();
}

function renderSettings(v) {
  const s = store.settings;
  v.innerHTML = `${topbar({ title: 'Configurações', back: true })}
    <div class="section"><div class="card">
      <div class="setting"><span>Modo do app</span><div class="seg" data-k="uiMode"><button data-v="simples" class="${s.uiMode !== 'avancado' ? 'on' : ''}">Simples</button><button data-v="avancado" class="${s.uiMode === 'avancado' ? 'on' : ''}">Avançado</button></div></div>
      <p class="small muted" style="margin:-4px 0 10px">Simples: só o essencial, com a narração gravada, velocidade e temporizador. Avançado: todas as opções, inclusive vozes do aparelho, narrador offline e na nuvem, e as versões em latim e inglês.</p>
      <div class="setting"><span>Tema</span><div class="seg" data-k="theme"><button data-v="auto" class="${s.theme === 'auto' ? 'on' : ''}">Auto</button><button data-v="light" class="${s.theme === 'light' ? 'on' : ''}">Claro</button><button data-v="sepia" class="${s.theme === 'sepia' ? 'on' : ''}">Sépia</button><button data-v="dark" class="${s.theme === 'dark' ? 'on' : ''}">Escuro</button></div></div>
      <div class="setting"><span>Fonte da leitura</span><div class="seg" data-k="fontFamily"><button data-v="serif" class="${s.fontFamily === 'serif' ? 'on' : ''}">Serifa</button><button data-v="sans" class="${s.fontFamily === 'sans' ? 'on' : ''}">Sem serifa</button></div></div>
      <div class="setting"><span>Tamanho do texto</span><div class="row"><button class="btn sm" data-act="minus">A−</button><b id="fs">${s.fontSize}</b><button class="btn sm" data-act="plus">A+</button></div></div>
      <div class="setting"><span>Números dos versículos</span><button class="switch ${s.showVerseNumbers ? 'on' : ''}" data-act="vn"></button></div>
      <div class="setting"><span>Leitura em voz alta</span><button class="btn sm" data-act="audio">Voz, velocidade e temporizador</button></div>
    </div></div>
    ${s.uiMode === 'avancado' ? `<div class="section" style="padding-top:0"><div class="section-title">Versão padrão</div><div class="list">${VERSIONS.map((ver) => `<button class="list-item" data-ver="${ver.id}"><div class="grow"><div class="title">${esc(ver.name)} ${ver.id === s.version ? '✓' : ''}</div><div class="sub">${esc(ver.desc)}</div></div></button>`).join('')}</div></div>` : ''}`;
  $('[data-act=back]', v).onclick = () => history.back();
  $$('[data-k=uiMode] button', v).forEach((b) => b.addEventListener('click', () => setTimeout(() => renderSettings(v), 0)));
  $$('.seg', v).forEach((seg) => $$('button', seg).forEach((btn) => btn.onclick = () => { $$('button', seg).forEach((x) => x.classList.remove('on')); btn.classList.add('on'); const k = seg.dataset.k; store.setSetting(k, k === 'ttsRate' ? +btn.dataset.v : btn.dataset.v); applySettings(); }));
  $('[data-act=minus]', v).onclick = () => { store.setSetting('fontSize', Math.max(13, s.fontSize - 1)); $('#fs', v).textContent = s.fontSize; applySettings(); };
  $('[data-act=plus]', v).onclick = () => { store.setSetting('fontSize', Math.min(32, s.fontSize + 1)); $('#fs', v).textContent = s.fontSize; applySettings(); };
  $('[data-act=vn]', v).onclick = (e) => { store.setSetting('showVerseNumbers', !s.showVerseNumbers); e.currentTarget.classList.toggle('on', s.showVerseNumbers); };
  $('[data-act=audio]', v).onclick = () => openAudioSheet();
  $$('[data-ver]', v).forEach((b) => b.onclick = () => { store.setSetting('version', b.dataset.ver); renderSettings(v); });
}

function renderData(v) {
  v.innerHTML = `${topbar({ title: 'Uso offline e backup', back: true })}
    <div class="section"><div class="card">
      <h3>📥 Baixar toda a Bíblia</h3>
      <p class="small muted" style="margin:6px 0 12px">Guarda as três versões no dispositivo (cerca de 15 MB) para leitura e busca sem internet.</p>
      <div class="progress" id="dl-prog" hidden><i style="width:0%"></i></div>
      <button class="btn primary" data-act="dl" style="margin-top:10px">${icon('download')} Baixar agora</button>
      <span class="small muted" id="dl-status" style="margin-left:10px"></span>
    </div></div>
    <div class="section" style="padding-top:0"><div class="card">
      <h3>💾 Backup dos seus dados</h3>
      <p class="small muted" style="margin:6px 0 12px">Destaques, notas, favoritos, planos e configurações ficam apenas neste aparelho. Exporte um arquivo para guardar ou levar para outro celular.</p>
      <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="export">${icon('export')} Exportar</button><button class="btn" data-act="import">${icon('download')} Importar</button><input type="file" id="imp-file" accept="application/json" hidden></div>
    </div></div>
    <div class="section" style="padding-top:0"><div class="card"><h3>🧹 Apagar dados</h3><p class="small muted" style="margin:6px 0 12px">Remove destaques, notas, favoritos e progresso dos planos deste aparelho.</p><button class="btn danger" data-act="reset">${icon('trash')} Apagar tudo</button></div></div>`;
  $('[data-act=back]', v).onclick = () => history.back();
  $('[data-act=dl]', v).onclick = async () => {
    const st = $('#dl-status', v), pr = $('#dl-prog', v);
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
      // sem service worker: baixa via fetch para o cache do navegador
      st.textContent = 'Baixando…'; pr.hidden = false;
      const urls = dataUrls(); let done = 0;
      for (const u of urls) { try { await fetch(u); } catch { /* */ } done++; pr.firstElementChild.style.width = Math.round(done * 100 / urls.length) + '%'; }
      st.textContent = 'Concluído'; return;
    }
    st.textContent = 'Baixando…'; pr.hidden = false;
    navigator.serviceWorker.controller.postMessage({ type: 'CACHE_ALL', urls: dataUrls() });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data.type === 'CACHE_PROGRESS') pr.firstElementChild.style.width = Math.round(e.data.done * 100 / e.data.total) + '%';
      if (e.data.type === 'CACHE_DONE') { st.textContent = 'Concluído ✓'; toast('Bíblia disponível offline'); }
    });
  };
  $('[data-act=export]', v).onclick = () => {
    const blob = new Blob([store.export()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `biblia-catolica-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Backup exportado');
  };
  $('[data-act=import]', v).onclick = () => $('#imp-file', v).click();
  $('#imp-file', v).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { store.import(await f.text()); applySettings(); toast('Dados importados'); } catch (err) { toast('Arquivo inválido'); }
  };
  $('[data-act=reset]', v).onclick = async () => { if (await confirm('Apagar todos os seus dados deste aparelho?', { ok: 'Apagar', danger: true })) { store.reset(); applySettings(); toast('Dados apagados'); } };
}

function renderAbout(v) {
  const nb = books().length;
  v.innerHTML = `${topbar({ title: 'Sobre', back: true })}
    <div class="section"><div class="card">
      <div class="row"><img src="icons/icon-192.png" width="56" height="56" style="border-radius:14px" alt=""><div><h3>Bíblia Católica</h3><div class="small muted">Versão 1.0 · ${nb} livros · Católica Apostólica Romana</div></div></div>
      <p style="margin-top:12px">Bíblia completa com os 73 livros do cânon católico, incluindo os deuterocanônicos (Tobias, Judite, Sabedoria, Eclesiástico, Baruc, 1 e 2 Macabeus e as partes gregas de Ester e Daniel), com planos de leitura, orações, Santo Rosário e liturgia diária. Funciona sem internet depois de instalado.</p>
    </div></div>
    <div class="section" style="padding-top:0"><div class="card">
      <h3>Textos e fontes</h3>
      <p class="small" style="margin-top:8px"><b>Bíblia Sagrada — Pe. Antônio Pereira de Figueiredo.</b> Tradução católica da Vulgata Latina (1778–1790), aqui na edição brasileira de 1950, com a ortografia atualizada para a norma atual. Cerca de 40% dos capítulos vêm da transcrição revisada do projeto <a href="https://bibliatraduzida.com" target="_blank" rel="noopener">bibliatraduzida.com</a>; os demais foram extraídos por reconhecimento óptico (OCR) dos volumes digitalizados no <a href="https://archive.org" target="_blank" rel="noopener">Internet Archive</a> e podem conter pequenos erros, sinalizados no leitor. A tradução é de domínio público.</p>
      <p class="small" style="margin-top:8px"><b>Vulgata Clementina.</b> Texto latino de domínio público.</p>
      <p class="small" style="margin-top:8px"><b>Douay-Rheims (Challoner).</b> Tradução católica inglesa de domínio público.</p>
      <p class="small" style="margin-top:8px"><b>Leituras da Missa.</b> Referências do Lecionário Romano compiladas a partir do projeto aberto <a href="https://github.com/cpbjr/catholic-readings-api" target="_blank" rel="noopener">catholic-readings-api</a> (MIT), adaptadas ao calendário do Brasil. A numeração dos Salmos segue a Vulgata.</p>
      <p class="small" style="margin-top:8px"><b>Orações.</b> Textos tradicionais de domínio público, na forma usual no Brasil.</p>
      <p class="small muted" style="margin-top:12px">Este aplicativo não tem fins lucrativos e não coleta dados pessoais: tudo fica guardado no seu aparelho.</p>
    </div></div>`;
  $('[data-act=back]', v).onclick = () => history.back();
}

// ---------- Progresso de leitura ----------
function readProgress() {
  let total = 0, read = 0;
  const byBook = [];
  for (const b of books()) { const n = store.readCountBook(b.id); total += b.chapters; read += n; byBook.push({ b, n }); }
  return { total, read, pct: total ? Math.round(read * 1000 / total) / 10 : 0, byBook };
}
function renderProgress(v) {
  const p = readProgress();
  const part = (t) => { const bs = p.byBook.filter((x) => x.b.test === t); const tot = bs.reduce((a, x) => a + x.b.chapters, 0); const rd = bs.reduce((a, x) => a + x.n, 0); return { tot, rd, pct: tot ? Math.round(rd * 100 / tot) : 0 }; };
  const at = part('AT'), nt = part('NT');
  v.innerHTML = `${topbar({ title: 'Progresso de leitura', back: true })}
    <div class="section"><div class="card">
      <div class="small muted">Capítulos lidos</div><h2 style="margin:4px 0">${p.read} de ${p.total} · ${p.pct}%</h2>
      <div class="progress" style="margin-top:8px"><i style="width:${p.pct}%"></i></div>
      <div class="row" style="margin-top:14px;gap:16px">
        <div class="grow"><div class="small muted">Antigo Testamento</div><b>${at.rd}/${at.tot} · ${at.pct}%</b><div class="progress" style="margin-top:4px"><i style="width:${at.pct}%"></i></div></div>
        <div class="grow"><div class="small muted">Novo Testamento</div><b>${nt.rd}/${nt.tot} · ${nt.pct}%</b><div class="progress" style="margin-top:4px"><i style="width:${nt.pct}%"></i></div></div>
      </div>
      <p class="small muted" style="margin-top:10px">Um capítulo é marcado como lido quando você chega ao fim dele ou termina de ouvi-lo. Também dá para tocar em "Concluir capítulo".</p>
    </div></div>
    <div class="section" style="padding-top:0"><div class="section-title">Por livro</div><div class="list progress-list">${p.byBook.map(({ b, n }) => `<a class="list-item" href="#/biblia/${b.id}/${Math.min(b.chapters, n + 1)}"><div class="grow"><div class="row between"><div class="title">${esc(b.name)}</div><span class="small ${n === b.chapters ? 'done' : 'muted'}">${n === b.chapters ? '✓ completo' : `${n}/${b.chapters}`}</span></div><div class="bar" style="margin-top:6px"><i style="width:${Math.round(n * 100 / b.chapters)}%"></i></div></div></a>`).join('')}</div></div>`;
  $('[data-act=back]', v).onclick = () => history.back();
}

// ---------- Inicialização ----------
async function boot() {
  applySettings();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
  try { await loadBooks(); }
  catch (e) { view.innerHTML = `<div class="empty">Não foi possível carregar o catálogo de livros.<br><button class="btn" onclick="location.reload()">Tentar de novo</button></div>`; return; }
  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = '#/inicio';
  route();
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW', e); }
  }
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
}
boot();
