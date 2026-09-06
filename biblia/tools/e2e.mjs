import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:8765/index.html';
const SHOT = '/tmp/claude-0/-home-user-nakabox-bau-87/972f22bb-545c-5ad0-ac6c-c883efe8c07c/scratchpad/shots';
fs.mkdirSync(SHOT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(async () => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });

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
  await page.goto(BASE + '#/inicio');
  await page.waitForTimeout(1500);
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'active' : 'registered') : 'none'; });
  console.log('   service worker:', sw);
});
await step('21-desktop', async () => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(BASE + '#/biblia/jo/1');
  await page.waitForSelector('#chapter .verse', { timeout: 15000 });
});

console.log('\n==== ERROS (' + errors.length + ') ====');
errors.slice(0, 40).forEach((e) => console.log(e));
await browser.close();
