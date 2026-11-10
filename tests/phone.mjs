// A phone held sideways: the title must fit, a tap must start the game, the touch controls must work.
// node tests/phone.mjs [baseUrl] [outDir]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'phone-out';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pixel = devices['Pixel 7'];
const ctx = await browser.newContext({ ...pixel, viewport: { width: pixel.viewport.height, height: pixel.viewport.width } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base);
await page.waitForFunction(() => window.__game && document.getElementById('loading').hidden);
await page.waitForTimeout(800);
// does the title fit? every child of the card should be inside the viewport
const fit = await page.evaluate(() => [...document.querySelectorAll('#title > *')].filter((e) => getComputedStyle(e).display !== 'none')
  .map((e) => { const r = e.getBoundingClientRect(); return { el: e.className || e.tagName, top: Math.round(r.top), bottom: Math.round(r.bottom) }; }));
const vh = page.viewportSize().height;
console.log('viewport', page.viewportSize(), 'title blocks', JSON.stringify(fit));
if (fit.some((b) => b.top < 0 || b.bottom > vh)) errors.push('title card does not fit the screen');
await page.screenshot({ path: `${out}/phone-title.png` });
await page.touchscreen.tap(400, 200);
await page.waitForTimeout(600);
const st = await page.evaluate(() => ({ state: window.__game.S.state, mode: document.getElementById('act') ? 'ok' : '' }));
console.log('after tap', JSON.stringify(st));
if (st.state !== 'play') errors.push('tap did not start the game');
// walk with the left thumb: drag from (150, 300) upward
const cdp = await ctx.newCDPSession(page);
const p0 = await page.evaluate(() => ({ x: window.__game.S.x, z: window.__game.S.z }));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 300, id: 1 }] });
for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 300 - i * 5, id: 1 }] }); await page.waitForTimeout(30); }
await page.waitForTimeout(1500);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const p1 = await page.evaluate(() => ({ x: window.__game.S.x, z: window.__game.S.z }));
const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
console.log('thumb walk moved', moved.toFixed(2), 'm');
if (moved < 1) errors.push('touch stick did not move the kitten');
await page.screenshot({ path: `${out}/phone-play.png` });
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'phone checks pass');
await browser.close();
process.exit(errors.length ? 1 : 0);
