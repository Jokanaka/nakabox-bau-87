// Modo Missa: guia passo a passo da celebração com as partes do povo e as leituras do dia
import { $, $$, esc, icon, toast, todayISO, parseISO, fmtDate, addDays } from './util.js';
import { store } from './store.js';
import { book, bookName } from './data.js';
import { openModal, topbar } from './ui.js';
import { liturgicalDay, readingsFor } from './liturgy.js';
import { readingVerses } from './features.js';
import * as audio from './audio.js';

const P = 'Presidente'; // quem fala
const T = 'Todos';
const L = 'Leitor';

const CONFITEOR = 'Confesso a Deus todo-poderoso e a vós, irmãos e irmãs, que pequei muitas vezes por pensamentos e palavras, atos e omissões, por minha culpa, minha tão grande culpa. E peço à Virgem Maria, aos anjos e santos e a vós, irmãos e irmãs, que rogueis por mim a Deus, nosso Senhor.';
const GLORIA = 'Glória a Deus nas alturas, e paz na terra aos homens por Ele amados. Senhor Deus, rei dos céus, Deus Pai todo-poderoso: nós vos louvamos, nós vos bendizemos, nós vos adoramos, nós vos glorificamos, nós vos damos graças por vossa imensa glória. Senhor Jesus Cristo, Filho Unigênito, Senhor Deus, Cordeiro de Deus, Filho de Deus Pai. Vós que tirais o pecado do mundo, tende piedade de nós. Vós que tirais o pecado do mundo, acolhei a nossa súplica. Vós que estais à direita do Pai, tende piedade de nós. Só vós sois o Santo, só vós, o Senhor, só vós, o Altíssimo, Jesus Cristo, com o Espírito Santo, na glória de Deus Pai. Amém.';
const CREDO = 'Creio em um só Deus, Pai todo-poderoso, criador do céu e da terra, de todas as coisas visíveis e invisíveis. Creio em um só Senhor, Jesus Cristo, Filho Unigênito de Deus, nascido do Pai antes de todos os séculos: Deus de Deus, luz da luz, Deus verdadeiro de Deus verdadeiro, gerado, não criado, consubstancial ao Pai. Por ele todas as coisas foram feitas. E por nós, homens, e para nossa salvação, desceu dos céus e se encarnou pelo Espírito Santo, no seio da Virgem Maria, e se fez homem. Também por nós foi crucificado sob Pôncio Pilatos; padeceu e foi sepultado. Ressuscitou ao terceiro dia, conforme as Escrituras, e subiu aos céus, onde está sentado à direita do Pai. E de novo há de vir, em sua glória, para julgar os vivos e os mortos; e o seu reino não terá fim. Creio no Espírito Santo, Senhor que dá a vida, e procede do Pai e do Filho; e com o Pai e o Filho é adorado e glorificado: ele que falou pelos profetas. Creio na Igreja, una, santa, católica e apostólica. Professo um só batismo para remissão dos pecados. E espero a ressurreição dos mortos e a vida do mundo que há de vir. Amém.';
const SANTO = 'Santo, Santo, Santo, Senhor Deus do universo! O céu e a terra proclamam a vossa glória. Hosana nas alturas! Bendito o que vem em nome do Senhor! Hosana nas alturas!';
const PAI_NOSSO = 'Pai nosso, que estais nos céus, santificado seja o vosso nome; venha a nós o vosso reino; seja feita a vossa vontade, assim na terra como no céu. O pão nosso de cada dia nos dai hoje; perdoai-nos as nossas ofensas, assim como nós perdoamos a quem nos tem ofendido; e não nos deixeis cair em tentação, mas livrai-nos do mal.';
const CORDEIRO = 'Cordeiro de Deus, que tirais o pecado do mundo, tende piedade de nós.\nCordeiro de Deus, que tirais o pecado do mundo, tende piedade de nós.\nCordeiro de Deus, que tirais o pecado do mundo, dai-nos a paz.';

const GOSPEL_NAMES = { mt: 'São Mateus', mc: 'São Marcos', lc: 'São Lucas', jo: 'São João' };

// monta os passos da Missa do dia
export function buildMassSteps(lit, readings, texts) {
  const lent = lit.season === 'quaresma' || lit.season === 'triduo';
  const sunday = lit.dow === 0;
  const gloria = (sunday && !['advento', 'quaresma', 'triduo'].includes(lit.season)) || lit.rank === 'S' || lit.rank === 'F';
  const credo = sunday || lit.rank === 'S';
  const s = [];
  const add = (x) => s.push(x);
  const part = 'Ritos iniciais';
  add({ part, title: 'Canto de entrada', rubric: 'Todos de pé. O sacerdote entra enquanto a assembleia canta.', text: '' });
  add({ part, title: 'Sinal da Cruz', dialog: [[P, 'Em nome do Pai e do Filho e do Espírito Santo.'], [T, 'Amém.']] });
  add({ part, title: 'Saudação', dialog: [[P, 'A graça de nosso Senhor Jesus Cristo, o amor do Pai e a comunhão do Espírito Santo estejam convosco.'], [T, 'Bendito seja Deus que nos reuniu no amor de Cristo.']], rubric: 'Ou: "O Senhor esteja convosco." Resposta: "Ele está no meio de nós."' });
  add({ part, title: 'Ato penitencial', rubric: 'Momento de silêncio para reconhecer os pecados.', dialog: [[T, CONFITEOR], [P, 'Deus todo-poderoso tenha compaixão de nós, perdoe os nossos pecados e nos conduza à vida eterna.'], [T, 'Amém.']] });
  add({ part, title: 'Senhor, tende piedade', dialog: [[P, 'Senhor, tende piedade de nós.'], [T, 'Senhor, tende piedade de nós.'], [P, 'Cristo, tende piedade de nós.'], [T, 'Cristo, tende piedade de nós.'], [P, 'Senhor, tende piedade de nós.'], [T, 'Senhor, tende piedade de nós.']] });
  if (gloria) add({ part, title: 'Glória', rubric: 'Rezado ou cantado.', text: GLORIA });
  add({ part, title: 'Oração da coleta', dialog: [[P, 'Oremos.'], [P, '(oração do dia)'], [T, 'Amém.']], rubric: 'O sacerdote reza a oração própria do dia.' });

  const w = 'Liturgia da Palavra';
  const reading = (kind, label, r, intro, closeDialog) => {
    if (!r || !r.b) return;
    const vs = texts[kind] || [];
    add({ part: w, title: label, rubric: `Sentados. Leitor: "${intro}"`, reading: { b: r.b, c: r.c, disp: r.disp || r.raw, verses: vs }, dialog: closeDialog });
  };
  const rd = readings || {};
  reading('first', 'Primeira Leitura', rd.first, `Leitura: ${rd.first ? (rd.first.disp || rd.first.raw) : ''}`, [[L, 'Palavra do Senhor.'], [T, 'Graças a Deus.']]);
  reading('psalm', 'Salmo Responsorial', rd.psalm, `Salmo ${rd.psalm ? (rd.psalm.disp || rd.psalm.raw) : ''}`, null);
  if (rd.second) reading('second', 'Segunda Leitura', rd.second, `Leitura: ${rd.second.disp || rd.second.raw}`, [[L, 'Palavra do Senhor.'], [T, 'Graças a Deus.']]);
  add({ part: w, title: 'Aclamação ao Evangelho', rubric: 'Todos de pé.', text: lent ? 'Louvor a vós, ó Cristo, Rei da eterna glória!' : 'Aleluia, Aleluia, Aleluia!' });
  if (rd.gospel && rd.gospel.b) {
    const gname = GOSPEL_NAMES[rd.gospel.b] || bookName(book(rd.gospel.b), 'figueiredo');
    add({ part: w, title: 'Evangelho', rubric: 'De pé.', dialog: [[P, 'O Senhor esteja convosco.'], [T, 'Ele está no meio de nós.'], [P, `Proclamação do Evangelho de Jesus Cristo segundo ${gname}.`], [T, 'Glória a vós, Senhor.']], reading: { b: rd.gospel.b, c: rd.gospel.c, disp: rd.gospel.disp || rd.gospel.raw, verses: texts.gospel || [] }, after: [[P, 'Palavra da Salvação.'], [T, 'Glória a vós, Senhor.']] });
  }
  add({ part: w, title: 'Homilia', rubric: 'Sentados. O sacerdote explica a Palavra de Deus.', text: '' });
  if (credo) add({ part: w, title: 'Profissão de fé', rubric: 'De pé.', text: CREDO });
  add({ part: w, title: 'Oração dos fiéis', rubric: 'A cada pedido, todos respondem.', dialog: [[T, 'Senhor, escutai a nossa prece.']] });

  const e = 'Liturgia Eucarística';
  add({ part: e, title: 'Apresentação das oferendas', rubric: 'Sentados. Pão e vinho são levados ao altar.', dialog: [[P, 'Bendito sejais, Senhor Deus do universo, pelo pão que recebemos de vossa bondade, fruto da terra e do trabalho humano, que agora vos apresentamos e para nós se vai tornar pão da vida.'], [T, 'Bendito seja Deus para sempre.'], [P, 'Bendito sejais, Senhor Deus do universo, pelo vinho que recebemos de vossa bondade, fruto da videira e do trabalho humano, que agora vos apresentamos e para nós se vai tornar vinho da salvação.'], [T, 'Bendito seja Deus para sempre.']] });
  add({ part: e, title: 'Orai, irmãos e irmãs', rubric: 'De pé.', dialog: [[P, 'Orai, irmãos e irmãs, para que o nosso sacrifício seja aceito por Deus Pai todo-poderoso.'], [T, 'Receba o Senhor por tuas mãos este sacrifício, para glória do seu nome, para nosso bem e de toda a santa Igreja.'], [P, '(oração sobre as oferendas)'], [T, 'Amém.']] });
  add({ part: e, title: 'Prefácio', dialog: [[P, 'O Senhor esteja convosco.'], [T, 'Ele está no meio de nós.'], [P, 'Corações ao alto.'], [T, 'O nosso coração está em Deus.'], [P, 'Demos graças ao Senhor, nosso Deus.'], [T, 'É nosso dever e nossa salvação.']] });
  add({ part: e, title: 'Santo', rubric: 'Rezado ou cantado.', text: SANTO });
  add({ part: e, title: 'Oração Eucarística', rubric: 'De joelhos ou de pé, conforme o costume. Momento da consagração: silêncio e adoração.', text: '' });
  add({ part: e, title: 'Mistério da fé', dialog: [[P, 'Eis o mistério da fé!'], [T, 'Anunciamos, Senhor, a vossa morte e proclamamos a vossa ressurreição. Vinde, Senhor Jesus!']] });
  add({ part: e, title: 'Doxologia', dialog: [[P, 'Por Cristo, com Cristo, em Cristo, a vós, Deus Pai todo-poderoso, na unidade do Espírito Santo, toda a honra e toda a glória, agora e para sempre.'], [T, 'Amém.']] });

  const c = 'Rito da Comunhão';
  add({ part: c, title: 'Pai Nosso', rubric: 'De pé.', dialog: [[P, 'Rezemos, com amor e confiança, a oração que o Senhor Jesus nos ensinou:'], [T, PAI_NOSSO], [P, 'Livrai-nos de todos os males, ó Pai, e dai-nos hoje a vossa paz. Ajudados pela vossa misericórdia, sejamos sempre livres do pecado e protegidos de todos os perigos, enquanto, vivendo a esperança, aguardamos a vinda do Cristo Salvador.'], [T, 'Vosso é o reino, o poder e a glória para sempre!']] });
  add({ part: c, title: 'Saudação da paz', dialog: [[P, 'A paz do Senhor esteja sempre convosco.'], [T, 'O amor de Cristo nos uniu.'], [P, 'Saudai-vos em Cristo Jesus.']], rubric: 'Trocam-se um gesto de paz.' });
  add({ part: c, title: 'Cordeiro de Deus', rubric: 'Rezado ou cantado, enquanto o pão é partido.', text: CORDEIRO });
  add({ part: c, title: 'Comunhão', dialog: [[P, 'Eis o Cordeiro de Deus, que tira o pecado do mundo. Felizes os convidados para a ceia do Senhor.'], [T, 'Senhor, eu não sou digno de que entreis em minha morada, mas dizei uma palavra e serei salvo.'], [P, 'O Corpo de Cristo.'], [T, 'Amém.']], rubric: 'Quem comunga responde "Amém" ao receber a hóstia. Depois, silêncio de ação de graças.' });
  add({ part: c, title: 'Oração depois da comunhão', dialog: [[P, 'Oremos.'], [P, '(oração do dia)'], [T, 'Amém.']] });

  const f = 'Ritos finais';
  add({ part: f, title: 'Bênção', dialog: [[P, 'O Senhor esteja convosco.'], [T, 'Ele está no meio de nós.'], [P, 'Abençoe-vos Deus todo-poderoso, Pai e Filho e Espírito Santo.'], [T, 'Amém.']] });
  add({ part: f, title: 'Despedida', dialog: [[P, 'Ide em paz, e o Senhor vos acompanhe.'], [T, 'Graças a Deus.']], last: true });
  return s;
}

async function loadTexts(readings) {
  const out = {};
  if (!readings) return out;
  for (const k of ['first', 'psalm', 'second', 'gospel']) {
    const r = readings[k];
    if (!r || !r.b) continue;
    try { out[k] = await readingVerses(r); } catch { out[k] = []; }
  }
  return out;
}

export async function renderMissa(view, dateISO) {
  const date = dateISO ? parseISO(dateISO) : new Date();
  const iso = todayISO(date);
  const lit = liturgicalDay(date);
  view.innerHTML = `${topbar({ title: 'Modo Missa', right: `<button class="icon-btn" data-act="prev" aria-label="Dia anterior">${icon('chevL')}</button><button class="btn sm" data-act="today">Hoje</button><button class="icon-btn" data-act="next" aria-label="Próximo dia">${icon('chevR')}</button>` })}
    <div class="section">
      <div class="card row">
        <div class="lit-color" style="background:${lit.colorHex};border:1px solid var(--border)"></div>
        <div class="grow">
          <div class="small muted" style="text-transform:capitalize">${esc(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
          <h3 style="margin-top:4px">${esc(lit.name)}</h3>
          <div class="small muted">${esc(lit.seasonName)} · Ano ${lit.cycle} · Cor: ${esc(lit.colorName)}</div>
        </div>
      </div>
    </div>
    <div class="section" style="padding-top:0"><div class="card">
      <h3>🕊 Acompanhe a Missa passo a passo</h3>
      <p class="small muted" style="margin:6px 0 12px">Cada tela mostra o que acontece e o que a assembleia responde. Nas leituras, o texto completo aparece para ler ou ouvir. Quando terminar uma parte, toque em "Próximo".</p>
      <div id="missa-readings" class="small muted">Carregando as leituras…</div>
      <button class="btn primary block" data-act="start" style="margin-top:14px">${icon('play')} Começar a Missa</button>
    </div></div>
    <p class="small muted" style="padding:0 16px">Partes do povo conforme o Missal Romano em português (CNBB). As orações próprias do sacerdote variam conforme o dia.</p>`;
  $('[data-act=prev]', view).onclick = () => { location.hash = `#/missa/${todayISO(addDays(date, -1))}`; };
  $('[data-act=next]', view).onclick = () => { location.hash = `#/missa/${todayISO(addDays(date, 1))}`; };
  $('[data-act=today]', view).onclick = () => { location.hash = '#/missa'; };
  let readings = null;
  try { readings = (await readingsFor(date)).readings; } catch { readings = null; }
  const box = $('#missa-readings', view);
  if (box) {
    const parts = [['first', '1ª Leitura'], ['psalm', 'Salmo'], ['second', '2ª Leitura'], ['gospel', 'Evangelho']].filter(([k]) => readings && readings[k]);
    box.innerHTML = parts.length ? `Leituras de hoje: ${parts.map(([k, l]) => `<b>${l}</b> ${esc(readings[k].disp || readings[k].raw)}`).join(' · ')}` : 'As leituras deste dia não estão na base local; a Missa será apresentada sem os textos das leituras.';
  }
  $('[data-act=start]', view).onclick = async () => {
    const btn = $('[data-act=start]', view); btn.disabled = true; btn.textContent = 'Preparando…';
    const texts = await loadTexts(readings);
    btn.disabled = false; btn.innerHTML = `${icon('play')} Começar a Missa`;
    guidedMass(lit, readings, texts, iso);
  };
}

export function guidedMass(lit, readings, texts, iso) {
  const steps = buildMassSteps(lit, readings, texts || {});
  let i = 0;
  let wake = null;
  const { el, close } = openModal(`<div id="missa"></div>`, { onClose: () => { audio.stop(); if (wake) { try { wake.release(); } catch { /* */ } wake = null; } } });
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {});
  const dialogHtml = (d) => d ? `<div class="missa-dialog">${d.map(([who, line]) => `<div class="line ${who === T ? 'all' : ''}"><span class="who">${esc(who)}</span><span>${esc(line)}</span></div>`).join('')}</div>` : '';
  const render = () => {
    const s = steps[i];
    const pct = Math.round(i * 100 / (steps.length - 1));
    const rd = s.reading;
    $('#missa', el).innerHTML = `${topbar({ title: 'Missa', right: `<button class="icon-btn" data-act="x" aria-label="Fechar">${icon('close')}</button>` })}
      <div class="rosary-step missa-step">
        <div class="ring" style="--p:${pct}%"><div>${i + 1}/${steps.length}</div></div>
        <div class="kind">${esc(s.part)}</div>
        <h2>${esc(s.title)}</h2>
        ${s.rubric ? `<div class="muted small rubric">${esc(s.rubric)}</div>` : ''}
        ${dialogHtml(s.dialog)}
        ${s.text ? `<div class="txt">${esc(s.text)}</div>` : ''}
        ${rd ? `<div class="reading-box"><div class="row between" style="margin-bottom:6px"><b class="ref">${esc(rd.disp)}</b>${rd.verses.length ? `<button class="btn sm" data-act="listen">${icon('play')} Ouvir</button>` : ''}</div>${rd.verses.length ? `<div class="reading-text">${rd.verses.map((x) => `<span class="rv" data-v="${x.v}"><sup>${x.v}</sup>${esc(x.t)}</span>`).join(' ')}</div>` : `<p class="small muted">Texto não disponível na base local. <a href="#/biblia/${rd.b}/${rd.c}" data-act="open">Abrir ${esc(rd.disp)} na Bíblia</a></p>`}</div>` : ''}
        ${dialogHtml(s.after)}
      </div>
      <div class="ch-nav missa-nav">
        <button class="btn nav" data-act="prev" aria-label="Anterior" title="Anterior" ${i === 0 ? 'disabled' : ''}>${icon('chevL')}</button>
        <button class="btn primary big-btn grow" data-act="next">${s.last ? 'Concluir 🙏' : 'Terminei · Próximo ' + icon('chevR')}</button>
      </div>`;
    $('[data-act=x]', el).onclick = () => close();
    $('[data-act=prev]', el).onclick = () => { if (i > 0) { audio.stop(); i--; render(); window.scrollTo(0, 0); } };
    $('[data-act=next]', el).onclick = () => { audio.stop(); if (s.last) { toast('Ide em paz. Deus te abençoe! 🙏'); close(); } else { i++; render(); window.scrollTo(0, 0); } };
    const op = $('[data-act=open]', el); if (op) op.onclick = () => close();
    const li = $('[data-act=listen]', el);
    const setListen = (playing) => { if (li) li.innerHTML = playing ? `${icon('close')} Parar` : `${icon('play')} Ouvir`; };
    if (li) li.onclick = async () => {
      if (audio.isActive()) { audio.stop(); return; }
      const vs = rd.verses;
      setListen(true);
      const onItem = (idx, it) => { $$('.rv.speaking', el).forEach((x) => x.classList.remove('speaking')); const t = it.v ? $(`.rv[data-v="${it.v}"]`, el) : null; if (t) { t.classList.add('speaking'); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
      const onEnd = () => { $$('.rv.speaking', el).forEach((x) => x.classList.remove('speaking')); setListen(false); };
      const sameChapter = vs.every((x) => x.c === undefined || x.c === rd.c);
      let ok = false;
      if (sameChapter) {
        try { ok = await audio.playRecordedRange({ title: `${s.title} · ${rd.disp}`, book: rd.b, chapter: rd.c, fromV: vs[0].v, toV: vs[vs.length - 1].v, texts: new Map(vs.map((x) => [x.v, x.t])), onItem, onEnd }); } catch { ok = false; }
      }
      if (!ok && !audio.play({ title: `${s.title} · ${rd.disp}`, items: vs.map((x) => ({ v: x.v, label: `Versículo ${x.v}`, text: x.t })), lang: 'pt-BR', onItem, onEnd })) setListen(false);
    };
  };
  render();
  return { close };
}
