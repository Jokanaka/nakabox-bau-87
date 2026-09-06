// Telas: planos de leitura, orações, rosário, liturgia
import { $, $$, esc, icon, toast, copyText, fmtDate, todayISO, parseISO, addDays, norm } from './util.js';
import { store } from './store.js';
import { book, refString, refLong, getVerses, version } from './data.js';
import { openSheet, openModal, topbar, confirm } from './ui.js';
import { PLANS, plan as getPlan, planDays, planProgress, nextDay } from './plans.js';
import { PRAYERS, PRAYER_GROUPS, prayer as getPrayer, prayersByGroup } from './prayers.js';
import { MYSTERIES, mysteryOfDay, rosarySteps, chapletSteps } from './rosary.js';
import { liturgicalDay, readingsFor, upcoming, SEASON_KEYS } from './liturgy.js';
import { shareText } from './share.js';
import * as audio from './audio.js';

// ---------- Planos ----------
export function renderPlans(view) {
  const mine = PLANS.filter((p) => store.plan(p.id));
  const others = PLANS.filter((p) => !store.plan(p.id));
  const card = (p) => {
    const st = store.plan(p.id);
    const pr = planProgress(p.id, st);
    return `<a class="card plan-card" href="#/planos/${p.id}">
      <div class="plan-cover" style="background:${p.color}">${p.emoji}</div>
      <div class="grow"><h3>${esc(p.name)}</h3><div class="small muted">${p.days} dias${st ? ` · ${pr.done}/${pr.total} concluídos` : ''}</div>
      ${st ? `<div class="progress" style="margin-top:8px"><i style="width:${pr.pct}%"></i></div>` : `<div class="small muted" style="margin-top:4px">${esc(p.desc)}</div>`}</div>
      <span class="chev">${icon('chevR')}</span></a>`;
  };
  view.innerHTML = `${topbar({ title: 'Planos de leitura' })}
    ${mine.length ? `<div class="section"><div class="section-title">Meus planos</div><div class="stack">${mine.map(card).join('')}</div></div>` : ''}
    <div class="section"><div class="section-title">${mine.length ? 'Outros planos' : 'Escolha um plano'}</div><div class="stack">${others.map(card).join('')}</div></div>`;
}

export function renderPlanDetail(view, id) {
  const p = getPlan(id);
  if (!p) { view.innerHTML = `${topbar({ title: 'Plano', back: true })}<div class="empty">Plano não encontrado</div>`; $('[data-act=back]', view).onclick = () => history.back(); return; }
  const days = planDays(id);
  const st = store.plan(id);
  const pr = planProgress(id, st);
  const nd = nextDay(id, st);
  const refs = (day) => day.map((r) => refString(r.book, r.chapter)).join(' · ');
  view.innerHTML = `${topbar({ title: p.name, back: true })}
    <div class="section">
      <div class="card" style="border-top:6px solid ${p.color}">
        <div class="row"><div class="plan-cover" style="background:${p.color}">${p.emoji}</div><div class="grow"><h3>${esc(p.name)}</h3><div class="small muted">${p.days} dias · ${days.reduce((a, d) => a + d.length, 0)} capítulos</div></div></div>
        <p class="muted" style="margin:12px 0">${esc(p.desc)}</p>
        ${st ? `<div class="progress"><i style="width:${pr.pct}%"></i></div><div class="small muted" style="margin-top:6px">${pr.done} de ${pr.total} dias concluídos (${pr.pct}%) · iniciado em ${esc(st.started.split('-').reverse().join('/'))}</div>` : ''}
        <div class="row" style="margin-top:14px;flex-wrap:wrap">
          ${!st ? `<button class="btn primary grow" data-act="start">${icon('play')} Começar plano</button>` :
            (nd >= 0 ? `<button class="btn primary grow" data-act="today">${icon('book')} Ler o dia ${nd + 1}</button>` : `<span class="badge accent">Plano concluído 🎉</span>`)}
          ${st ? `<button class="btn danger" data-act="stop">Sair</button>` : ''}
        </div>
      </div>
    </div>
    <div class="list" style="margin:0 16px 16px">
      ${days.map((d, i) => `<div class="plan-day ${st && st.done[i] ? 'done' : ''}" data-i="${i}">
        <button class="check ${st && st.done[i] ? 'on' : ''}" data-chk="${i}" aria-label="Concluir dia">${icon('check')}</button>
        <div class="grow"><div><b>Dia ${i + 1}</b>${i === nd ? ' <span class="badge accent">hoje</span>' : ''}</div><div class="small muted">${esc(refs(d))}</div></div>
        <a class="icon-btn" href="#/biblia/${d[0].book}/${d[0].chapter}?plan=${id}&day=${i}" aria-label="Ler">${icon('chevR')}</a>
      </div>`).join('')}
    </div>`;
  $('[data-act=back]', view).onclick = () => history.back();
  const start = $('[data-act=start]', view); if (start) start.onclick = () => { store.startPlan(id); toast('Plano iniciado!'); renderPlanDetail(view, id); };
  const today = $('[data-act=today]', view); if (today) today.onclick = () => { const d = days[nd]; location.hash = `#/biblia/${d[0].book}/${d[0].chapter}?plan=${id}&day=${nd}`; };
  const stop = $('[data-act=stop]', view); if (stop) stop.onclick = async () => { if (await confirm('Sair deste plano? O progresso será apagado.', { ok: 'Sair', danger: true })) { store.stopPlan(id); renderPlanDetail(view, id); } };
  $$('[data-chk]', view).forEach((b) => b.onclick = () => {
    if (!store.plan(id)) store.startPlan(id);
    const i = +b.dataset.chk; const on = !(store.plan(id).done[i]);
    store.setPlanDay(id, i, on); renderPlanDetail(view, id);
  });
  if (st && nd > 3) { const row = $(`.plan-day[data-i="${nd}"]`, view); if (row) setTimeout(() => row.scrollIntoView({ block: 'center' }), 50); }
}

// ---------- Orações ----------
export function renderPrayers(view) {
  const favs = PRAYERS.filter((p) => store.isFavPrayer(p.id));
  const item = (p) => `<a class="list-item" href="#/oracoes/${p.id}"><div class="ico">${icon('pray')}</div><div class="grow"><div class="title">${esc(p.name)}</div>${p.ref ? `<div class="sub">${esc(p.ref)}</div>` : ''}</div><span class="chev">${icon('chevR')}</span></a>`;
  view.innerHTML = `${topbar({ title: 'Orações' })}
    <div class="section" style="padding-bottom:0"><div class="search-box">${icon('search')}<input id="pq" placeholder="Buscar oração" autocomplete="off"></div></div>
    <div class="section"><a class="card accent row between" href="#/rosario"><div><h3>📿 Santo Rosário</h3><div class="muted">Mistérios de hoje e terço guiado</div></div>${icon('chevR')}</a></div>
    <div class="section" style="padding-top:0"><a class="card row between" href="#/missa"><div><h3>🕊 Modo Missa</h3><div class="muted">Siga a Missa passo a passo, com as leituras do dia</div></div>${icon('chevR')}</a></div>
    <div id="plist">
      ${favs.length ? `<div class="section"><div class="section-title">Favoritas</div><div class="list">${favs.map(item).join('')}</div></div>` : ''}
      ${PRAYER_GROUPS.map((g) => `<div class="section"><div class="section-title">${esc(g.name)}</div><div class="list">${prayersByGroup(g.id).map(item).join('')}</div></div>`).join('')}
    </div>`;
  $('#pq', view).addEventListener('input', (e) => {
    const q = norm(e.target.value.trim());
    const list = $('#plist', view);
    if (!q) { renderPrayers(view); $('#pq', view).focus(); return; }
    const hits = PRAYERS.filter((p) => norm(p.name).includes(q) || norm(p.text).includes(q));
    list.innerHTML = hits.length ? `<div class="section"><div class="list">${hits.map(item).join('')}</div></div>` : `<div class="empty">Nenhuma oração encontrada</div>`;
  });
}

export function renderPrayer(view, id) {
  const p = getPrayer(id);
  if (!p) { view.innerHTML = `${topbar({ title: 'Oração', back: true })}<div class="empty">Oração não encontrada</div>`; $('[data-act=back]', view).onclick = () => history.back(); return; }
  let latin = false;
  const render = () => {
    const fav = store.isFavPrayer(id);
    view.innerHTML = `${topbar({ title: p.name, back: true, right: `<button class="icon-btn ${fav ? 'active' : ''}" data-act="fav" aria-label="Favorita">${fav ? icon('star') : icon('starO')}</button>` })}
      <div class="section" style="padding-bottom:0"><div class="row" style="flex-wrap:wrap">
        ${p.latin ? `<div class="seg"><button class="${!latin ? 'on' : ''}" data-l="0">Português</button><button class="${latin ? 'on' : ''}" data-l="1">Latim</button></div>` : ''}
        <span class="grow"></span>
        <button class="btn sm" data-act="copy">${icon('copy')} Copiar</button>
        <button class="btn sm" data-act="share">${icon('share')} Compartilhar</button>
        <button class="btn sm" data-act="listen">${icon('play')} Ouvir</button>
      </div>${p.note ? `<p class="small muted" style="margin-top:10px">${esc(p.note)}</p>` : ''}${p.ref ? `<p class="small" style="margin-top:6px"><a href="#/biblia/${refLink(p.ref)}">${icon('book')} ${esc(p.ref)}</a></p>` : ''}</div>
      <div class="prayer-text ${latin ? 'latin' : ''}">${esc(latin ? p.latin : p.text)}</div>`;
    $('[data-act=back]', view).onclick = () => history.back();
    $('[data-act=fav]', view).onclick = () => { const on = store.toggleFavPrayer(id); toast(on ? 'Adicionada às favoritas' : 'Removida das favoritas'); render(); };
    $$('[data-l]', view).forEach((b) => b.onclick = () => { latin = b.dataset.l === '1'; render(); });
    $('[data-act=copy]', view).onclick = () => copyText((latin ? p.latin : p.text));
    $('[data-act=share]', view).onclick = async () => { const ok = await shareText(`${p.name}\n\n${latin ? p.latin : p.text}\n\n— Bíblia Católica`); if (!ok) copyText(p.text); };
    $('[data-act=listen]', view).onclick = () => speak(latin ? p.latin : p.text, latin ? 'it-IT' : 'pt-BR', p.name);
  };
  render();
}
function refLink(ref) {
  // "Lc 1,46-55" -> "lc/1/46"
  const m = ref.match(/^([1-3]?\s?[A-Za-zÀ-ÿ]+)\s+(\d+)(?:,(\d+))?/);
  if (!m) return 'gn/1';
  const abbr = m[1].replace(/\s+/g, '');
  const id = { Mt: 'mt', Mc: 'mc', Lc: 'lc', Jo: 'jo', Is: 'is', Sl: 'sl' }[abbr] || abbr.toLowerCase();
  return `${id}/${m[2]}${m[3] ? '/' + m[3] : ''}`;
}
export function speak(text, lang = 'pt-BR', title = 'Oração') {
  if (audio.isActive()) { audio.stop(); return; }
  const items = String(text || '').split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t }));
  audio.play({ title, items, lang });
}

// ---------- Rosário ----------
export function renderRosary(view) {
  const lit = liturgicalDay(new Date());
  const todayKind = mysteryOfDay(new Date(), SEASON_KEYS[lit.season]);
  let kind = todayKind;
  const render = () => {
    const m = MYSTERIES[kind];
    view.innerHTML = `${topbar({ title: 'Santo Rosário' })}
      <div class="section">
        <div class="card accent">
          <div class="small" style="opacity:.85">Hoje, ${esc(fmtDate(new Date(), { weekday: 'long' }))}</div>
          <h3 style="font-size:20px;margin-top:4px">${esc(MYSTERIES[todayKind].name)}</h3>
          <div class="muted small">Contemplados às ${MYSTERIES[todayKind].days}s</div>
          <button class="btn block" style="margin-top:14px;background:#fff;color:var(--accent);border:0" data-act="pray">${icon('rosary')} Rezar o terço agora</button>
        </div>
      </div>
      <div class="section" style="padding-top:0"><div class="chips">${Object.entries(MYSTERIES).map(([k, v]) => `<button class="chip ${k === kind ? 'on' : ''}" data-k="${k}">${esc(v.name.replace('Mistérios ', ''))}</button>`).join('')}</div></div>
      <div class="section" style="padding-top:0"><div class="section-title">${esc(m.name)} · ${m.days}</div>
        <div class="list">${m.list.map((my, i) => `<a class="list-item" href="#/biblia/${my.ref[0]}/${my.ref[1]}/${my.ref[2]}"><div class="ico" style="background:${m.color};color:#fff;font-weight:800">${i + 1}</div><div class="grow"><div class="title">${esc(my.t)}</div><div class="sub">${esc(refString(my.ref[0], my.ref[1], my.ref[2], my.ref[3]))} · fruto: ${esc(my.fruit)}</div></div><span class="chev">${icon('chevR')}</span></a>`).join('')}</div>
      </div>
      <div class="section" style="padding-top:0"><a class="card row between" href="#/rosario" data-act="chaplet"><div><h3>🤍 Terço da Divina Misericórdia</h3><div class="small muted">Guiado, com as orações de Santa Faustina · ideal às 15h</div></div>${icon('chevR')}</a></div>
      <div class="section" style="padding-top:0"><div class="card"><h3>Como rezar</h3><p class="small muted" style="margin-top:6px">Sinal da Cruz, Creio, Pai Nosso, três Ave Marias e Glória. Em cada mistério: anuncia-se o mistério, reza-se um Pai Nosso, dez Ave Marias, o Glória e a oração de Fátima. Ao final, Salve Rainha. Terços rezados neste app: <b>${store.rosaryCount}</b>.</p></div></div>`;
    $$('[data-k]', view).forEach((b) => b.onclick = () => { kind = b.dataset.k; render(); });
    $('[data-act=pray]', view).onclick = () => guidedRosary(kind);
    $('[data-act=chaplet]', view).onclick = (e) => { e.preventDefault(); guidedRosary('misericordia'); };
  };
  render();
}

function guidedRosary(kind) {
  const chaplet = kind === 'misericordia';
  const steps = chaplet ? chapletSteps() : rosarySteps(kind);
  let i = 0;
  const m = chaplet ? { name: 'Terço da Divina Misericórdia', color: '#B3264A' } : MYSTERIES[kind];
  let wake = null;
  const { el, close } = openModal(`<div id="ros"></div>`, { onClose: () => { if (wake) { try { wake.release(); } catch { /* */ } wake = null; } } });
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {});
  const render = () => {
    const s = steps[i];
    const pct = Math.round(i * 100 / (steps.length - 1));
    const beads = s.mystery ? `<div class="beads">${Array.from({ length: 10 }, (_, k) => `<span class="bead ${s.n && k + 1 < s.n ? 'on' : ''} ${s.n === k + 1 ? 'cur' : ''}"></span>`).join('')}</div>` : '';
    $('#ros', el).innerHTML = `${topbar({ title: m.name, right: `<button class="icon-btn" data-act="x" aria-label="Fechar">${icon('close')}</button>` })}
      <div class="rosary-step">
        <div class="ring" style="--p:${pct}%"><div>${pct}%</div></div>
        <div class="kind">${esc(s.kind)}</div>
        <h2>${esc(s.title)}</h2>
        ${s.sub ? `<div class="muted small">${esc(s.sub)}</div>` : ''}
        ${beads}
        <div class="txt">${esc(s.text)}</div>
        ${s.ref ? `<p style="margin-top:12px"><a class="btn sm" href="#/biblia/${s.ref[0]}/${s.ref[1]}/${s.ref[2]}" data-act="ref">${icon('book')} Ler ${esc(refString(s.ref[0], s.ref[1], s.ref[2], s.ref[3]))}</a></p>` : ''}
      </div>
      <div class="ch-nav" style="position:sticky;bottom:0;background:var(--bg);padding-bottom:calc(16px + env(safe-area-inset-bottom))">
        <button class="btn" data-act="prev" ${i === 0 ? 'disabled' : ''}>${icon('chevL')} Anterior</button>
        <button class="btn primary big-btn grow" data-act="next">${s.last ? 'Concluir 🙏' : 'Próxima ' + icon('chevR')}</button>
      </div>`;
    $('[data-act=x]', el).onclick = () => close();
    $('[data-act=prev]', el).onclick = () => { if (i > 0) { i--; render(); } };
    $('[data-act=next]', el).onclick = () => { if (s.last) { store.rosaryDone(); toast(chaplet ? 'Jesus, eu confio em vós! 🙏' : 'Terço concluído. Deus te abençoe! 🙏'); close(); } else { i++; render(); window.scrollTo(0, 0); } };
    const ref = $('[data-act=ref]', el); if (ref) ref.onclick = () => close();
  };
  render();
}

// ---------- Liturgia ----------
// referência de versículos -> segmentos [{c, a, b}] (b = Infinity: até o fim do capítulo)
// aceita "1-2, 6-7", "13-18b", "23—3:9", "2-3; 2:2-4", "8 and 10" (formato da API) e "1-5.9-11", "23–3,6" (formato brasileiro)
function parseSpec(c0, spec) {
  const segs = [];
  let c = c0;
  const s = String(spec || '')
    .replace(/(\d),(\d)/g, '$1:$2')       // "3,6" -> "3:6" (capítulo,versículo)
    .replace(/(\d[a-d]*)\.(\d)/g, '$1, $2') // "1-5.9-11" -> "1-5, 9-11"
    .replace(/\s+(?:and|e)\s+/g, ', ');
  for (const raw of s.split(/[;,]/)) {
    const p = raw.trim().replace(/(\d)[a-d]{1,2}\b/g, '$1');
    if (!p) continue;
    const m = p.match(/^(?:(\d+):)?(\d+)(?:\s*[-–—]\s*(?:(\d+):)?(\d+))?$/);
    if (!m) continue;
    if (m[1]) c = +m[1];
    const a = +m[2];
    if (m[3]) { segs.push({ c, a, b: Infinity }); c = +m[3]; segs.push({ c, a: 1, b: +m[4] }); }
    else segs.push({ c, a, b: m[4] ? Math.max(a, +m[4]) : a });
  }
  return segs;
}
// texto de uma leitura na versão escolhida: [{c, v, t}]
export async function readingVerses(r) {
  const { getChapter } = await import('./data.js');
  const ver = store.settings.version;
  const segs = r.v ? parseSpec(r.c, r.v) : [{ c: r.c, a: 1, b: 60 }];
  const out = [];
  const cache = new Map();
  for (const sg of segs) {
    if (!cache.has(sg.c)) cache.set(sg.c, await getChapter(ver, r.b, sg.c));
    const ch = cache.get(sg.c);
    if (!ch) continue;
    ch.verses.forEach((t, i) => { const v = i + 1; if (t && v >= sg.a && v <= sg.b && !out.some((x) => x.c === sg.c && x.v === v)) out.push({ c: sg.c, v, t }); });
  }
  return out;
}
export async function renderLiturgy(view, dateISO) {
  const date = dateISO ? parseISO(dateISO) : new Date();
  const iso = todayISO(date);
  const lit = liturgicalDay(date);
  view.innerHTML = `${topbar({ title: 'Liturgia', right: `<button class="icon-btn" data-act="prev" aria-label="Dia anterior">${icon('chevL')}</button><button class="btn sm" data-act="today">Hoje</button><button class="icon-btn" data-act="next" aria-label="Próximo dia">${icon('chevR')}</button>` })}
    <div class="section">
      <div class="card row">
        <div class="lit-color" style="background:${lit.colorHex};border:1px solid var(--border)"></div>
        <div class="grow">
          <div class="small muted" style="text-transform:capitalize">${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>
          <h3 style="margin-top:4px">${esc(lit.name)}</h3>
          <div class="small muted">${esc(lit.seasonName)}${lit.week ? ` · ${lit.week}ª semana` : ''} · Ano ${lit.cycle}${lit.season === 'comum' ? ` · Ano ${lit.wcycle}` : ''} · Cor: ${esc(lit.colorName)}</div>
          ${lit.memorial ? `<div class="small" style="margin-top:6px"><span class="badge">${lit.memorial.r === 'm' ? 'Memória facultativa' : 'Memória'}</span> ${esc(lit.memorial.n)}</div>` : ''}
          ${lit.ferial ? `<div class="small muted" style="margin-top:6px">Dia de semana: ${esc(lit.ferial.name)}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="section" style="padding-top:0"><div class="row" style="align-items:center"><div class="section-title grow">Leituras da Missa</div><button class="btn sm" data-act="listen-readings" hidden>${icon('play')} Ouvir</button></div><div class="card" id="readings"><div class="skel"></div><div class="skel" style="width:70%"></div></div></div>
    <div class="section" style="padding-top:0"><div class="section-title">Próximas celebrações</div><div class="list cal-list" id="upc"></div></div>`;
  $('[data-act=prev]', view).onclick = () => { location.hash = `#/liturgia/${todayISO(addDays(date, -1))}`; };
  $('[data-act=next]', view).onclick = () => { location.hash = `#/liturgia/${todayISO(addDays(date, 1))}`; };
  $('[data-act=today]', view).onclick = () => { location.hash = '#/liturgia'; };
  const { readings } = await readingsFor(date);
  const box = $('#readings', view);
  if (!readings) {
    box.innerHTML = `<p class="muted">As leituras deste dia não estão na base local do app.</p><p style="margin-top:8px"><a class="btn sm" href="https://liturgia.cancaonova.com/pb/" target="_blank" rel="noopener">Ver leituras na Canção Nova ↗</a></p>`;
  } else {
    const parts = [['first', '1ª Leitura'], ['psalm', 'Salmo responsorial'], ['second', '2ª Leitura'], ['gospel', 'Evangelho']].filter(([k]) => readings[k]);
    box.innerHTML = parts.map(([k, label]) => {
      const r = readings[k];
      const link = r.b ? `#/biblia/${r.b}/${r.c}${r.v1 ? '/' + r.v1 : ''}` : '';
      return `<div class="reading"><a class="row" ${link ? `href="${link}"` : ''}><div class="grow"><div class="kind">${label}</div><div class="ref">${esc(r.disp || r.raw)}</div></div>${link ? `<span class="chev">${icon('chevR')}</span>` : ''}</a><div class="reading-text" data-k="${k}"></div></div>`;
    }).join('') + (readings.note ? `<p class="small muted" style="margin-top:8px">${esc(readings.note)}</p>` : '') + `<p class="small muted" style="margin-top:10px">Salmos numerados conforme a Vulgata (entre parênteses, a numeração hebraica); o título do Salmo conta como versículo. Texto: ${esc(version(store.settings.version).name)}.</p>`;
    // texto das leituras
    for (const [k] of parts) {
      const r = readings[k];
      const holder = box.querySelector(`.reading-text[data-k="${k}"]`);
      if (!r.b || !holder) continue;
      try {
        const vs = await readingVerses(r);
        if (vs.length) holder.innerHTML = vs.map((x) => `<span class="rv"><sup>${x.c !== r.c ? x.c + ',' : ''}${x.v}</sup>${esc(x.t)}</span>`).join(' ');
      } catch { /* sem texto */ }
    }
    const lb = $('[data-act=listen-readings]', view);
    if (lb && $('#readings .reading-text .rv', view)) {
      lb.hidden = false;
      lb.onclick = () => {
        if (audio.isActive()) { audio.stop(); return; }
        const items = [];
        $$('#readings .reading', view).forEach((r) => {
          const kind = $('.kind', r)?.textContent || '';
          const ref = $('.ref', r)?.textContent || '';
          items.push({ text: `${kind}. ${ref}.`, label: kind });
          $$('.rv', r).forEach((x) => items.push({ text: x.textContent.replace(/^\d+(?:,\d+)?\s*/, ''), label: `${kind} · ${ref}` }));
        });
        audio.play({ title: `Leituras · ${lit.name}`, items, lang: store.settings.version === 'vulgata' ? 'it-IT' : store.settings.version === 'drb' ? 'en-US' : 'pt-BR' });
      };
    }
  }
  const up = upcoming(addDays(date, 1), 10);
  $('#upc', view).innerHTML = up.map((u) => `<a class="list-item" href="#/liturgia/${todayISO(u.date)}"><div class="date"><b>${u.date.getDate()}</b><span>${esc(fmtDate(u.date, { month: 'short' })).replace('.', '')}</span></div><div class="grow"><div class="title">${esc(u.name)}</div><div class="sub">${u.rank === 'S' ? 'Solenidade' : u.rank === 'F' ? 'Festa' : 'Memória'} · ${esc(u.season)}</div></div><span class="chev">${icon('chevR')}</span></a>`).join('');
}
