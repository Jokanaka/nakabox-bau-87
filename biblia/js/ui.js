// Componentes de interface: folhas inferiores (sheets), modais, cabeçalhos
import { $, h, icon } from './util.js';

const root = () => document.getElementById('sheet-root');
const stack = [];
// trava a rolagem da página enquanto houver folha/modal e marca no <body> se há uma tela cheia aberta (o player fica por cima dela)
const syncBody = () => {
  document.body.style.overflow = stack.length ? 'hidden' : '';
  document.body.classList.toggle('modal-open', !!root().querySelector('.modal'));
};

export function openSheet(html, { onClose } = {}) {
  const back = h('<div class="sheet-backdrop"></div>');
  const sheet = h(`<div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`);
  root().append(back, sheet);
  const close = () => {
    back.remove(); sheet.remove();
    const i = stack.indexOf(close); if (i >= 0) stack.splice(i, 1);
    syncBody();
    if (onClose) onClose();
  };
  back.addEventListener('click', close);
  stack.push(close); syncBody();
  return { el: sheet, close };
}

export function openModal(html, { onClose } = {}) {
  const modal = h(`<div class="modal" role="dialog"><div class="inner">${html}</div></div>`);
  root().append(modal);
  const close = () => {
    modal.remove();
    const i = stack.indexOf(close); if (i >= 0) stack.splice(i, 1);
    syncBody();
    if (onClose) onClose();
  };
  stack.push(close); syncBody();
  return { el: modal, close };
}

export function closeAll() { while (stack.length) stack[stack.length - 1](); }
export function hasOpen() { return stack.length > 0; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1](); });

export function topbar({ title = '', back = null, right = '' } = {}) {
  return `<header class="topbar">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Voltar">${icon('back')}</button>` : ''}
    <h1>${title}</h1>
    <span class="spacer"></span>
    ${right}
  </header>`;
}

export function confirm(msg, { ok = 'Confirmar', cancel = 'Cancelar', danger = false } = {}) {
  return new Promise((res) => {
    const { el, close } = openSheet(`<h3>${msg}</h3><div class="row" style="margin-top:14px">
      <button class="btn grow" data-act="cancel">${cancel}</button>
      <button class="btn primary grow ${danger ? 'danger' : ''}" data-act="ok">${ok}</button></div>`, { onClose: () => res(false) });
    el.querySelector('[data-act=ok]').onclick = () => { res(true); close(); };
    el.querySelector('[data-act=cancel]').onclick = () => close();
  });
}
