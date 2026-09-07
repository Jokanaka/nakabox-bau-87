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
  catch (e) { const lines = e.message.split('\n').filter((l) => l.trim()).slice(0, 6); console.log('FAIL', name, '-', lines.join(' | ')); errors.push(`[step ${name}] ${lines.join(' | ')}`); }
  await page.screenshot({ path: `${SHOT}/${name}.png` }).catch(() => {});
  // nenhum passo deixa áudio tocando para o seguinte (a leitura contínua mudaria de capítulo sozinha)
  await page.evaluate(() => import('./js/audio.js').then((a) => a.stop())).catch(() => {});
};

// Narração gravada: manifesto e capítulo Mt 1 servidos dos arquivos gerados localmente
const AUDIO_DIR = '/tmp/claude-0/-home-user-nakabox-bau-87/972f22bb-545c-5ad0-ac6c-c883efe8c07c/scratchpad/audio_out';
const recCalls = [];
await page.route('**/data/audio.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ base: 'https://cdn.jsdelivr.net/gh/jokanaka/nakabox-bau-87@test/', fallback: '', voices: { alex: { name: 'Alex', desc: 'masculina', books: { mt: 1 } }, santa: { name: 'Santa', desc: 'masculina, mais grave', books: { mt: 1 } }, dora: { name: 'Dora', desc: 'feminina', books: {} } } }) }));
await page.route(/cdn\.jsdelivr\.net\/gh\/jokanaka\/nakabox-bau-87@test\//, (route) => {
  const u = new URL(route.request().url()); const rel = u.pathname.split('@test/')[1]; recCalls.push(rel + (route.request().headers()['range'] ? ' [range]' : ''));
  let local = `${AUDIO_DIR}/${rel}`;
  if (!fs.existsSync(local) && rel.startsWith('santa/mt/')) local = `${AUDIO_DIR}/${rel.replace(/^santa\//, 'alex/')}`;   // Santa usa os arquivos do Alex no teste
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
await step('00-simple-mode', async () => {
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  if (await page.$('[data-act=ver]')) throw new Error('no modo simples o seletor de versão não deve aparecer');
  await page.click('[data-act=tts]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  // a voz gravada escolhida (Alex) ainda não tem Gênesis 1: o app avisa na hora de começar
  await page.waitForFunction(() => /Alex ainda não gravou Gênesis 1/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 5000 });
  await page.click('#player-root [data-act=cfg]');
  await page.waitForSelector('.sheet [data-act=voice]', { timeout: 5000 });
  if (await page.$('#au-key') || await page.$('#au-pitch') || await page.$('#au-voice')) throw new Error('modo simples não deveria mostrar nuvem/tom/seletor antigo');
  await page.waitForFunction(() => /ainda não tem narração gravada/.test(document.querySelector('#au-now')?.textContent || '') && /Lendo agora/.test(document.querySelector('#au-now')?.textContent || ''), null, { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/00-simple-sheet.png` });
  // tela "Voz da leitura": três vozes gravadas + voz do celular, versão do app, capítulo aberto sem gravação
  await page.click('.sheet [data-act=voice]');
  await page.waitForSelector('#voz .voz-card[data-kind=rec][data-id=alex]', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll('#voz .voz-card[data-kind=rec]').length === 3 && document.querySelector('#voz .voz-card[data-kind=dev]') && document.querySelector('#voz .voz-card[data-id=alex].on') && /Versão do app \d+/.test(document.querySelector('#voz .voz-status')?.textContent || ''), null, { timeout: 5000 });
  if (!/Ainda não gravou Gênesis 1/.test(await page.$eval('#voz .voz-card[data-id=alex] .voz-note', (el) => el.textContent))) throw new Error('nota do Alex: ' + await page.$eval('#voz .voz-card[data-id=alex] .voz-note', (el) => el.textContent));
  if (await page.$('#voz-dev')) throw new Error('modo simples não deveria listar as vozes do celular');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${SHOT}/00-voice-picker.png` });
  await page.click('#voz [data-act=x]');
  await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 3000 });
  // em Gênesis 1 (sem gravação) quem lê é a voz do celular: o botão mostra a voz que está lendo de fato
  if (!/Celular|teste/.test(await page.$eval('#player-root .p-voice', (el) => el.textContent))) throw new Error('botão Voz na barra: ' + await page.$eval('#player-root .p-voice', (el) => el.textContent));
  await page.click('#player-root [data-act=cfg]');
  await page.waitForSelector('[data-act=advanced]', { timeout: 5000 });
  await page.click('[data-act=advanced]');
  await page.waitForSelector('#au-key', { timeout: 5000 });
  await page.click('[data-act=ok]');
  await page.click('#player-root [data-act=stop]');
  await page.goto(BASE + '#/biblia/gn/3');
  await page.waitForSelector('[data-act=ver]', { timeout: 5000 });
  await page.goto(BASE + '#/mais/config');
  await page.waitForSelector('[data-k=uiMode] button.on', { timeout: 5000 });
  const mode = await page.$eval('[data-k=uiMode] button.on', (el) => el.dataset.v);
  if (mode !== 'avancado') throw new Error('modo: ' + mode);
});
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
  // qual voz do celular (modo avançado, na tela de voz): só define a voz do celular, sem mudar a escolha principal
  await page.click('.sheet [data-act=voice]');
  await page.waitForSelector('#voz-dev', { timeout: 5000 });
  await page.selectOption('#voz-dev', 'teste-pt-br');
  await page.waitForFunction(() => /Voz do celular: Voz de teste/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 5000 });
  await page.click('#voz [data-act=x]');
  await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 3000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bibliaCatolica.v1')).settings.ttsVoice === 'teste-pt-br', null, { timeout: 3000 });   // o salvamento tem um pequeno atraso
  const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('bibliaCatolica.v1')).settings);
  if (stored2.ttsVoice !== 'teste-pt-br' || stored2.recordedOn === false) throw new Error('voz do celular não guardada (ou a escolha principal mudou): ' + JSON.stringify(stored2));
  await page.click('#player-root [data-act=cfg]');
  await page.waitForSelector('#au-timer-chips', { timeout: 5000 });
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
  if (Math.abs(stored.ttsRate - 1.2) > 0.001 || stored.ttsTimerTime !== '23:45') throw new Error('configurações não salvas: ' + JSON.stringify(stored));
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
  await page.waitForSelector('.sheet [data-act=voice]', { timeout: 5000 });
  await page.click('[data-act=ok]');
  await page.click('[data-act=voz]');
  await page.waitForSelector('#voz .voz-card[data-id=dora]', { timeout: 5000 });
  await page.click('#voz [data-act=x]');
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
  if (!(await page.evaluate(() => JSON.parse(localStorage.getItem('bibliaCatolica.v1')).settings.ttsMale))) throw new Error('preferência por voz masculina deveria estar ligada');
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
  try {
    await page.waitForFunction(() => { const e = document.querySelector('#player-root .p-engine'); return e && !e.hidden && e.title.startsWith('Narração gravada'); }, null, { timeout: 15000 });
  } catch (e) {
    const diag = await page.evaluate(() => import('./js/audio.js').then(async (a) => { const m = await import('./js/store.js'); return JSON.stringify({ avail: a.recordedAvailable('mt', 1), voice: a.recordedVoiceFor('mt', 1), voices: a.recordedVoices().map((v) => v.id + ':' + v.count), recOn: m.store.settings.recordedOn, ver: m.store.settings.version, recVoice: m.store.settings.recordedVoice, toast: document.querySelector('#toast')?.textContent, engine: a.engineName() }); }));
    throw new Error('motor gravado não iniciou: ' + diag);
  }
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
  await page.waitForSelector('.sheet [data-act=voice]', { timeout: 5000 });
  const title = await page.$eval('#player-root .p-engine', (el) => el.title);
  if (!title.includes('Alex')) throw new Error('nome da voz na barra: ' + title);
  if (!/Mateus 1 tem narração gravada \(Alex, Santa\)/.test(await page.$eval('#au-now', (el) => el.textContent))) throw new Error('lendo agora: ' + await page.$eval('#au-now', (el) => el.textContent));
  await page.click('[data-act=ok]');
  // botão Voz na barra abre a tela de voz: troca para Santa no meio da leitura (recomeça no versículo atual)
  const openVoz = async () => { await page.click('#player-root [data-act=voice]'); await page.waitForSelector('#voz .voz-card[data-id=alex] [data-act=pick]', { timeout: 5000 }); await page.waitForTimeout(250); };
  const closeVoz = async () => { await page.click('#voz [data-act=x]'); await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 3000 }); };
  await openVoz();
  if (!/Lê Mateus 1/.test(await page.$eval('#voz .voz-card[data-id=santa] .voz-note', (el) => el.textContent))) throw new Error('nota da Santa: ' + await page.$eval('#voz .voz-card[data-id=santa] .voz-note', (el) => el.textContent));
  await page.click('#voz .voz-card[data-id=santa] [data-act=pick]');
  await page.waitForFunction(() => (document.querySelector('#player-root .p-engine')?.title || '').includes('Santa') && /Santa/.test(document.querySelector('#player-root .p-voice')?.textContent || '') && document.querySelector('#voz .voz-card[data-id=santa].on'), null, { timeout: 8000 });
  await closeVoz();
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking'), null, { timeout: 8000 });
  if (!recCalls.some((r) => r.startsWith('santa/mt/1.mp3'))) throw new Error('áudio da Santa não foi pedido: ' + recCalls.join(','));
  // Dora ainda não tem o capítulo: avisa e continua com a Santa
  await openVoz();
  await page.click('#voz .voz-card[data-id=dora] [data-act=pick]');
  await page.waitForFunction(() => /Dora ainda não gravou Mateus 1/.test(document.querySelector('#toast')?.textContent || ''), null, { timeout: 5000 });
  if (!(await page.$eval('#player-root .p-engine', (el) => el.title)).includes('Santa')) throw new Error('a voz deveria continuar Santa');
  await closeVoz();
  // voz do celular no meio da narração gravada, e volta para o Alex (gravada) a partir do versículo atual
  await openVoz();
  await page.click('#voz .voz-card[data-kind=dev] [data-act=pick]');
  await page.waitForFunction(() => document.querySelector('#player-root .p-engine')?.hidden === true && document.querySelector('#voz .voz-card[data-kind=dev].on'), null, { timeout: 8000 });
  await closeVoz();
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking'), null, { timeout: 8000 });
  await openVoz();
  await page.screenshot({ path: `${SHOT}/20i-voice-picker.png` });
  await page.click('#voz .voz-card[data-id=alex] [data-act=pick]');
  await page.waitForFunction(() => (document.querySelector('#player-root .p-engine')?.title || '').includes('Alex') && document.querySelector('#voz .voz-card[data-id=alex].on'), null, { timeout: 8000 });
  await closeVoz();
  await page.waitForFunction(() => document.querySelector('#chapter .verse.speaking'), null, { timeout: 8000 });
  await page.screenshot({ path: `${SHOT}/20i-voice-switch.png` });
  await page.click('#player-root [data-act=stop]');
});
await step('22-progress', async () => {
  await page.goto(BASE + '#/biblia/gn/2');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.waitForTimeout(8300);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => document.querySelector('#read-flag') && !document.querySelector('#read-flag').hidden, null, { timeout: 5000 });
  const read = await page.evaluate(() => import('./js/store.js').then((m) => m.store.isRead('gn', 2)));
  if (!read) throw new Error('capítulo não marcado como lido');
  await page.goto(BASE + '#/mais/progresso');
  await page.waitForSelector('.progress-list', { timeout: 5000 });
  const txt = await page.$eval('.progress-list', (el) => el.textContent);
  if (!txt.includes('Gênesis') || !/[1-9]\/50/.test(txt)) throw new Error('progresso de Gênesis: ' + txt.slice(0, 80));
  await page.screenshot({ path: `${SHOT}/22-progress-page.png` });
  await page.goto(BASE + '#/biblia/gn/2');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=pick]');
  await page.waitForSelector('#bk-list .book-row', { timeout: 5000 });
  const cnt = await page.$eval('.book-row[data-b="gn"] .cnt', (el) => el.textContent);
  if (!/\d+\/50/.test(cnt)) throw new Error('contagem no seletor: ' + cnt);
  await page.keyboard.press('Escape');
});
await step('23-missa', async () => {
  await page.goto(BASE + '#/missa');
  await page.waitForFunction(() => { const b = document.querySelector('#missa-readings'); return b && !b.textContent.includes('Carregando'); }, null, { timeout: 20000 });
  await page.click('[data-act=start]');
  await page.waitForSelector('.missa-step', { timeout: 30000 });
  let found = false;
  for (let k = 0; k < 12; k++) {
    if (await page.$('.missa-step .reading-text .rv')) { found = true; break; }
    await page.click('#missa [data-act=next]');
    await page.waitForTimeout(150);
  }
  if (!found) throw new Error('nenhuma leitura com texto apareceu');
  await page.screenshot({ path: `${SHOT}/23-missa-reading.png` });
  await page.click('#missa [data-act=listen]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('.missa-step .rv.speaking'), null, { timeout: 5000 });
  if (!/Parar/.test(await page.$eval('#missa [data-act=listen]', (el) => el.textContent))) throw new Error('botão Ouvir não virou Parar');
  await page.screenshot({ path: `${SHOT}/23-missa-playing.png` });
  // a barra do player fica por cima da tela da Missa: parar por ela tem de funcionar
  await page.click('#player-root [data-act=stop]', { timeout: 5000 });
  await page.waitForFunction(() => /Ouvir/.test(document.querySelector('#missa [data-act=listen]').textContent) && !document.querySelector('.missa-step .rv.speaking'), null, { timeout: 3000 });
  await page.click('#missa [data-act=listen]');
  await page.waitForSelector('#player-root .player', { timeout: 5000 });
  await page.click('#missa [data-act=listen]');   // Parar pelo próprio botão
  await page.waitForFunction(() => !document.querySelector('#player-root .player'), null, { timeout: 3000 });
  await page.click('#missa [data-act=x]');
  await page.waitForFunction(() => !document.querySelector('.modal') && !document.body.classList.contains('modal-open'), null, { timeout: 3000 });
});
await step('24-profiles', async () => {
  await page.goto(BASE + '#/inicio');
  await page.waitForSelector('[data-act=profile]', { timeout: 5000 });
  const chip0 = await page.$eval('[data-act=profile]', (el) => el.textContent.trim());
  if (!chip0.includes('Eu')) throw new Error('perfil inicial: ' + chip0);
  await page.click('[data-act=profile]');
  await page.waitForSelector('#profiles [data-act=new]', { timeout: 5000 });
  await page.click('#profiles [data-act=new]');
  await page.waitForSelector('#pf-name', { timeout: 5000 });
  await page.fill('#pf-name', 'Mãe');
  await page.click('.pf-emoji[data-e="👩"]');
  await page.click('[data-act=save]');
  await page.waitForFunction(() => /Mãe/.test(document.querySelector('[data-act=profile]')?.textContent || ''), null, { timeout: 15000 });
  const info = await page.evaluate(() => import('./js/store.js').then((m) => ({ name: m.store.profile.name, emoji: m.store.profile.emoji, n: m.store.profiles.length, read: m.store.isRead('gn', 2) })));
  if (info.name !== 'Mãe' || info.emoji !== '👩' || info.n !== 2 || info.read) throw new Error('perfil novo: ' + JSON.stringify(info));
  await page.screenshot({ path: `${SHOT}/24-profiles-mae.png` });
  // volta ao primeiro perfil: os dados dele continuam lá (Gênesis 2 lido no passo 22)
  await page.click('[data-act=profile]');
  await page.waitForSelector('#profiles [data-switch="p1"]', { timeout: 5000 });
  await page.click('#profiles [data-switch="p1"]');
  await page.waitForFunction(() => /Eu/.test(document.querySelector('[data-act=profile]')?.textContent || ''), null, { timeout: 15000 });
  const back = await page.evaluate(() => import('./js/store.js').then((m) => ({ name: m.store.profile.name, read: m.store.isRead('gn', 2), n: m.store.profiles.length })));
  if (back.name !== 'Eu' || !back.read || back.n !== 2) throw new Error('voltar ao perfil: ' + JSON.stringify(back));
  // a tela "Mais" mostra o perfil e abre a lista
  await page.goto(BASE + '#/mais');
  await page.waitForSelector('[data-act=profile]', { timeout: 5000 });
  await page.click('[data-act=profile]');
  await page.waitForSelector('#profiles .profile-row', { timeout: 5000 });
  const rows = await page.$$eval('#profiles .profile-row', (els) => els.length);
  if (rows !== 2) throw new Error('perfis listados: ' + rows);
});
await step('25-daily-prayers', async () => {
  await page.goto(BASE + '#/oracoes');
  await page.waitForSelector('[data-daily="new"]', { timeout: 5000 });
  await page.click('[data-daily="new"]');
  await page.waitForSelector('#rt-name', { timeout: 5000 });
  await page.click('[data-preset="0"]');   // modelo "Manhã"
  await page.waitForFunction(() => document.querySelectorAll('#rt-order .routine-item').length === 6, null, { timeout: 5000 });
  await page.click('[data-pick="rosario"]');
  await page.waitForFunction(() => document.querySelectorAll('#rt-order .routine-item').length === 7, null, { timeout: 5000 });
  const nm = await page.$eval('#rt-name', (el) => el.value);
  if (nm !== 'Manhã') throw new Error('nome do modelo: ' + nm);
  await page.click('[data-act=save]');
  await page.waitForSelector('[data-routine]', { timeout: 5000 });
  const st0 = await page.$eval('.rt-status', (el) => el.textContent);
  if (!/0 de 7/.test(st0)) throw new Error('status inicial: ' + st0);
  await page.click('[data-chk][data-item="sinal-da-cruz"]');
  await page.waitForFunction(() => /1 de 7/.test(document.querySelector('.rt-status')?.textContent || ''), null, { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/25-daily-list.png` });
  // "Rezar em sequência" abre a próxima oração não rezada, com o botão "Rezei"
  await page.click('[data-act=seq]');
  await page.waitForSelector('[data-act=prayed]', { timeout: 5000 });
  const hash1 = await page.evaluate(() => location.hash);
  if (!hash1.startsWith('#/oracoes/oferecimento?rotina=')) throw new Error('sequência: ' + hash1);
  await page.click('[data-act=prayed]');
  await page.waitForFunction(() => location.hash.startsWith('#/oracoes/pai-nosso?rotina='), null, { timeout: 5000 });
  await page.goto(BASE + '#/oracoes/dia');
  await page.waitForFunction(() => /2 de 7/.test(document.querySelector('.rt-status')?.textContent || ''), null, { timeout: 5000 });
  // o Rosário rezado no app conta no grupo
  await page.evaluate(() => import('./js/store.js').then((m) => m.store.rosaryDone('rosario')));
  await page.goto(BASE + '#/oracoes');   // muda de tela e volta: a lista é desenhada de novo
  await page.goto(BASE + '#/oracoes/dia');
  await page.waitForFunction(() => /3 de 7/.test(document.querySelector('.rt-status')?.textContent || ''), null, { timeout: 5000 });
  // início e tela de orações mostram o andamento
  await page.goto(BASE + '#/inicio');
  await page.waitForSelector('#home-daily', { timeout: 5000 });
  const home = await page.$eval('#home-daily', (el) => el.textContent);
  if (!/3 de 7/.test(home)) throw new Error('início: ' + home);
  await page.goto(BASE + '#/oracoes');
  await page.waitForSelector('[data-daily="list"]', { timeout: 5000 });
});
await step('26-reader-today', async () => {
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.waitForSelector('#today', { timeout: 5000 });
  const label = await page.$eval('#today .tp-label', (el) => el.textContent);
  if (!label.includes('Gênesis 1') || !label.includes('capítulo 1 de 50')) throw new Error('rótulo: ' + label);
  const pct0 = await page.$eval('#tp-pct', (el) => el.textContent);
  if (!/faltam \d+% do capítulo/.test(pct0)) throw new Error('percentual: ' + pct0);
  const chips = await page.$$eval('#today-chips .chip', (els) => els.map((e) => e.textContent.trim()));
  if (chips.length < 4 || !chips.some((c) => /Orações 3\/7/.test(c)) || !chips.some((c) => /Gozosos|Dolorosos|Gloriosos|Luminosos/.test(c))) throw new Error('chips: ' + chips.join(' | '));
  await page.waitForFunction(() => /Evangelho|Missa/.test(document.querySelector('#chip-missa')?.textContent || ''), null, { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/26-reader-today-top.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => /fim do capítulo/.test(document.querySelector('#tp-pct')?.textContent || ''), null, { timeout: 5000 });
  // a configuração esconde só os atalhos do dia; o progresso do capítulo continua
  await page.evaluate(() => import('./js/store.js').then((m) => m.store.setSetting('todayStrip', false)));
  await page.goto(BASE + '#/biblia/gn/3');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  if (await page.$('#today-chips')) throw new Error('atalhos do dia deviam estar escondidos');
  if (!(await page.$('#tp-pct'))) throw new Error('o progresso do capítulo deve continuar');
  await page.evaluate(() => import('./js/store.js').then((m) => m.store.setSetting('todayStrip', true)));
});
await step('27-resume-position', async () => {
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.evaluate(() => document.querySelector('#v20').scrollIntoView());
  // (waitForFunction não espera promessas: consulta a store em laço)
  const readPos = () => page.evaluate(() => import('./js/store.js').then((m) => m.store.readPos('gn', 1)));
  const until = async (fn, ms = 5000) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error('tempo esgotado à espera da posição'); await page.waitForTimeout(150); } };
  await until(async () => (await readPos()) >= 18);
  await page.goto(BASE + '#/inicio');
  await page.waitForSelector('#home-daily', { timeout: 5000 });
  const card = await page.$eval('a[href="#/biblia/gn/1"]', (el) => el.textContent);
  if (!/versículo \d+/.test(card)) throw new Error('cartão continuar lendo: ' + card);
  await page.goto(BASE + '#/biblia/gn/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.waitForFunction(() => window.scrollY > 100, null, { timeout: 5000 });
  const topV = await page.evaluate(() => { const tb = document.querySelector('.topbar'); const off = (tb ? tb.getBoundingClientRect().height : 0) + 6; for (const p of document.querySelectorAll('#chapter .verse')) { if (p.getBoundingClientRect().bottom > off) return +p.dataset.v; } return 1; });
  if (Math.abs(topV - 20) > 2) throw new Error('retomou no versículo ' + topV);
  await page.screenshot({ path: `${SHOT}/27-resume.png` });
  // concluir o capítulo apaga a posição (o capítulo reabre do início) e o próximo abre do início
  await page.evaluate(() => import('./js/store.js').then((m) => m.store.setReadPos('gn', 2, 0)));
  await page.click('.ch-nav [data-act=done]');
  await until(async () => (await readPos()) === 0);
  await page.waitForFunction(() => location.hash === '#/biblia/gn/2' && document.querySelector('#chapter .verse'), null, { timeout: 15000 });
  if (await page.evaluate(() => window.scrollY) > 50) throw new Error('capítulo sem posição salva devia abrir do início');
  await page.evaluate(() => import('./js/store.js').then((m) => m.store.markRead('gn', 1, false)));
});
await step('28-audio-emenda-capitulo', async () => {
  await page.goto(BASE + '#/biblia/2jo/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.evaluate(() => import('./js/store.js').then((m) => { m.store.markRead('2jo', 1, false); m.store.setSetting('ttsContinue', true); }));
  await page.click('[data-act=tts]');
  // ao terminar o capítulo a leitura emenda o próximo sozinha e a página acompanha
  await page.waitForFunction(() => location.hash === '#/biblia/3jo/1', null, { timeout: 60000 });
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  const at = await page.evaluate(() => import('./js/audio.js').then((a) => ({ active: a.isActive(), ref: a.currentRef() })));
  if (!at.active || !at.ref || at.ref.book !== '3jo') throw new Error('não emendou o próximo capítulo: ' + JSON.stringify(at));
  const lido = await page.evaluate(() => import('./js/store.js').then((m) => m.store.isRead('2jo', 1)));
  if (!lido) throw new Error('o capítulo terminado devia ficar marcado como lido');
  const botao = await page.$eval('[data-act=tts]', (el) => el.classList.contains('active'));
  if (!botao) throw new Error('o botão de ouvir devia continuar ligado no capítulo novo');
});
await step('29-audio-retoma-apos-pausa-do-sistema', async () => {
  await page.goto(BASE + '#/biblia/mt/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
  await page.click('[data-act=tts]');
  await page.waitForFunction(() => { const e = document.querySelector('#player-root .p-engine'); return e && !e.hidden && /gravada/.test(e.title || ''); }, null, { timeout: 20000 });
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused; }, null, { timeout: 10000 });
  // o sistema pausa por fora (tela de bloqueio, fone, outro app): o app precisa perceber e voltar a tocar
  await page.evaluate(() => document.querySelector('audio').pause());
  await page.waitForFunction(() => document.querySelector('#player-root [data-act=toggle]')?.getAttribute('aria-label') === 'Continuar', null, { timeout: 5000 });
  await page.click('#player-root [data-act=toggle]');
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused; }, null, { timeout: 5000 });
  await page.screenshot({ path: `${SHOT}/29-audio-retoma.png` });
});
await step('21-desktop', async () => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(BASE + '#/biblia/jo/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
});

console.log('\n==== ERROS (' + errors.length + ') ====');
errors.slice(0, 40).forEach((e) => console.log(e));
await browser.close();
