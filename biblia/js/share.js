// Geração de imagem de versículo (canvas) e compartilhamento
const PALETTES = [
  ['#7B1E3B', '#3D0F1E', '#F6D77A'],
  ['#1F3A5F', '#0E1C30', '#FFD98A'],
  ['#2E5E4E', '#12302A', '#F2E8C9'],
  ['#5B3A8C', '#2A1747', '#F5D6FF'],
  ['#8A5A1F', '#3D2708', '#FFF1CC'],
  ['#2F2F2F', '#0D0D0D', '#E6C766'],
];

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function makeVerseImage(text, ref, { palette = 0, size = 1080 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const [c1, c2, gold] = PALETTES[palette % PALETTES.length];
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // ornamento
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, size - 96, size - 96);
  ctx.fillStyle = gold;
  ctx.font = `700 ${size * 0.05}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText('✠', size / 2, 150);
  // texto
  let fontSize = text.length > 420 ? 34 : text.length > 300 ? 40 : text.length > 180 ? 48 : text.length > 90 ? 56 : 64;
  fontSize = Math.round(fontSize * size / 1080);
  const maxW = size - 200;
  let lines;
  do {
    ctx.font = `italic ${fontSize}px "Iowan Old Style", Palatino, Georgia, serif`;
    lines = wrap(ctx, '“' + text + '”', maxW);
    if (lines.length * fontSize * 1.35 > size - 420) fontSize -= 2; else break;
  } while (fontSize > 20);
  const lh = fontSize * 1.35;
  const startY = size / 2 - (lines.length * lh) / 2 + fontSize * 0.35 - 20;
  ctx.fillStyle = '#FFFFFF';
  lines.forEach((l, i) => ctx.fillText(l, size / 2, startY + i * lh));
  // referência
  ctx.fillStyle = gold;
  ctx.font = `700 ${Math.round(38 * size / 1080)}px system-ui, sans-serif`;
  ctx.fillText(ref, size / 2, startY + lines.length * lh + 40);
  // rodapé
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = `${Math.round(26 * size / 1080)}px system-ui, sans-serif`;
  ctx.fillText('Bíblia Católica', size / 2, size - 90);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

export async function shareImage(canvas, ref, text) {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], `${ref.replace(/[^\w]+/g, '_')}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: ref, text: `${text} (${ref})` }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  // fallback: download
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return 'downloaded';
}

export async function shareText(text, title = 'Bíblia Católica') {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return true; } catch (e) { return e.name === 'AbortError'; }
  }
  return false;
}
