import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:8765/index.html';
const SHOT = '/tmp/claude-0/-home-user-nakabox-bau-87/972f22bb-545c-5ad0-ac6c-c883efe8c07c/scratchpad/shots';
fs.mkdirSync(SHOT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(async () => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', serviceWorkers: 'block' });
const page = await ctx.newPage();
// síntese de voz falsa e determinística (o Chromium sem áudio não tem vozes): cada fala dura 400 ms
await page.addInitScript(() => {
  const voices = [{ name: 'Voz de teste', lang: 'pt-BR', voiceURI: 'teste-pt-br', localService: true, default: true }, { name: 'Test voice', lang: 'en-US', voiceURI: 'teste-en', localService: true, default: false }];
  const synth = { speaking: false, paused: false, pending: false, _cur: null, getVoices: () => voices, addEventListener() {}, removeEventListener() {},
    speak(u) { this._cur = u; this.speaking = true; setTimeout(() => { if (this._cur === u && u.onstart) u.onstart({}); }, 10); setTimeout(() => { if (this._cur === u) { this._cur = null; this.speaking = false; if (u.onend) u.onend({}); } }, 400); },
    cancel() { this._cur = null; this.speaking = false; }, pause() { this.paused = true; }, resume() { this.paused = false; } };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; this.rate = 1; this.pitch = 1; this.voice = null; } };
});
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !(m.location && (m.location().url || '').includes('texttospeech.googleapis.com')) && !m.text().includes('Service Worker registration blocked')) errors.push(`[console.${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('texttospeech.googleapis.com')) errors.push(`[http ${r.status()}] ${r.url()}`); });

const step = async (name, fn) => {
  try { await fn(); console.log('OK  ', name); }
  catch (e) { console.log('FAIL', name, '-', e.message.split('\n')[0]); errors.push(`[step ${name}] ${e.message.split('\n')[0]}`); }
  await page.screenshot({ path: `${SHOT}/${name}.png` });
};

await step('01-home', async () => {
  await page.goto(BASE + '#/inicio');
  await page.waitForSelector('.hero h1', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#votd .votd')?.textContent.length > 10, null, { timeout: 15000 });
  await page.waitForTimeout(800);
});
await step('02-reader-gn1', async () => {
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  const n = await page.$$eval('#chapter .verse', (els) => els.length);
  if (n !== 31) throw new Error('Gênesis 1 deveria ter 31 versículos, tem ' + n);
});
await step('03-verse-sheet', async () => {
  await page.click('#chapter .verse[data-v="1"]');
  await page.waitForSelector('.sheet .hl-colors', { timeout: 5000 });
  await page.click('.sheet [data-hl="amarelo"]');
  await page.waitForTimeout(300);
  const cls = await page.$eval('#chapter .verse[data-v="1"]', (el) => el.className);
  if (!cls.includes('hl-amarelo')) throw new Error('destaque não aplicado: ' + cls);
  await page.click('.sheet [data-act=bm]');
  await page.waitForTimeout(200);
});
await step('04-share-image', async () => {
  await page.click('.sheet [data-act=share]');
  await page.waitForSelector('#share-img', { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});
await step('05-book-picker', async () => {
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse');
  await page.click('[data-act=pick]');
  await page.waitForSelector('#bk-list .book-row', { timeout: 5000 });
  await page.fill('#bk-q', 'tob');
  await page.waitForTimeout(200);
  await page.click('.book-row[data-b="tb"]');
  await page.waitForSelector('.grid-ch button', { timeout: 5000 });
});
await step('06-reader-tobias-ocr', async () => {
  await page.click('.grid-ch button[data-c="1"]');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.waitForSelector('.ocr-note', { timeout: 5000 });
  const n = await page.$$eval('#chapter .verse', (els) => els.length);
  if (n < 20) throw new Error('Tobias 1 com poucos versículos: ' + n);
});
await step('07-version-vulgata', async () => {
  await page.click('[data-act=ver]');
  await page.waitForSelector('.sheet [data-v="vulgata"]');
  await page.click('.sheet [data-v="vulgata"]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse')?.textContent.includes('Tobias ex tribu'), null, { timeout: 15000 });
  await page.click('[data-act=ver]');
  await page.click('.sheet [data-v="figueiredo"]');
  await page.waitForTimeout(500);
});
await step('08-font-sheet', async () => {
  await page.click('[data-act=font]');
  await page.waitForSelector('.sheet .seg');
  await page.click('.sheet [data-k="theme"] [data-v="sepia"]');
  await page.click('.sheet [data-act=plus]');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
});
await step('09-search', async () => {
  await page.goto(BASE + '#/busca');
  await page.waitForSelector('#q');
  await page.fill('#q', 'misericórdia');
  await page.press('#q', 'Enter');
  await page.waitForSelector('.result', { timeout: 90000 });
  const n = await page.$$eval('.result', (els) => els.length);
  if (n < 20) throw new Error('poucos resultados: ' + n);
});
await step('09b-search-book', async () => {
  await page.click('[data-act=pickbook]');
  await page.waitForSelector('#bl [data-b="sl"]', { timeout: 5000 });
  await page.click('#bl [data-b="sl"]');
  await page.waitForFunction(() => document.querySelectorAll('.result').length > 0 && [...document.querySelectorAll('.result .ref')].every((r) => r.textContent.startsWith('Sl ')), null, { timeout: 30000 });
});
await step('10-search-ref', async () => {
  await page.fill('#q', 'Jo 3,16');
  await page.press('#q', 'Enter');
  await page.waitForSelector('a[href="#/biblia/jo/3/16"]', { timeout: 5000 });
  await page.click('a[href="#/biblia/jo/3/16"]');
  await page.waitForSelector('#chapter .verse[data-v="16"]', { timeout: 15000 });
  await page.waitForTimeout(600);
});
await step('11-plans', async () => {
  await page.goto(BASE + '#/planos');
  await page.waitForSelector('.plan-card', { timeout: 5000 });
  await page.click('a[href="#/planos/evangelhos-40"]');
  await page.waitForSelector('[data-act=start]', { timeout: 5000 });
  await page.click('[data-act=start]');
  await page.waitForSelector('[data-act=today]', { timeout: 5000 });
});
await step('12-plan-reading', async () => {
  await page.click('[data-act=today]');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.waitForSelector('.card.gold', { timeout: 5000 });
});
await step('13-prayers', async () => {
  await page.goto(BASE + '#/oracoes');
  await page.waitForSelector('.list-item', { timeout: 5000 });
  await page.click('a[href="#/oracoes/salve-rainha"]');
  await page.waitForSelector('.prayer-text', { timeout: 5000 });
  await page.click('[data-l="1"]');
  await page.waitForTimeout(200);
});
await step('14-rosary', async () => {
  await page.goto(BASE + '#/rosario');
  await page.waitForSelector('[data-act=pray]', { timeout: 5000 });
  await page.click('[data-act=pray]');
  await page.waitForSelector('.rosary-step', { timeout: 5000 });
  for (let i = 0; i < 9; i++) { await page.click('[data-act=next]'); await page.waitForTimeout(60); }
  await page.click('[data-act=x]');
});
await step('14b-chaplet', async () => {
  await page.goto(BASE + '#/rosario');
  await page.waitForSelector('[data-act=chaplet]', { timeout: 5000 });
  await page.click('[data-act=chaplet]');
  await page.waitForFunction(() => document.body.textContent.includes('Terço da Divina Misericórdia') && document.querySelector('.rosary-step'), null, { timeout: 5000 });
  for (let i = 0; i < 6; i++) { await page.click('[data-act=next]'); await page.waitForTimeout(50); }
  await page.click('[data-act=x]');
  await page.goto(BASE + '#/oracoes/nsa-aparecida');
  await page.waitForSelector('.prayer-text', { timeout: 5000 });
});
await step('15-liturgy', async () => {
  await page.goto(BASE + '#/liturgia');
  await page.waitForSelector('#readings .reading, #readings p', { timeout: 15000 });
  await page.waitForSelector('#upc .list-item', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#readings .reading-text .rv'), null, { timeout: 20000 });
});
await step('16-liturgy-christmas', async () => {
  await page.goto(BASE + '#/liturgia/2026-12-25');
  await page.waitForFunction(() => document.body.textContent.includes('Natal do Senhor'), null, { timeout: 5000 });
});
await step('17-more', async () => {
  await page.goto(BASE + '#/mais');
  await page.waitForSelector('.list-item', { timeout: 5000 });
  await page.click('a[href="#/mais/destaques"]');
  await page.waitForSelector('.result', { timeout: 10000 });
});
await step('18-settings-dark', async () => {
  await page.goto(BASE + '#/mais/config');
  await page.waitForSelector('.seg');
  await page.click('[data-k="theme"] [data-v="dark"]');
  await page.waitForTimeout(300);
  await page.goto(BASE + '#/biblia/sl/22');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
});
await step('19-about', async () => {
  await page.goto(BASE + '#/mais/sobre');
  await page.waitForSelector('.card h3', { timeout: 5000 });
});
await step('20-sw', async () => {
  // o service worker fica bloqueado no teste (para os mocks de rede valerem); confere só que o arquivo é servido e coerente
  const sw = await page.evaluate(async () => { const r = await fetch('sw.js'); const t = await r.text(); return { status: r.status, shell: (t.match(/SHELL_CACHE = '([^']+)'/) || [])[1], files: (t.match(/'\.\/js\/[^']+'/g) || []).length }; });
  if (sw.status !== 200 || !sw.shell || sw.files < 15) throw new Error('sw.js: ' + JSON.stringify(sw));
  console.log('   service worker:', sw.shell, sw.files, 'arquivos na casca');
});
// Google Cloud Text-to-Speech simulado: lista de vozes e um WAV curto de silêncio
const wav = (() => { const sr = 8000, n = 8000; const b = Buffer.alloc(44 + n, 128); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); return b.toString('base64'); })();
const cloudCalls = { voices: 0, synth: 0 };
// Narrador offline (Piper): runtime e modelo servidos dos arquivos locais em vez dos CDNs
const PIPER_DIR = '/tmp/claude-0/-home-user-nakabox-bau-87/972f22bb-545c-5ad0-ac6c-c883efe8c07c/scratchpad/piper';
const piperCalls = { files: [] };
await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/onnxruntime-web|cdn\.jsdelivr\.net\/npm\/@diffusionstudio\/piper-wasm|huggingface\.co/, async (route) => {
  const u = new URL(route.request().url());
  const name = u.pathname.split('/').pop();
  piperCalls.files.push(name);
  const local = name.startsWith('ort') ? `${PIPER_DIR}/ort/${name}` : `${PIPER_DIR}/${name}`;
  if (name === 'voices.json' || !fs.existsSync(local)) return route.fulfill({ status: 404, body: '' });
  const type = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.json') ? 'application/json' : 'application/octet-stream';
  return route.fulfill({ status: 200, contentType: type, headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(local) });
});
// Narração gravada: manifesto e capítulo Mt 1 servidos dos arquivos gerados localmente
const AUDIO_DIR = '/tmp/claude-0/-home-user-nakabox-bau-87/972f22bb-545c-5ad0-ac6c-c883efe8c07c/scratchpad/audio_out';
const recCalls = [];
await page.route('**/data/audio.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ base: 'https://cdn.jsdelivr.net/gh/jokanaka/nakabox-bau-87@test/', fallback: '', voices: { alex: { name: 'Alex', desc: 'masculina', books: { mt: 1 } }, santa: { name: 'Santa', desc: 'masculina, mais grave', books: {} } } }) }));
await page.route(/cdn\.jsdelivr\.net\/gh\/jokanaka\/nakabox-bau-87@test\//, (route) => {
  const u = new URL(route.request().url()); const rel = u.pathname.split('@test/')[1]; recCalls.push(rel + (route.request().headers()['range'] ? ' [range]' : ''));
  const local = `${AUDIO_DIR}/${rel}`;
  if (!fs.existsSync(local)) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ status: 200, contentType: rel.endsWith('.json') ? 'application/json' : 'audio/mpeg', headers: { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' }, body: fs.readFileSync(local) });
});
await page.route('https://texttospeech.googleapis.com/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.searchParams.get('key') !== 'CHAVE-TESTE') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }) });
  if (url.pathname.endsWith('/voices')) { cloudCalls.voices++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ voices: [
    { name: 'pt-BR-Neural2-A', ssmlGender: 'FEMALE', languageCodes: ['pt-BR'] }, { name: 'pt-BR-Chirp3-HD-Charon', ssmlGender: 'MALE', languageCodes: ['pt-BR'] }, { name: 'pt-BR-Neural2-B', ssmlGender: 'MALE', languageCodes: ['pt-BR'] }, { name: 'pt-BR-Standard-A', ssmlGender: 'FEMALE', languageCodes: ['pt-BR'] } ] }) }); }
  cloudCalls.synth++;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ audioContent: wav }) });
});
await step('20b-audio-player', async () => {
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=tts]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  const t = await page.$eval('#player-root .p-title', (el) => el.textContent);
  if (!t.includes('Gênesis 1')) throw new Error('título do player: ' + t);
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking'), null, { timeout: 3000 });
  await page.click('#player-root [data-act=toggle]');
  await page.waitForFunction(() => document.querySelector('#player-root [data-act=toggle]')?.getAttribute('aria-label') === 'Continuar', null, { timeout: 3000 });
  await page.click('#player-root [data-act=toggle]');
  await page.click('#player-root [data-act=next]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '2', null, { timeout: 3000 });
  await page.click('#player-root [data-act=cfg]');
  await page.waitForSelector('#au-rate', { timeout: 5000 });
  await page.click('[data-act=faster]');
  await page.click('[data-act=faster]');
  const rv = await page.$eval('#au-rate-v', (el) => el.textContent);
  if (rv !== '1,2×') throw new Error('velocidade: ' + rv);
  await page.selectOption('#au-voice', 'teste-pt-br');
  await page.click('#au-timer-chips [data-min="5"]');
  await page.waitForFunction(() => document.querySelector('#au-timer-state')?.textContent.includes('A leitura para em'), null, { timeout: 3000 });
  await page.click('[data-act=attime]');
  await page.fill('#au-time', '23:45');
  await page.click('[data-act=settime]');
  await page.waitForFunction(() => document.querySelector('#au-timer-state')?.textContent.includes('às 23:45'), null, { timeout: 3000 });
  if (await page.$eval('#player-root .p-timer', (el) => el.hidden)) throw new Error('temporizador não aparece na barra');
  await page.screenshot({ path: `${SHOT}/20b-audio-sheet.png` });
  await page.click('#au-timer-chips [data-min="0"]');
  await page.click('[data-act=ok]');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bibliaCatolica.v1')).settings);
  if (stored.ttsVoice !== 'teste-pt-br' || Math.abs(stored.ttsRate - 1.2) > 0.001 || stored.ttsTimerTime !== '23:45') throw new Error('configurações não salvas: ' + JSON.stringify(stored));
  await page.click('#player-root [data-act=stop]');
  await page.waitForFunction(() => !document.querySelector('#player-root .player') && !document.querySelector('#chapter .verse.speaking'), null, { timeout: 3000 });
});
await step('20c-audio-continue', async () => {
  await page.goto(BASE + '#/biblia/sl/116');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=tts]');
  await page.waitForFunction(() => location.hash === '#/biblia/sl/117' && document.querySelector('#player-root .p-title')?.textContent.includes('Salmos 117'), null, { timeout: 15000 });
  await page.click('#player-root [data-act=stop]');
});
await step('20d-audio-timer-stops', async () => {
  await page.goto(BASE + '#/biblia/gn/2');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=tts]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.evaluate(() => import('./js/audio.js').then((a) => a.setTimer('min', 0.02)));   // 1,2 s
  await page.waitForFunction(() => !document.querySelector('#player-root .player'), null, { timeout: 8000 });
  const toast = await page.$eval('#toast', (el) => el.textContent);
  if (!toast.includes('temporizador')) throw new Error('aviso do temporizador: ' + toast);
});
await step('20e-audio-prayer-and-settings', async () => {
  await page.goto(BASE + '#/mais/config');
  await page.waitForSelector('[data-act=audio]', { timeout: 5000 });
  await page.click('[data-act=audio]');
  await page.waitForSelector('#au-voice', { timeout: 5000 });
  await page.click('[data-act=ok]');
  await page.goto(BASE + '#/oracoes/salve-rainha');
  await page.waitForSelector('[data-act=listen]', { timeout: 5000 });
  await page.click('[data-act=listen]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.click('#player-root [data-act=stop]');
  await page.goto(BASE + '#/liturgia');
  await page.waitForFunction(() => { const b = document.querySelector('[data-act=listen-readings]'); return b && !b.hidden; }, null, { timeout: 20000 });
  await page.click('[data-act=listen-readings]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.click('#player-root [data-act=stop]');
});
await step('20f-audio-cloud', async () => {
  await page.goto(BASE + '#/biblia/gn/24');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=tts]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.click('#player-root [data-act=cfg]');
  await page.waitForSelector('#au-key', { timeout: 5000 });
  if (!(await page.$eval('[data-act=male]', (el) => el.classList.contains('on')))) throw new Error('preferência por voz masculina deveria estar ligada');
  await page.fill('#au-key', 'CHAVE-ERRADA');
  await page.click('[data-act=cloud-check]');
  await page.waitForFunction(() => document.querySelector('#au-cloud-state')?.textContent.includes('API key not valid'), null, { timeout: 5000 });
  await page.fill('#au-key', 'CHAVE-TESTE');
  await page.click('[data-act=cloud-check]');
  await page.waitForFunction(() => document.querySelector('#au-cloud-state')?.textContent.includes('4 vozes'), null, { timeout: 5000 });
  const chosen = await page.$eval('#au-cloud-voice', (el) => el.value);
  if (chosen !== 'pt-BR-Chirp3-HD-Charon') throw new Error('voz padrão deveria ser Charon (masculina, muito natural): ' + chosen);
  const first = await page.$eval('#au-cloud-voice option', (el) => el.textContent);
  if (!first.includes('masculina') || !first.includes('muito natural')) throw new Error('descrição da voz: ' + first);
  await page.click('[data-act=cloud-on]');
  await page.waitForFunction(() => !document.querySelector('#player-root .p-engine').hidden, null, { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '2', null, { timeout: 15000 });
  if (cloudCalls.synth < 2) throw new Error('o narrador na nuvem não foi chamado: ' + cloudCalls.synth);
  await page.screenshot({ path: `${SHOT}/20f-audio-cloud-sheet.png` });
  await page.click('[data-act=cloud-help]');
  await page.waitForSelector('.au-help', { timeout: 3000 });
  await page.screenshot({ path: `${SHOT}/20f-audio-cloud-help.png` });
  await page.click('.au-help [data-act=x]');
  await page.click('[data-act=ok]');
  await page.waitForFunction(() => !document.querySelector('.sheet'), null, { timeout: 3000 });
  await page.click('#player-root [data-act=toggle]');
  await page.waitForFunction(() => document.querySelector('#player-root [data-act=toggle]')?.getAttribute('aria-label') === 'Continuar', null, { timeout: 3000 });
  await page.click('#player-root [data-act=toggle]');
  await page.waitForFunction(() => document.querySelector('#player-root [data-act=toggle]')?.getAttribute('aria-label') === 'Pausar', null, { timeout: 3000 });
  await page.screenshot({ path: `${SHOT}/20f-audio-cloud-bar.png` });
  await page.click('#player-root [data-act=stop]');
  const exported = await page.evaluate(() => import('./js/store.js').then((m) => m.store.export()));
  if (exported.includes('CHAVE-TESTE')) throw new Error('a chave não pode ir no backup');
  // segunda leitura completa o cache (a primeira começou na voz do aparelho); a terceira não pode chamar o Google
  await page.click('[data-act=tts]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '2', null, { timeout: 15000 });
  await page.click('#player-root [data-act=stop]');
  await page.waitForTimeout(500);
  const synthBefore = cloudCalls.synth;
  await page.click('[data-act=tts]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '2', null, { timeout: 15000 });
  await page.click('#player-root [data-act=stop]');
  if (cloudCalls.synth !== synthBefore) throw new Error('o áudio guardado deveria ter sido reaproveitado (' + synthBefore + ' -> ' + cloudCalls.synth + ')');
  await page.evaluate(() => import('./js/store.js').then((m) => { m.store.setSetting('cloudOn', false); }));
});
await step('20g-audio-narration-intro', async () => {
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=tts]');
  await page.waitForFunction(() => document.querySelector('#player-root .p-pos')?.textContent.includes('Introdução'), null, { timeout: 5000 });
  await page.click('#player-root [data-act=next]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '1', null, { timeout: 5000 });
  await page.click('#player-root [data-act=stop]');
});
await step('20h-audio-offline', async () => {
  await page.goto(BASE + '#/biblia/jo/3');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=font]'); await page.keyboard.press('Escape');
  await page.click('[data-act=tts]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.click('#player-root [data-act=cfg]');
  await page.waitForSelector('[data-act=local-on]', { timeout: 5000 });
  await page.click('[data-act=local-on]');
  await page.waitForFunction(() => /Voz pronta|Erro/.test(document.querySelector('#au-local-state')?.textContent || ''), null, { timeout: 120000 });
  const lstate = await page.$eval('#au-local-state', (el) => el.textContent);
  if (!lstate.includes('Voz pronta')) throw new Error('narrador offline: ' + lstate);
  await page.screenshot({ path: `${SHOT}/20h-audio-offline-sheet.png` });
  await page.click('[data-act=ok]');
  await page.waitForFunction(() => !document.querySelector('.sheet'), null, { timeout: 3000 });
  await page.waitForFunction(() => { const e = document.querySelector('#player-root .p-engine'); return e && !e.hidden && e.title === 'Narrador offline'; }, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '2', null, { timeout: 120000 });
  const ended = await page.evaluate(() => new Promise((res) => { const a = document.querySelector('audio') || null; res(a ? a.duration : -1); }));
  await page.screenshot({ path: `${SHOT}/20h-audio-offline-bar.png` });
  await page.click('#player-root [data-act=stop]');
  if (!piperCalls.files.some((f) => f.endsWith('.onnx')) || !piperCalls.files.some((f) => f.startsWith('ort-wasm'))) throw new Error('runtime/modelo não foram carregados: ' + piperCalls.files.join(','));
  await page.evaluate(() => import('./js/store.js').then((m) => { m.store.setSetting('localVoiceOn', false); }));
});
await step('20i-audio-recorded', async () => {
  await page.goto(BASE + '#/biblia/mt/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=tts]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.waitForFunction(() => { const e = document.querySelector('#player-root .p-engine'); return e && !e.hidden && e.title.startsWith('Narração gravada'); }, null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#player-root .p-pos')?.textContent.includes('Introdução'), null, { timeout: 15000 });
  await page.click('#player-root [data-act=next]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '1', null, { timeout: 5000 });
  await page.click('#player-root [data-act=next]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '2', null, { timeout: 5000 });
  await page.click('#player-root [data-act=toggle]');
  await page.waitForFunction(() => document.querySelector('#player-root [data-act=toggle]')?.getAttribute('aria-label') === 'Continuar', null, { timeout: 3000 });
  await page.click('#player-root [data-act=toggle]');
  await page.waitForFunction(() => document.querySelector('#player-root [data-act=toggle]')?.getAttribute('aria-label') === 'Pausar', null, { timeout: 3000 });
  // "Ouvir" a partir do versículo 5 pela folha do versículo
  await page.click('#chapter .verse[data-v="5"]');
  await page.waitForSelector('.sheet [data-act=listen]', { timeout: 5000 });
  await page.click('.sheet [data-act=listen]');
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking')?.dataset.v === '5', null, { timeout: 8000 });
  await page.screenshot({ path: `${SHOT}/20i-audio-recorded.png` });
  await page.click('#player-root [data-act=stop]');
  if (!recCalls.some((r) => r.startsWith('alex/mt/1.json')) || !recCalls.some((r) => r.startsWith('alex/mt/1.mp3'))) throw new Error('áudio gravado não foi pedido: ' + recCalls.join(','));
  await page.click('[data-act=tts]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.click('#player-root [data-act=cfg]');
  await page.waitForSelector('#au-rec-voice', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll('#au-rec-voice option').length === 2 && document.querySelector('#au-rec-state')?.textContent.includes('Alex: 1'), null, { timeout: 5000 });
  const title = await page.$eval('#player-root .p-engine', (el) => el.title);
  if (!title.includes('Alex')) throw new Error('nome da voz na barra: ' + title);
  await page.click('[data-act=ok]');
  await page.click('#player-root [data-act=stop]');
});
await step('21-desktop', async () => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(BASE + '#/biblia/jo/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
});

console.log('\n==== ERROS (' + errors.length + ') ====');
errors.slice(0, 40).forEach((e) => console.log(e));
await browser.close();
