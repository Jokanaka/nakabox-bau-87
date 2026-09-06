// Teste do service worker de verdade (registrado num navegador): o manifesto da narração gravada é servido
// rede-primeiro (mudanças aparecem na hora) e continua disponível sem internet a partir do cache.
// Uso: node tools/sw_e2e.mjs   (a partir da pasta biblia; precisa de python3 e do Playwright do Node 22)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'biblia-sw-'));
fs.cpSync(SRC, DIR, { recursive: true });
const PORT = 8790 + Math.floor(Math.random() * 100);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: DIR, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const write = (v) => fs.writeFileSync(`${DIR}/data/audio.json`, JSON.stringify({ base: '', fallback: '', voices: {}, v }));
const shell = (fs.readFileSync(`${SRC}/sw.js`, 'utf8').match(/SHELL_CACHE = '([^']+)'/) || [])[1];
let ok = false;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(async () => chromium.launch());
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  write(1);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(async () => { const r = await navigator.serviceWorker.getRegistration(); return r && r.active && r.active.state === 'activated'; }, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  const get = () => page.evaluate(async () => { const r = await fetch('data/audio.json', { cache: 'no-cache' }); return (await r.json()).v; });
  const first = await get();
  write(2);
  const afterChange = await get();
  await ctx.setOffline(true);
  const offline = await get().catch((e) => 'erro: ' + e.message.split('\n')[0]);
  const chapterOffline = await page.evaluate(async () => { const r = await fetch('data/books.json'); return r.ok; }).catch(() => false);
  await ctx.setOffline(false);
  const caches = await page.evaluate(() => window.caches.keys());
  console.log(JSON.stringify({ first, afterChange, offline, chapterOffline, caches, shell }));
  ok = first === 1 && afterChange === 2 && offline === 2 && chapterOffline && caches.includes(shell);
  console.log(ok ? 'OK   service worker: manifesto rede-primeiro, reserva no cache, casca ' + shell : 'FAIL service worker');
} finally {
  await browser.close();
  server.kill();
  fs.rmSync(DIR, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
