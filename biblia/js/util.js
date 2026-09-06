// Utilidades gerais
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// remove acentos e baixa caixa, para busca
export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(d = new Date(), opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  try { return new Intl.DateTimeFormat('pt-BR', opts).format(d); } catch { return d.toDateString(); }
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d.getTime());
  r.setDate(r.getDate() + n);
  return r;
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado!');
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copiado!'); } catch { toast('Não foi possível copiar'); }
    ta.remove();
    return false;
  }
}

export function icon(name) {
  const I = {
    back: '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 8 12l7.5 7.5 1.4-1.4L10.8 12l6.1-6.1z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 1 1-4.9 12l-.1-.1L3.3 17.6l-1.4-1.4 2.7-2.7A7 7 0 0 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm11.3 11.9L21 20.2l-1.4 1.4-3.2-3.2 1.4-1.4z"/></svg>',
    font: '<svg viewBox="0 0 24 24"><path d="M9.5 4h2l6 16h-2.2l-1.7-4.6H7.4L5.7 20H3.5zm-1.4 9.5h4.8L10.5 6.9zM17 4h2l.7 2H23v2h-3.3l.9 2.6H18.5L17.7 8H15V6h2z"/></svg>',
    chevR: '<svg viewBox="0 0 24 24"><path d="M9 5.5 7.6 6.9l5.1 5.1-5.1 5.1L9 18.5l6.5-6.5z"/></svg>',
    chevL: '<svg viewBox="0 0 24 24"><path d="M15 5.5l1.4 1.4-5.1 5.1 5.1 5.1L15 18.5 8.5 12z"/></svg>',
    chevD: '<svg viewBox="0 0 24 24"><path d="M5.5 9 6.9 7.6l5.1 5.1 5.1-5.1L18.5 9 12 15.5z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.1.9l-7-4.1a3.3 3.3 0 0 0 0-1.6l7-4.1A3 3 0 1 0 15 5a3 3 0 0 0 .1.7l-7 4.1a3 3 0 1 0 0 4.4l7 4.1A3 3 0 1 0 18 16z"/></svg>',
    note: '<svg viewBox="0 0 24 24"><path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7zm17.7-10.2a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7z"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg>',
    bookmarkO: '<svg viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2zm0 15-5-2.2L7 18V5h10z"/></svg>',
    highlight: '<svg viewBox="0 0 24 24"><path d="M6 14l-2 2 3 3 2-2zm10.7-11.3 4.6 4.6-9.9 9.9-4.6-4.6zM3 21h18v2H3z"/></svg>',
    compare: '<svg viewBox="0 0 24 24"><path d="M3 4h8v16H3zm2 2v12h4V6zm8-2h8v16h-8zm2 2v12h4V6z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5zM6.5 4a.5.5 0 0 0-.5.5v11.8c.16-.05.33-.08.5-.08H18V4z"/></svg>',
    rosary: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="17.5" cy="8" r="2"/><circle cx="19" cy="14" r="2"/><circle cx="5" cy="14" r="2"/><circle cx="6.5" cy="8" r="2"/><path d="M11 17h2v2h1.5v2H13v2h-2v-2H9.5v-2H11z"/></svg>',
    pray: '<svg viewBox="0 0 24 24"><path d="M11 2h2v5h5v2h-5v13h-2V9H6V7h5z"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3zm-1 8v10h12V10zm2 2h2v2H8zm4 0h2v2h-2zm4 0h2v2h-2zM8 16h2v2H8zm4 0h2v2h-2z"/></svg>',
    plan: '<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5zm2 3h2v2H7zm4 0h6v2h-6zm-4 4h2v2H7zm4 0h6v2h-6zm-4 4h2v2H7zm4 0h6v2h-6z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 17.3 6.2 3.7-1.6-7 5.4-4.7-7.2-.6L12 2 9.2 8.7 2 9.3l5.4 4.7-1.6 7z"/></svg>',
    starO: '<svg viewBox="0 0 24 24"><path d="m12 17.3 6.2 3.7-1.6-7 5.4-4.7-7.2-.6L12 2 9.2 8.7 2 9.3l5.4 4.7-1.6 7zm0-2.3-3.8 2.3 1-4.3L5.9 10l4.4-.4L12 5.5l1.7 4.1 4.4.4-3.3 2.9 1 4.3z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.7l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.4l-.4 2.7a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.7L4.6 11a7.8 7.8 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.7l2 3.4c.1.2.4.3.6.2l2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.7c0 .2.2.4.5.4h4c.2 0 .5-.2.5-.4l.4-2.7a7.3 7.3 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.7zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5zm7-16v9.2l3.6-3.6L17 11l-5 5-5-5 1.4-1.4L11 13.2V4z"/></svg>',
    history: '<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.9 3.9L9 12H6a7 7 0 1 1 2 4.9l-1.4 1.4A9 9 0 1 0 13 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M13.5 1s.9 3.4-1.5 6c-1.4 1.5-3 2.3-3 5a3 3 0 0 0 6 0c0-1-.5-2-.5-2s3.5 1.4 3.5 6a6 6 0 0 1-12 0c0-3.5 2-5.5 2-5.5S7 13 9 13c1 0 1-2 1-2s-2.5-6.5 3.5-10z"/></svg>',
    church: '<svg viewBox="0 0 24 24"><path d="M11 2h2v2h2v2h-2v2.3l5 3V21h-4v-4a2 2 0 0 0-4 0v4H6v-9.7l5-3V6H9V4h2zM4 14l2-1.2V21H4zm16 0v7h-2v-8.2z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9A5.3 5.3 0 0 1 12 6.4 5.3 5.3 0 0 1 21.5 12c-2 4.4-9.5 9-9.5 9z"/></svg>',
    lang: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3a15.7 15.7 0 0 0-1.4-5.1A8 8 0 0 1 18.9 11zM12 4c.8 1.2 1.5 3 1.9 5h-3.8c.4-2 1.1-3.8 1.9-5zM5.1 13h3c.1 1.8.5 3.6 1.4 5.1A8 8 0 0 1 5.1 13zm3-2h-3a8 8 0 0 1 4.4-5.1A15.7 15.7 0 0 0 8.1 11zM12 20c-.8-1.2-1.5-3-1.9-5h3.8c-.4 2-1.1 3.8-1.9 5zm2.2-7H9.8a13.7 13.7 0 0 1 0-2h4.4a13.7 13.7 0 0 1 0 2zm.3 5.1c.9-1.5 1.3-3.3 1.4-5.1h3a8 8 0 0 1-4.4 5.1z"/></svg>',
    export: '<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5zm7-16-5 5 1.4 1.4L11 7.8V16h2V7.8l2.6 2.6L17 9z"/></svg>',
  };
  return I[name] || '';
}
