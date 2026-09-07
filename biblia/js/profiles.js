// Perfis: cada pessoa da casa com os seus dados (leituras, metas, orações do dia, configurações)
import { $, $$, esc, icon, toast } from './util.js';
import { store } from './store.js';
import { openSheet, confirm } from './ui.js';

export const EMOJIS = ['🙂', '😊', '🧔', '👩', '👴', '👵', '🧑', '👦', '👧', '🙏', '✝️', '📿', '🕊️', '🌹', '⭐'];

export function profileChip() {
  const p = store.profile;
  return `<button class="profile-chip" data-act="profile" aria-label="Perfil: ${esc(p.name)}. Trocar de perfil">${esc(p.emoji)} <span>${esc(p.name)}</span> ${icon('chevD')}</button>`;
}

export function switchTo(id) {
  if (!store.switchProfile(id)) return;
  location.hash = '#/inicio';
  location.reload();
}

export function openProfiles() {
  const { el, close } = openSheet(`<div id="profiles"></div>`);
  const draw = () => {
    const cur = store.profile;
    $('#profiles', el).innerHTML = `
      <h3>Perfis</h3>
      <p class="small muted" style="margin:4px 0 10px">Cada pessoa tem as suas leituras, metas, planos e orações do dia. Toque num nome para usar o app com aquele perfil.</p>
      <div class="list">${store.profiles.map((p) => `
        <div class="list-item profile-row ${p.id === cur.id ? 'cur' : ''}">
          <button class="grow row" data-switch="${p.id}" style="text-align:left;gap:12px"><span class="pemoji">${esc(p.emoji)}</span><span><div class="title">${esc(p.name)}${p.id === cur.id ? ' <span class="badge accent">em uso</span>' : ''}</div></span></button>
          <button class="icon-btn" data-edit="${p.id}" aria-label="Editar ${esc(p.name)}">${icon('settings')}</button>
        </div>`).join('')}</div>
      <button class="btn primary block" data-act="new" style="margin-top:12px">＋ Novo perfil</button>`;
    $$('[data-switch]', el).forEach((b) => b.onclick = () => { const id = b.dataset.switch; if (id === cur.id) { close(); return; } toast(`Perfil: ${(store.profiles.find((p) => p.id === id) || {}).name}`); switchTo(id); });
    $$('[data-edit]', el).forEach((b) => b.onclick = () => openProfileEditor(store.profiles.find((p) => p.id === b.dataset.edit), draw));
    $('[data-act=new]', el).onclick = () => openProfileEditor(null, draw);
  };
  draw();
  return { close };
}

export function openProfileEditor(p, onDone) {
  let emoji = p ? p.emoji : EMOJIS[store.profiles.length % EMOJIS.length];
  const { el, close } = openSheet(`
    <h3>${p ? 'Editar perfil' : 'Novo perfil'}</h3>
    <label class="small muted" for="pf-name" style="display:block;margin:10px 0 6px">Nome</label>
    <input id="pf-name" class="input" maxlength="30" placeholder="Ex.: Mãe, Pai, João" value="${p ? esc(p.name) : ''}" autocomplete="off">
    <div class="small muted" style="margin:12px 0 6px">Ícone</div>
    <div class="chips" id="pf-emojis">${EMOJIS.map((e) => `<button class="chip pf-emoji ${e === emoji ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
    <div class="row" style="margin-top:14px">
      ${p && store.profiles.length > 1 ? `<button class="btn danger" data-act="del">${icon('trash')} Apagar</button>` : ''}
      <span class="grow"></span>
      <button class="btn primary" data-act="save">${p ? 'Salvar' : 'Criar e usar'}</button>
    </div>`);
  $$('.pf-emoji', el).forEach((b) => b.onclick = () => { emoji = b.dataset.e; $$('.pf-emoji', el).forEach((x) => x.classList.toggle('on', x === b)); });
  const input = $('#pf-name', el);
  setTimeout(() => input.focus(), 50);
  const submit = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); toast('Escreva um nome'); return; }
    if (p) { store.updateProfile(p.id, { name, emoji }); toast('Perfil atualizado'); close(); onDone && onDone(); }
    else { const id = store.addProfile({ name, emoji }); close(); toast(`Bem-vindo, ${name}!`); switchTo(id); }
  };
  $('[data-act=save]', el).onclick = submit;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const del = $('[data-act=del]', el);
  if (del) del.onclick = async () => {
    if (!(await confirm(`Apagar o perfil "${p.name}" e todos os seus dados deste aparelho?`, { ok: 'Apagar', danger: true }))) return;
    const wasCurrent = store.profile.id === p.id;
    store.deleteProfile(p.id); close(); toast('Perfil apagado');
    if (wasCurrent) { location.hash = '#/inicio'; location.reload(); } else onDone && onDone();
  };
}
