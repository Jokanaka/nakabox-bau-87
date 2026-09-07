// Voz da leitura: uma tela só, feita do zero, com as vozes gravadas (Alex, Santa e Dora) e a voz do celular.
// Tocar numa voz escolhe a voz, toca a amostra dela e, se estiver lendo, troca a leitura na hora.
import { $, $$, esc, icon, toast } from './util.js';
import { store } from './store.js';
import { book, bookName } from './data.js';
import { openModal, topbar } from './ui.js';
import * as audio from './audio.js';
import * as cloud from './cloudtts.js';

export const APP_BUILD = 19;

const REC = [
  { id: 'alex', name: 'Alex', desc: 'Voz masculina' },
  { id: 'santa', name: 'Santa', desc: 'Voz masculina, mais grave' },
  { id: 'dora', name: 'Dora', desc: 'Voz feminina' },
];

// "Mateus e Marcos 1-6" a partir da lista de livros gravados de uma voz
function coverage(books, version) {
  const parts = Object.entries(books || {}).filter(([, n]) => n > 0).map(([id, n]) => {
    const b = book(id); const name = b ? bookName(b, version) : id;
    return b && n >= b.chapters ? name : n === 1 ? `${name} 1` : `${name} 1-${n}`;
  });
  if (!parts.length) return '';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

export function openVoz() {
  const s = store.settings;
  const advanced = s.uiMode === 'avancado';
  const hm = /^#\/biblia\/([a-z0-9]+)\/(\d+)/.exec(location.hash || '');
  const cur = audio.currentRef() || (hm && book(hm[1]) ? { book: hm[1], chapter: +hm[2] } : null);
  const curName = cur ? `${bookName(book(cur.book), s.version)} ${cur.chapter}` : '';
  const { el, close } = openModal('<div id="voz"></div>');
  const root = () => $('#voz', el);

  const card = ({ kind, id, name, desc, note, on, sample }) => `
    <div class="voz-card ${on ? 'on' : ''}" data-kind="${kind}" data-id="${esc(id)}">
      <button class="voz-main" data-act="pick" aria-pressed="${on ? 'true' : 'false'}">
        <span class="voz-name">${esc(name)}${on ? ' <span class="voz-check">✓ escolhida</span>' : ''}</span>
        <span class="voz-desc">${desc}</span>
        ${note ? `<span class="voz-note">${note}</span>` : ''}
      </button>
      ${sample ? `<button class="voz-play" data-act="sample" aria-label="Ouvir amostra de ${esc(name)}">${icon('play')}</button>` : ''}
    </div>`;

  const draw = () => {
    const c = audio.voiceChoice();
    const vs = audio.recordedVoices();
    const active = audio.isActive();
    const recCards = REC.map((r) => {
      const v = vs.find((x) => x.id === r.id);
      const cov = v ? coverage(v.books, s.version) : '';
      const here = cur && v ? audio.recordedAvailable(cur.book, cur.chapter, r.id) : false;
      let note = '';
      if (cur) note = here ? `Lê ${esc(curName)} (o capítulo aberto).` : `Ainda não gravou ${esc(curName)}: nesse capítulo a leitura fica com a voz do celular.`;
      return card({ kind: 'rec', id: r.id, name: r.name, desc: `${r.desc} · ${cov ? `já lê ${esc(cov)}` : 'em preparação'}`, note, on: c.kind === 'rec' && c.id === r.id, sample: !!audio.recordedSampleUrl(r.id) });
    }).join('');
    const devVoices = audio.voices();
    const pt = devVoices.filter((v) => /^pt/i.test(String(v.lang || '').replace('_', '-')));
    const dev = audio.chosenVoice();
    const devCard = card({ kind: 'dev', id: c.kind === 'dev' ? c.id : '', name: 'Voz do celular', desc: `A voz do próprio aparelho${dev ? ` (${esc(dev.name)})` : ''} · lê qualquer capítulo`, note: '', on: c.kind === 'dev', sample: true });
    const devSelect = advanced && devVoices.length ? `
      <label class="au-label" for="voz-dev">Qual voz do celular</label>
      <select id="voz-dev" class="input" aria-label="Voz do celular">
        <option value="" ${!s.ttsVoice ? 'selected' : ''}>Automática (${s.ttsMale ? 'masculina em português, se houver' : 'português'})</option>
        ${pt.map((v) => `<option value="${esc(v.voiceURI)}" ${s.ttsVoice === v.voiceURI ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}
        ${devVoices.filter((v) => !pt.includes(v)).map((v) => `<option value="${esc(v.voiceURI)}" ${s.ttsVoice === v.voiceURI ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}
      </select>
      <div class="setting"><span>Preferir voz masculina (automática)</span><button class="switch ${s.ttsMale ? 'on' : ''}" data-act="male" aria-label="Preferir voz masculina"></button></div>` : '';
    const extra = advanced ? [
      audio.localSupported() ? card({ kind: 'local', id: 'faber', name: 'Faber (narrador offline)', desc: 'Voz masculina gerada no celular; baixa cerca de 90 MB uma vez', on: c.kind === 'local', sample: false }) : '',
      cloud.cloudConfigured() ? card({ kind: 'cloud', id: '', name: 'Narrador na nuvem', desc: 'Google Cloud com a sua chave', on: c.kind === 'cloud', sample: false }) : '',
    ].join('') : '';
    const doneAll = coverage(Object.fromEntries(vs.flatMap((v) => Object.entries(v.books)).reduce((m, [b, n]) => (m.set(b, Math.max(m.get(b) || 0, n)), m), new Map())), s.version);
    root().innerHTML = `${topbar({ title: 'Voz da leitura', right: `<button class="icon-btn" data-act="x" aria-label="Fechar">${icon('close')}</button>` })}
      <div class="section">
        <p class="voz-status">${active ? `Lendo agora <b>${esc(audio.currentTitle())}</b> com a voz <b>${esc(audio.voiceLabel())}</b>.` : `Voz escolhida: <b>${esc(audio.voiceLabel())}</b>.`} <span class="muted">Versão do app ${APP_BUILD}.</span></p>
        <p class="small muted" style="margin:0 0 10px">Toque numa voz. Ela toca uma amostra, fica escolhida e, se você estiver ouvindo um capítulo, a leitura continua do mesmo versículo com a voz nova.</p>
        <div class="section-title">Vozes gravadas (humanas)</div>
        ${recCards}
        <p class="small muted" style="margin:8px 0 14px">${doneAll ? `As vozes gravadas já leem ${esc(doneAll)}. Os outros livros estão sendo gravados, na ordem: Marcos, Lucas, João, Gênesis, Salmos e Atos.` : 'Os primeiros capítulos gravados estão sendo produzidos.'}</p>
        <div class="section-title">Voz do celular</div>
        ${devCard}
        ${devSelect}
        ${extra ? `<div class="section-title" style="margin-top:14px">Outros narradores</div>${extra}` : ''}
      </div>`;
    $('[data-act=x]', el).onclick = () => close();
    $$('.voz-card', el).forEach((cd) => {
      const kind = cd.dataset.kind, id = cd.dataset.id;
      const name = $('.voz-name', cd).firstChild.textContent.trim();
      $('[data-act=pick]', cd).onclick = async () => {
        audio.unlock();   // ainda no toque (iPhone)
        const wasActive = audio.isActive();
        if (!wasActive) { if (kind === 'rec') audio.playRecordedSample(id); else if (kind === 'dev') audio.testDeviceVoice(id); }   // amostra dentro do gesto
        const res = await audio.chooseVoice(kind, id);
        draw();
        if (res.status === 'switched') toast(`Agora lendo com a voz ${res.name}`);
        else if (res.status === 'unavailable') toast(`${name} ainda não gravou ${curName || 'este capítulo'}; a leitura continua com ${audio.voiceLabel()}. Ouça ${name} em ${coverage((audio.recordedVoices().find((v) => v.id === id) || {}).books, s.version) || 'Mateus'}.`, 6000);
        else toast(`Voz escolhida: ${res.name}`);
      };
      const sp = $('[data-act=sample]', cd);
      if (sp) sp.onclick = () => { audio.unlock(); if (kind === 'rec') audio.playRecordedSample(id); else audio.testDeviceVoice(kind === 'dev' ? id : undefined); };
    });
    const sel = $('#voz-dev', el);
    if (sel) sel.onchange = async (e) => {
      audio.unlock();
      const v = e.target.value;
      if (audio.voiceChoice().kind === 'dev') { const res = await audio.chooseVoice('dev', v); draw(); toast(res.status === 'switched' ? `Agora lendo com a voz ${res.name}` : `Voz escolhida: ${res.name}`); }
      else { store.setSetting('ttsVoice', v); audio.restartCurrent(); draw(); toast(v ? `Voz do celular: ${(audio.voiceById(v) || { name: v }).name}` : 'Voz do celular: automática'); }
    };
    const male = $('[data-act=male]', el);
    if (male) male.onclick = () => { store.setSetting('ttsMale', !store.settings.ttsMale); draw(); };
  };
  draw();
  audio.loadAudioManifest().then(draw);
  return { close };
}
