// Headless look at the game: node tests/smoke.mjs [baseUrl] [outDir]
// Loads the built game, checks for errors, takes screenshots at a few real places, reports fps.
import { createRequire } from 'node:module';
// playwright is installed globally in the cloud sandbox; require() finds it from anywhere
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
import { longDate } from '../src/sky.js';

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
  const st = await page.evaluate(() => { const g = window.__game; return { fps: g.S.fps, floor: g.nav(g.S.o).inside(g.S.x, g.S.z), where: document.getElementById('where').textContent, goal: document.getElementById('goal').textContent }; });
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(st));
  // a spot off the walkable area screenshots the void beside a corridor and proves nothing
  if (!st.floor) errors.push(`${name}: spawn spot is off the walkable area`);
  if (st.goal.includes('—')) errors.push(`${name}: no route to the goal from here`);
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


// people: pick up a lost thing, return it at the counter, listen to a lost person before and after visiting their place
await page.goto(base + '?play');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
await page.evaluate(() => localStorage.clear());
await page.goto(base + '?play&day=2026-11-10');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
const said = () => page.evaluate(() => document.getElementById('say').textContent);
const it0 = await page.evaluate(() => { const g = window.__game, it = g.people.items[0]; g.S.x = it.x; g.S.z = it.z; g.S.o = it.o; return it.ja; });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/people-item.png` });
await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
const s1 = await said();
const bag = await page.evaluate(() => window.__game.people.bag.length);
console.log('pickup', it0, JSON.stringify({ bag, said: s1.slice(0, 80) }));
if (bag !== 1) errors.push('picking up lost property failed');
await page.evaluate(() => { const g = window.__game, c = g.people.counter; g.S.x = c.x + 0.8; g.S.z = c.z; g.S.o = c.o; g.S.yaw = Math.PI / 2; });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/people-counter.png` });
await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
const s2 = await said();
const rw = await page.evaluate(() => window.__game.store.data.rewards);
console.log('return', JSON.stringify({ rewards: rw, said: s2.slice(0, 120) }));
if (!rw.includes('lantern')) errors.push('returning lost property gave no reward');
const w0 = await page.evaluate(() => { const g = window.__game, w = g.people.wanderers[0]; g.S.x = w.x + 1.2; g.S.z = w.z; g.S.o = w.o; g.S.yaw = Math.PI / 2; return w.dest.name; });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/people-wanderer.png` });
await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
const s3 = await said();
await page.evaluate(() => { const g = window.__game; g.visited.add(g.people.wanderers[0].dest.key); });
await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
const s4 = await said();
const led = await page.evaluate(() => window.__game.people.wanderers[0].state);
console.log('wanderer', w0, JSON.stringify({ before: s3.slice(-40), after: s4.slice(-60), state: led }));
if (!s3.includes("haven't been") || led !== 'led') errors.push('helping a lost person failed');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/people-led.png` });

// Tokyo: choose it on the title with the keyboard, then visit the route and finish it
await page.goto(base);
await page.waitForFunction(() => window.__game && document.getElementById('loading').hidden);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.S.state === 'play' && window.__game.level.station === 'tokyo', null, { timeout: 60000 });
await page.waitForTimeout(1500);
const t0 = await page.evaluate(() => ({ where: document.getElementById('where').textContent, goal: document.getElementById('goal').textContent, x: window.__game.S.x }));
await page.screenshot({ path: `${out}/tokyo-start.png` });
console.log('tokyo via title', JSON.stringify(t0));
if (!t0.goal.includes('大手町')) errors.push('Tokyo level did not load from the title');
for (const [name, x, z, o] of [['tokyo-33', -376.5, 949.53, -1], ['tokyo-66', -452.66, -23.68, -1], ['tokyo-90', -135.34, -462.15, -2]]) {
  await page.goto(base + `?level=1&play&fps&x=${x}&z=${z}&o=${o}`);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => { const g = window.__game; return { fps: g.S.fps, floor: g.nav(g.S.o).inside(g.S.x, g.S.z), where: document.getElementById('where').textContent, goal: document.getElementById('goal').textContent }; });
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(st));
  // a spot off the walkable area screenshots the void beside a corridor and proves nothing
  if (!st.floor) errors.push(`${name}: spawn spot is off the walkable area`);
  if (st.goal.includes('—')) errors.push(`${name}: no route to the goal from here`);
}
await page.goto(base + '?level=1&play');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
await page.evaluate(() => { const g = window.__game; g.S.x = g.goal.x + 2; g.S.z = g.goal.z; g.S.o = g.goal.o; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
await page.waitForTimeout(500);
const td = await page.evaluate(() => ({ done: window.__game.S.done, text: document.getElementById('done-text').textContent }));
console.log('tokyo finish', JSON.stringify(td));
if (!td.done) errors.push('finishing the Tokyo level failed');


// Astra's route: pick it on the title, look at the way, finish it
await page.goto(base);
await page.waitForFunction(() => window.__game && document.getElementById('loading').hidden);
await page.keyboard.press('Digit2');
await page.waitForTimeout(200);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game.S.state === 'play' && window.__game.level.station === 'shinjuku-astra', null, { timeout: 60000 });
await page.waitForTimeout(1500);
const a0 = await page.evaluate(() => ({ where: document.getElementById('where').textContent, goal: document.getElementById('goal').textContent }));
await page.screenshot({ path: `${out}/astra-start.png` });
console.log('astra via title', JSON.stringify(a0));
if (!a0.goal.includes('西新宿')) errors.push("Astra's route did not load from the title");
for (const [name, x, z, o] of [['astra-promenade', 249.4, -93.6, -1], ['astra-4go', -311.25, -28.91, -1], ['astra-tochomae', -660, 40, -1], ['astra-times-ave', -702.41, -139.92, -1]]) {
  await page.goto(base + `?level=2&play&fps&x=${x}&z=${z}&o=${o}`);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => { const g = window.__game; return { fps: g.S.fps, floor: g.nav(g.S.o).inside(g.S.x, g.S.z), where: document.getElementById('where').textContent, goal: document.getElementById('goal').textContent }; });
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(st));
  // a spot off the walkable area screenshots the void beside a corridor and proves nothing
  if (!st.floor) errors.push(`${name}: spawn spot is off the walkable area`);
  if (st.goal.includes('—')) errors.push(`${name}: no route to the goal from here`);
}
await page.goto(base + '?level=2&play');
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
await page.evaluate(() => { const g = window.__game; g.S.x = g.goal.x + 2; g.S.z = g.goal.z; g.S.o = g.goal.o; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
await page.waitForTimeout(500);
const ad = await page.evaluate(() => ({ done: window.__game.S.done, text: document.getElementById('done-text').textContent }));
console.log('astra finish', JSON.stringify(ad));
if (!ad.done) errors.push("finishing Astra's route failed");

// The quilt (patches after Rise Up Comus), replayed by address: a chart makes the patch. Four exact patches under the
// sky of 1988-08-08, which deals I The Magician (two portals: I divides everything) and a sealed way up.
const NIGHT = 'chart=1988-08-08&patches=the-vending-machine-choir@2053-08-02,three-chalk-cats@2077-01-28,the-last-shutter@2066-03-19,the-man-who-still-commutes@1979-08-18';
await page.goto(base + `?level=0&play&day=2026-11-10&${NIGHT}`);
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.quilt);
const skyText = await page.evaluate(() => document.getElementById('say').textContent);
console.log('sky', JSON.stringify(skyText));
if (!/cast for Tokyo at midnight on 8 August 1988/.test(skyText) || !/The spread:/.test(skyText)) errors.push(`no sky or spread at the start (${skyText})`);
const quilt = await page.evaluate(() => window.__game.quilt.patches.map((q) => ({
  id: q.id, kernel: q.kernel, name: q.name, px: q.px, pz: q.pz, place: q.place, card: q.card.n,
  portal: q.portal ? { x: q.portal.x, z: q.portal.z, o: q.portal.o } : null, portals: q.portals.map((l) => l.to),
  surface: q.surface, address: q.address, date: q.date,
  rooms: q.rooms.map((r) => ({ role: r.role, x: r.x, z: r.z, o: r.o, prop: r.def.prop || null, propAt: r.propAt || null })),
})));
const props = await page.evaluate(() => { const q = window.__game.quilt; return [q.props, q.patches.reduce((n, x) => n + x.rooms.filter((r) => r.def.prop).length, 0)]; });
if (props[0] !== props[1]) errors.push(`placed ${props[0]} of ${props[1]} props`);
console.log('quilt', JSON.stringify(quilt.map((q) => `${q.name} (${q.kernel})`)));
if (quilt.length < 3) errors.push(`only ${quilt.length} patches sewn on level 0`);
const want = NIGHT.split('patches=')[1].split(',');
if (quilt.map((q) => q.address).sort().join() !== [...want].sort().join()) errors.push(`?patches= didn't replay the addresses (${quilt.map((q) => q.address)})`);
const goTo = async (r) => {
  await page.evaluate(({ x, z, o }) => { const g = window.__game; Object.assign(g.S, { x, z, o }); }, r);
  await page.waitForTimeout(450);
  return page.evaluate(() => document.getElementById('say').textContent);
};
const away = { x: 28.81, z: -426.74, o: -2 };
// a sealed way up is found by walking to it (first, before other walks pass near it)
for (const q of quilt.filter((q) => q.surface && !q.surface.known)) {
  await goTo(away);
  const said = await goTo({ x: q.surface.x, z: q.surface.z, o: q.surface.o });
  const found = await page.evaluate((id) => window.__game.quilt.patches.find((p) => p.id === id).surface.found === true, q.id);
  console.log('secret way up', q.name, found, JSON.stringify(said.slice(0, 100)));
  if (!found || !/A sealed way up, found: exit/.test(said)) errors.push(`${q.name}: walking to its sealed way up found nothing (${said})`);
}
// the time warp: inside a patch you're in its night, with its date on the HUD and its season drifting down
for (const q of quilt) {
  await goTo(away);
  await goTo(q.rooms.find((r) => r.role === 'heart'));
  await page.waitForTimeout(150);
  const w = await page.evaluate(() => { const g = window.__game; return { where: document.getElementById('where').textContent, zone: g.quilt.zone?.address, kind: g.quilt.zone?.warp.kind, drifting: g.quilt.zone?.warp.pts.visible }; });
  console.log('warp', q.address, JSON.stringify(w));
  if (w.zone !== q.address || !w.where.includes(longDate(q.date)) || !w.drifting) errors.push(`${q.name}: no time warp inside it (${JSON.stringify(w)})`);
}
for (const q of quilt) {
  const heart = q.rooms.find((r) => r.role === 'heart');
  const gate = q.rooms.find((r) => r.role === 'gate');
  const rooms = q.rooms.filter((r) => r.role === 'room');
  const stamps0 = await page.evaluate(() => window.__game.store.data.stamps);
  let said;
  if (q.kernel === 'explore') {
    said = await goTo(heart);
    for (const r of rooms) { await goTo(away); said = await goTo(r); }
    await goTo(away);
    said = await goTo(heart);
  } else if (q.kernel === 'run') {
    said = await goTo(heart);
    const clock = await page.evaluate(() => window.__game.quilt.timer && window.__game.quilt.clock(window.__game.S));
    if (!clock) errors.push(`${q.name}: the run's clock didn't start`);
    said = await goTo(gate);
  } else {
    await goTo({ x: q.px, z: q.pz, o: heart.o });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
    said = await page.evaluate(() => document.getElementById('say').textContent);
    if (!/There's|Nothing dropped/.test(said)) errors.push(`${q.name}: listening gave no hint (${said})`);
  }
  const stamps1 = await page.evaluate(() => window.__game.store.data.stamps);
  // the deepest patch tonight pays twice (its talker too); other talkers give a hint, not a stamp
  const pay = q.place === 'deepest' ? 2 : q.kernel === 'talk' ? 0 : 1;
  if (stamps1 !== stamps0 + pay) errors.push(`${q.name}: expected ${pay} stamp(s) for its ${q.kernel}, got ${stamps1 - stamps0} (${said})`);
  const blank = await goTo(q.rooms.find((r) => r.role === 'blank'));
  if (!/Chalked on the floor/.test(blank)) errors.push(`${q.name}: the blank has no stitch (${blank})`);
  else if (!quilt.some((o) => o !== q && blank.includes(`"${o.name}"`))) errors.push(`${q.name}: the stitch doesn't name a patch (${blank})`);
  for (const r of q.rooms) { await goTo(away); await goTo(r); }
  console.log('patch', q.name, JSON.stringify(said.slice(0, 110)), 'stamps', stamps0, '→', stamps1);
}
const walked = await page.evaluate(() => window.__game.quilt.walked);
if (walked.length !== quilt.length) errors.push(`walked ${walked.length} of ${quilt.length} patches`);

// cast every portal with the wand: you step out beside the other patch's ring, on its floor
const portaled = quilt.filter((q) => q.portal);
if (!portaled.length) errors.push('no portals under the 1988-08-08 sky');
for (const q of portaled) {
  await goTo(away);
  await goTo(q.portal);
  const prompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => { const g = window.__game; return { x: g.S.x, z: g.S.z, o: g.S.o, said: document.getElementById('say').textContent }; });
  const dest = quilt.find((o) => o.id === q.portals[0]);
  const d = Math.hypot(after.x - dest.portal.x, after.z - dest.portal.z);
  console.log('portal', q.name, '→', dest.name, JSON.stringify(prompt), `lands ${d.toFixed(1)} m from its ring, B${-after.o}F`);
  if (!/Cast:/.test(prompt)) errors.push(`${q.name}: no Cast prompt at the portal (${prompt})`);
  if (after.o !== dest.portal.o || d > 2) errors.push(`${q.name}: the portal didn't take you to ${dest.name}`);
  if (!/raise your wand/.test(after.said)) errors.push(`${q.name}: casting said nothing (${after.said})`);
}


// stand back from a vending machine and look at it
const vm = quilt.flatMap((q) => q.rooms.filter((r) => r.prop === 'vending' && r.propAt))[0];
let pr = null;
if (vm) {
  const [px, pz] = vm.propAt, dx = vm.x - px, dz = vm.z - pz, d = Math.hypot(dx, dz) || 1;
  pr = { x: px + (dx / d) * 2.6, z: pz + (dz / d) * 2.6, o: vm.o, yaw: Math.atan2(dx / d, dz / d) };
}
const pq = portaled[0];
const pv = pq && { x: pq.portal.x + 2.4, z: pq.portal.z, o: pq.portal.o, yaw: Math.PI / 2 };   // the kitten faces yaw + π: west, at the ring
const heartOf = (id) => { const q = quilt.find((x) => x.id === id); const h = q && q.rooms.find((r) => r.role === 'heart'); return h && { x: h.x + 2.2, z: h.z, o: h.o, yaw: Math.PI / 2 }; };
for (const [name, r] of [['quilt-snow', heartOf('three-chalk-cats')], ['quilt-sakura', heartOf('the-last-shutter')], ['quilt-portal', pv], ['quilt-prop', pr], ['quilt-talk', quilt.find((q) => q.kernel === 'talk') && { x: quilt.find((q) => q.kernel === 'talk').px + 2.5, z: quilt.find((q) => q.kernel === 'talk').pz, o: quilt.find((q) => q.kernel === 'talk').rooms[0].o }]]) {
  if (!r) continue;
  await page.goto(base + `?level=0&play&day=2026-11-10&${NIGHT}&x=${r.x}&z=${r.z}&o=${r.o}${r.yaw !== undefined ? `&yaw=${r.yaw}` : ''}`);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/${name}.png` });
}

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
