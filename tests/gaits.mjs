// Side-on frames of the kitten's gaits: node tests/gaits.mjs [baseUrl] [outDir]
// Strafing right turns the kitten side-on to the camera. Frames are cropped around the kitten.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'gaits-out';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// a long straight in Subnade, so strafing has room
await page.goto(base + '?play&x=150&z=-268&o=-2&yaw=0');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
await page.waitForTimeout(1200);
const crop = { x: 330, y: 250, width: 300, height: 230 };
async function frames(name, keys, n, gap) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(500);
  for (let i = 0; i < n; i++) { await page.screenshot({ path: `${out}/${name}-${i}.png`, clip: crop }); await page.waitForTimeout(gap); }
  for (const k of keys) await page.keyboard.up(k);
}
await frames('trot', ['KeyD'], 6, 45);
await page.evaluate(() => { const S = window.__game.S; S.x = 150; S.z = -268; });
await frames('gallop', ['KeyA', 'ShiftLeft'], 6, 25);
// sit: stand still for 6 s, then a three-quarter view
await page.evaluate(() => { const S = window.__game.S; S.x = 150; S.z = -268; S.head = S.yaw + 2.2; });
await page.waitForTimeout(6500);
await page.screenshot({ path: `${out}/sit-0.png`, clip: crop });
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors');
await browser.close();
