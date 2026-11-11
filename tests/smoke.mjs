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

// The critters: meet each species the way a player would, under the pinned night
{
  const url = base + `?level=0&play&day=2026-11-10&${NIGHT}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.critters);
  await page.evaluate(() => { window.__game.store.data.notes = []; });
  const list = await page.evaluate(() => window.__game.critters.list.map((c) => ({ species: c.species, x: c.x, z: c.z, o: c.o, y: c.y, wall: c.wall, flock: c.flock })));
  const n = {}; for (const c of list) n[c.species] = (n[c.species] || 0) + 1;
  console.log('critters', JSON.stringify(n));
  const put = (x, z, o, yaw) => page.evaluate(({ x, z, o, yaw }) => { const g = window.__game; Object.assign(g.S, { x, z, o, yaw, head: yaw + Math.PI }); }, { x, z, o, yaw });
  const face = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));   // the kitten faces yaw + π
  const notes = () => page.evaluate(() => [...window.__game.store.data.notes]);
  const walkable = (x, z, o) => page.evaluate(({ x, z, o }) => window.__game.nav(o).inside(x, z), { x, z, o });
  async function standOff(c, d) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (await walkable(x, z, c.o)) return { x, z };
    }
    return null;
  }
  // pigeons: zoom at a flock
  const pg = list.find((c) => c.species === 'pigeon');
  let at = await standOff(pg, 4);
  await put(at.x, at.z, pg.o, face(at.x, at.z, pg.x, pg.z));
  await page.waitForTimeout(300);
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  const flew = await page.evaluate((f) => window.__game.critters.list.filter((c) => c.species === 'pigeon' && c.flock === f).some((c) => c.state === 'fly' || Math.hypot(c.x - c.home.x, c.z - c.home.z) > 1), pg.flock);
  console.log('pigeons flew', flew, JSON.stringify(await notes()));
  if (!flew) errors.push('the pigeons did not fly up at a zoomie');
  // a rat: sit still nearby and wait
  await page.waitForTimeout(1200);   // let the zoomies wear off first: a rat flees a running kitten
  const rt = list.find((c) => c.species === 'rat');
  at = await standOff(rt, 2.2);
  await put(at.x, at.z, rt.o, face(at.x, at.z, rt.x, rt.z));
  await page.waitForTimeout(9000);
  const rat = await page.evaluate(() => {
    const g = window.__game, rats = g.critters.list.filter((c) => c.species === 'rat' && c.o === g.S.o);
    return rats.sort((a, b) => Math.hypot(a.x - g.S.x, a.z - g.S.z) - Math.hypot(b.x - g.S.x, b.z - g.S.z))[0]?.state;
  });
  console.log('rat', rat, JSON.stringify(await notes()));
  if (rat !== 'friend') errors.push(`a rat didn't come to a still kitten (${rat})`);
  // a gecko: walk under it
  const gk = list.find((c) => c.species === 'gecko');
  await put(gk.x + gk.wall.nx * 1.8, gk.z + gk.wall.nz * 1.8, gk.o, face(gk.x + gk.wall.nx * 1.8, gk.z + gk.wall.nz * 1.8, gk.x, gk.z));
  await page.waitForTimeout(500);
  // a pill bug: walk into it
  const pb = list.find((c) => c.species === 'pillbug');
  at = await standOff(pb, 0.7);
  await put(at.x, at.z, pb.o, face(at.x, at.z, pb.x, pb.z));
  await page.keyboard.down('KeyW'); await page.waitForTimeout(450); await page.keyboard.up('KeyW');
  await page.waitForTimeout(300);
  const rolled = await page.evaluate(() => window.__game.critters.list.some((c) => c.species === 'pillbug' && c.state === 'ball'));
  console.log('pill bug rolled', rolled);
  if (!rolled) errors.push("a pill bug didn't roll up when the kitten bumped it");
  // a swallow's nest: stand under it
  const sw = list.find((c) => c.species === 'swallow');
  if (sw) { await put(sw.x + 1, sw.z, sw.o, Math.PI / 2); await page.waitForTimeout(500); }
  const got = await notes();
  console.log('field notes', JSON.stringify(got));
  for (const sp of ['pigeon', 'rat', 'gecko', 'pillbug', ...(sw ? ['swallow'] : [])]) if (!got.includes(sp)) errors.push(`no field note for ${sp}`);
  // portraits
  for (const [name, c, dist] of [['critter-pigeons', pg, 1.6], ['critter-rat', rt, 1.1], ['critter-gecko', gk, 1.4], ['critter-pillbug', pb, 0.8], ['critter-swallow', sw, 2.2]]) {
    if (!c) continue;
    const p = c.wall ? { x: c.x + c.wall.nx * dist, z: c.z + c.wall.nz * dist } : await standOff(c, dist);
    if (!p) continue;
    // look a little past small animals on the floor, so the kitten doesn't hide them
    const turn = name === 'critter-rat' || name === 'critter-pillbug' ? 0.55 : 0;
    await page.goto(url + `&x=${p.x}&z=${p.z}&o=${c.o}&yaw=${face(p.x, p.z, c.x, c.z) + turn}`);
    await page.waitForFunction(() => window.__game && window.__game.S.state === 'play');
    await page.addStyleTag({ content: '#say{display:none!important}' });
    if (name === 'critter-gecko' || name === 'critter-swallow') await page.evaluate(() => { window.__game.S.pitch = -0.25; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
}

// Trains and tanuki on the Marunouchi line's platform at Shinjuku (B2), and the crowd
{
  await page.goto(base + '?level=0&play&day=2026-11-10');
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.trains && window.__game.rail);
  const v = await page.evaluate(() => {
    const g = window.__game, pl = g.rail.platforms.find((x) => x.name.includes('新宿駅'));
    const tk = pl.tracks[0], tr = g.rail.tracks[tk.track], nav = g.nav(pl.o);
    // from the track, step toward the platform until there's floor, then a little more
    let d = 0;
    const at = (dd) => [tr.p[0] + tr.u[0] * (tr.stop + 12) - tr.n[0] * dd, tr.p[1] + tr.u[1] * (tr.stop + 12) - tr.n[1] * dd];   // past the stop, looking back at it
    while (d < 8 && !nav.inside(...at(d))) d += 0.2;
    const [x, z] = at(d + 1.2);
    const fx = tr.n[0] * 0.55 - tr.u[0] * 0.83, fz = tr.n[1] * 0.55 - tr.u[1] * 0.83;
    return { ti: tk.track, x, z, o: pl.o, yaw: Math.atan2(-fx, -fz), line: tr.line };
  });
  await page.goto(base + `?level=0&play&day=2026-11-10&x=${v.x}&z=${v.z}&o=${v.o}&yaw=${v.yaw}`);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.trains);
  await page.evaluate(() => { window.__game.store.data.notes = []; });
  await page.addStyleTag({ content: '#say{display:none!important}' });
  await page.mouse.click(640, 360);   // a tap: the sound starts
  await page.evaluate((i) => window.__game.trains.force(i, false), v.ti);
  await page.waitForTimeout(3000);
  const snd = await page.evaluate(() => ({ state: window.__game.sound.ctx?.state, level: window.__game.sound.level(), dings: window.__game.sound.dings }));
  console.log('sound', JSON.stringify(snd));
  if (snd.state !== 'running' || !(snd.level > 0.001)) errors.push(`no sound after a tap (${JSON.stringify(snd)})`);
  if (snd.dings < 1) errors.push('the doors opened without a chime');
  const t1 = await page.evaluate((i) => ({ st: window.__game.trains.state(i), shown: window.__game.trains.built.get(i)?.train.g.visible, crowd: window.__game.crowd.active.length, fps: window.__game.S.fps }), v.ti);
  console.log('train', v.line, JSON.stringify(t1));
  if (!t1.st || t1.st.phase !== 'stop' || !t1.shown) errors.push(`no train at the platform (${JSON.stringify(t1)})`);
  if (t1.crowd < 8) errors.push(`the station is nearly empty (${t1.crowd} people)`);
  await page.screenshot({ path: `${out}/rail-train.png` });
  await page.waitForTimeout(31000);
  await page.evaluate((i) => window.__game.trains.force(i, true), v.ti);
  await page.waitForTimeout(2500);
  const t2 = await page.evaluate((i) => ({ shown: window.__game.trains.built.get(i)?.parade.g.visible, notes: [...window.__game.store.data.notes] }), v.ti);
  console.log('tanuki', JSON.stringify(t2));
  if (!t2.shown || !t2.notes.includes('tanuki')) errors.push(`no tanuki, or no field note for them (${JSON.stringify(t2)})`);
  await page.screenshot({ path: `${out}/rail-tanuki.png` });
}

// A fog pocket: the fog closes in, the crowd is gone, the music hushes
{
  await page.goto(base + '?level=0&play&day=2026-11-10');
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.fog);
  const f = await page.evaluate(() => window.__game.fog.find((p) => p.way));
  if (!f) errors.push('no fog pocket on the way');
  else {
    // a step inside the pocket, where you notice the fog before its yokai comes to meet you
    const sp = await page.evaluate((f) => {
      const nav = window.__game.nav(f.o);
      for (let r = 5; r <= 7; r += 0.5) for (let a = 0; a < 32; a++) {
        const x = f.x + Math.cos(a / 32 * Math.PI * 2) * r, z = f.z + Math.sin(a / 32 * Math.PI * 2) * r;
        if (nav.inside(x, z)) return { x, z };
      }
      return { x: f.x, z: f.z };
    }, f);
    await page.goto(base + `?level=0&play&day=2026-11-10&x=${sp.x}&z=${sp.z}&o=${f.o}`);
    await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.crowd);
    await page.mouse.click(640, 360);
    await page.waitForTimeout(1200);
    const st = await page.evaluate(() => ({ mist: window.__game.mist, crowd: window.__game.crowd.active.length, said: document.getElementById('say').textContent, range: window.__game.shared.uFogRange.value.y }));
    console.log('fog pocket', JSON.stringify(st));
    if (st.mist < 0.95 || st.crowd > 0 || st.range > 8) errors.push(`the fog pocket isn't foggy and empty (${JSON.stringify(st)})`);
    if (st.said !== f.line) errors.push(`no line on walking into the fog (${st.said})`);
    await page.screenshot({ path: `${out}/fog-pocket.png` });
  }
}

// Yokai: walk up to each, then befriend the first through the real keys and buttons, and lose your nerve to the second
{
  await page.goto(base + '?level=0&play&day=2026-11-10');
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.encounters);
  const spots = await page.evaluate(() => {
    const g = window.__game;
    return g.encounters.list.map((y) => {
      const nav = g.nav(y.o);
      for (let r = 6; r >= 4; r -= 0.5) for (let a = 0; a < 32; a++) {
        const x = y.x + Math.cos(a / 32 * Math.PI * 2) * r, z = y.z + Math.sin(a / 32 * Math.PI * 2) * r;
        if (nav.inside(x, z) && nav.ray(y.x, y.z, (x - y.x) / r, (z - y.z) / r, r) >= r - 0.1) return { kind: y.kind, x, z, o: y.o, yx: y.x, yz: y.z };
      }
      return null;
    }).filter(Boolean);
  });
  if (spots.length < 2) errors.push(`only ${spots.length} yokai can be walked up to`);
  const meet = async (p) => {
    await page.goto(base + `?level=0&play&day=2026-11-10&x=${p.x}&z=${p.z}&o=${p.o}&yaw=${Math.atan2(-(p.yx - p.x), -(p.yz - p.z))}`);
    await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.encounters);
    await page.evaluate(() => { const g = window.__game; g.store.data.notes = (g.store.data.notes || []).filter((n) => !n.startsWith('yokai:')); g.store.data.found = []; });
    await page.mouse.click(640, 200);
    await page.keyboard.down('KeyW');
    const met = await page.waitForFunction(() => window.__game.encounters.active, null, { timeout: 10000 }).then(() => true, () => false);
    await page.keyboard.up('KeyW');
    if (!met) errors.push(`walked up to the ${p.kind} and nothing happened`);
    return met;
  };
  // befriend: E past the intro, 3 for Sass, click the line it likes, E, dodge a turn; three times
  const a = spots[0];
  if (await meet(a)) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/yokai-${a.kind}.png` });
    const phase = (want, timeout = 9000) => page.waitForFunction((w) => window.__game.encounters.fight?.phase === w, want, { timeout });
    await page.keyboard.press('KeyE');
    await phase('menu');
    for (let n = 0; n < 6; n++) {
      await page.keyboard.press('Digit3');
      await phase('sass', 3000);
      const good = await page.evaluate(() => window.__game.encounters.fight.lines.findIndex((l) => l.good));
      await page.click(`#meet-menu button[data-i="${good}"]`);
      await page.waitForFunction(() => window.__game.encounters.fight?.phase !== 'sass', null, { timeout: 3000 });
      if (await page.evaluate(() => window.__game.encounters.fight?.phase === 'won')) break;
      await page.evaluate(() => { window.__game.encounters.fight.nerve = 99; });   // the test is about the words, not the dodging
      await page.keyboard.press('KeyE');
      await phase('turn', 4000);
      if (n === 0) { await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/yokai-${a.kind}-arena.png` }); }
      await page.waitForFunction(() => window.__game.encounters.fight?.phase !== 'turn', null, { timeout: 9000 });
      await page.keyboard.press('KeyE');
      await phase('menu', 4000);
    }
    const won = await page.evaluate(() => ({ phase: window.__game.encounters.fight?.phase, outcome: window.__game.encounters.fight?.outcome }));
    await page.waitForTimeout(800);   // a moment to read it
    await page.screenshot({ path: `${out}/yokai-${a.kind}-won.png` });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => ({ active: window.__game.encounters.active, mist: window.__game.mist, notes: window.__game.store.data.notes, said: document.getElementById('say').textContent }));
    console.log('yokai', a.kind, JSON.stringify(won), JSON.stringify({ ...after, said: after.said.slice(0, 90) }));
    if (won.outcome !== 'befriended') errors.push(`sassing the ${a.kind} didn't befriend it (${JSON.stringify(won)})`);
    if (after.active || after.mist > 0.05 || !after.notes.includes(`yokai:${a.kind}`)) errors.push(`after the ${a.kind}: the fight didn't close, the fog didn't lift, or no field note (${JSON.stringify(after)})`);
  }
  // lose your nerve: put the paw in the way of a bullet with one nerve left
  const b = spots[1];
  if (b && await meet(b)) {
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__game.encounters.fight?.phase === 'menu', null, { timeout: 8000 }).catch(() => {});
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => {
      const f = window.__game.encounters.fight;
      if (!f) return false;
      if (f.phase === 'fled') return true;
      if (f.phase !== 'turn') return false;
      f.nerve = 1;
      const bl = f.bullets().find((q) => !q.warn);
      if (bl) f.paw = { x: bl.x, y: bl.y };
      return false;
    }, null, { timeout: 9000, polling: 50 }).catch(() => {});
    const fled = await page.evaluate(() => window.__game.encounters.fight?.outcome);
    await page.waitForTimeout(800);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(800);
    const st = await page.evaluate((p) => { const g = window.__game; return { active: g.encounters.active, d: Math.hypot(g.S.x - p.yx, g.S.z - p.yz), said: document.getElementById('say').textContent }; }, b);
    console.log('yokai', b.kind, fled, JSON.stringify(st));
    if (fled !== 'fled' || st.active || st.d < 3) errors.push(`losing your nerve to the ${b.kind} didn't send you bolting (${fled}, ${JSON.stringify(st)})`);
  }
}

// Pointless treasure: walk onto the one in the nearest dead end
{
  await page.goto(base + '?level=0&play&day=2026-11-10');
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.treasure);
  await page.evaluate(() => { window.__game.store.data.treasures = {}; window.__game.store.data.found = []; });
  const t = await page.evaluate(() => {
    const g = window.__game, l = g.treasure.list;
    return { n: l.length, x: l[0].x, z: l[0].z, o: l[0].o, kind: l[0].kind };
  });
  console.log('treasure', t.n, 'dead ends; the first holds', t.kind);
  if (t.n < 20) errors.push(`only ${t.n} treasures`);
  // a portrait, then walk onto it
  await page.goto(base + `?level=0&play&day=2026-11-10&x=${t.x + 1.1}&z=${t.z}&o=${t.o}&yaw=${Math.PI / 2}`);
  await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.treasure);
  await page.addStyleTag({ content: '#say{display:none!important}' });
  await page.evaluate(() => { window.__game.S.pitch = 0.6; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/treasure.png` });
  await page.addStyleTag({ content: '#say{display:block!important}' });
  await page.evaluate(({ x, z, o }) => Object.assign(window.__game.S, { x, z, o }), t);
  await page.waitForTimeout(400);
  const got = await page.evaluate(() => ({ said: document.getElementById('say').textContent, kinds: Object.keys(window.__game.store.data.treasures || {}) }));
  console.log('consolation prize', JSON.stringify(got.said.slice(0, 120)), JSON.stringify(got.kinds));
  if (!/Consolation prize/.test(got.said) || !got.kinds.includes(t.kind)) errors.push(`walking onto a treasure didn't pick it up (${got.said})`);
}

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
