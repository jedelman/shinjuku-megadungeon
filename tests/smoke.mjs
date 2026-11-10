// Headless look at the game: node tests/smoke.mjs [baseUrl] [outDir]
// Loads the built game, checks for errors, takes screenshots at a few real places, reports fps.
import { createRequire } from 'node:module';
// playwright is installed globally in the cloud sandbox; require() finds it from anywhere
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'smoke-out';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shots = [
  ['start', 'play&fps'],
  // points on level 0's route, a quarter, half and three quarters of the way
  ['route-25', 'play&fps&x=178.61&z=-261.56&o=-2'],
  ['route-50', 'play&fps&x=113.72&z=-135.06&o=-2'],
  ['route-75', 'play&fps&x=-59.16&z=-2.36&o=-1'],
  ['goal', 'play&fps&x=-85&z=250&o=-1&yaw=2.6'],
];
for (const [name, q] of shots) {
  await page.goto(base + '?' + q);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ fps: window.__game.S.fps, where: document.getElementById('where').textContent, goal: document.getElementById('goal').textContent }));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(st));
}
// the kitten, face on
await page.goto(base + '?play&x=178.61&z=-261.56&o=-2');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
await page.evaluate(() => { const S = window.__game.S; S.head = S.yaw; S.pitch = 0.18; });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/kitten-portrait.png` });

// cornered: back the kitten against a real wall so the camera sits behind it; the wall must go see-through
async function cornered(name, kindWanted, x0, z0, o) {
  await page.goto(base + `?play&x=${x0}&z=${z0}&o=${o}`);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
  const info = await page.evaluate(([kind, x0, z0, o]) => {
    const g = window.__game, f = g.data.floors[o.toFixed(1)], n = g.nav(o);
    let best = null, bd = 1e9;
    for (const [x1, z1, x2, z2, k] of f.walls) {
      const L = Math.hypot(x2 - x1, z2 - z1);
      if (k !== kind || L < 1.5) continue;
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, d = Math.hypot(mx - x0, mz - z0);
      if (d >= bd) continue;
      const nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
      for (const s of [1, -1]) {
        const px = mx + s * nx * 0.35, pz = mz + s * nz * 0.35;
        if (n.inside(px, pz) && !n.inside(mx - s * nx * 0.6, mz - s * nz * 0.6)) { bd = d; best = { px, pz, nx: s * nx, nz: s * nz }; }
      }
    }
    if (!best) return null;
    const S = g.S;
    S.x = best.px; S.z = best.pz; S.yaw = Math.atan2(-best.nx, -best.nz); S.head = S.yaw; S.pitch = 0.3;
    return best;
  }, [kindWanted, x0, z0, o]);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, info ? 'placed' : 'no wall found');
}
await cornered('cornered-shopfront', 'shop', 178.61, -261.56, -2);
await cornered('cornered-wall', 'room', -59.16, -2.36, -1);

// walk forward for 3 s and confirm we moved and stayed inside
await page.goto(base + '?play');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
const p0 = await page.evaluate(() => ({ x: window.__game.S.x, z: window.__game.S.z }));
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => ({ x: window.__game.S.x, z: window.__game.S.z, walked: window.__game.S.walked }));
console.log('walk', JSON.stringify({ p0, p1 }));

// ride: stand at the bottom of a B2 -> B1 connector, press E, arrive on B1
async function rideFrom(fromO, toO, wantOutside) {
  await page.goto(base + '?play');
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
  const info = await page.evaluate(([a, b, wantOut]) => {
    const g = window.__game, d = g.data;
    for (const c of d.conns) {
      const A = d.nodes[c.a], B = d.nodes[c.b];
      const [lo, hi] = A[2] === a ? [A, B] : B[2] === a ? [B, A] : [null, null];
      if (!lo || hi[2] !== b || c.t === 4) continue;
      g.S.x = lo[0]; g.S.z = lo[1]; g.S.o = lo[2];
      return { at: lo, to: hi, t: c.t };
    }
    return null;
  }, [fromO, toO, wantOutside]);
  await page.keyboard.press('KeyE');
  await page.waitForFunction((o) => window.__game.S.o === o && !window.__game.S.ride, toO, { timeout: 20000 });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => ({ o: window.__game.S.o, outside: window.__game.S.outside, surfaced: window.__game.S.surfaced, where: document.getElementById('where').textContent, cold: !document.getElementById('cold').hidden }));
  await page.screenshot({ path: `${out}/ride-${fromO}-to-${toO}.png` });
  console.log('ride', JSON.stringify({ info, st }));
  return st;
}
const r1 = await rideFrom(-2, -1, false);
if (r1.o !== -1) errors.push('ride B2->B1 failed');
const r2 = await rideFrom(-1, 0, true);
if (r2.o !== 0) errors.push('ride B1->street failed');

// finish: step into the goal
await page.goto(base + '?play');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
await page.evaluate(() => { const g = window.__game; g.S.x = g.goal.x + 2; g.S.z = g.goal.z; g.S.o = g.goal.o; g.S.t0 = performance.now() - 754000; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
await page.waitForTimeout(500);
const done = await page.evaluate(() => ({ done: window.__game.S.done, text: document.getElementById('done-text').textContent }));
await page.screenshot({ path: `${out}/done.png` });
console.log('finish', JSON.stringify(done));
if (!done.done) errors.push('finishing the level failed');

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
