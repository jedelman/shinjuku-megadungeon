// Film a trailer: node tests/trailer.mjs [baseUrl] [outDir]
// One-second clips of the game's main moments, cut together, ending on a long shot of the start screen, over the game's
// own ambient music. Needs `vite preview` running and ffmpeg on the path. Writes trailer.mp4.
//
// Headless rendering is slow and uneven, so the game runs on a virtual clock: performance.now and requestAnimationFrame
// are replaced, and each frame is advanced by exactly 1/30 s and screenshotted. Every clip is a smooth 30 fps whatever
// the machine. The music is recorded separately in real time (it's generative: each take differs).
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'trailer-out';
const only = process.argv[4] ? process.argv[4].split(',') : null;   // film just these shots (for retakes)
fs.mkdirSync(out, { recursive: true });
const W = 1280, H = 720, FPS = 30, FADE = 0.6;
const DAY = 'day=2026-11-10';
// four patches whose nights drift sakura, snow and fireflies (tests/smoke.mjs pins the same set)
const WARP = 'chart=1988-08-08&patches=the-vending-machine-choir@2053-08-02,three-chalk-cats@2077-01-28,the-last-shutter@2066-03-19,the-man-who-still-commutes@1979-08-18';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  if (!location.search.includes('vclock')) return;
  let now = 0;
  const q = [];
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__tick = (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 30; for (const cb of q.splice(0)) cb(now); } };
});
const open = async (q, ready = 'play') => {
  await page.goto(`${base}?vclock&${q}`);
  await page.waitForFunction((r) => window.__game && window.__game.S.state === r && window.__game.encounters, ready, { polling: 100, timeout: 30000 });
  // a clean frame: no HUD (the say box only when a shot wants its words), no blinking
  await page.addStyleTag({ content: '#hud > :not(#say) { visibility: hidden !important; } #say { visibility: hidden; } .start { animation: none !important; }' });
};
const tick = (n = 1) => page.evaluate((k) => window.__tick(k), n);
const words = (on) => page.addStyleTag({ content: `#say { visibility: ${on ? 'visible' : 'hidden'} !important; }` });

// ---------------------------------------------------------------------------------------------- where things are
await open(`level=0&play&${DAY}`);
const P = await page.evaluate(() => {
  const g = window.__game, d = g.data;
  // a spot on the floor that can see (x, z), r metres off
  const see = (x, z, o, rs, cam = 0) => {
    const nav = g.nav(o);
    for (const r of rs) for (let a = 0; a < 48; a++) {
      const ux = Math.cos(a / 48 * Math.PI * 2), uz = Math.sin(a / 48 * Math.PI * 2), px = x + ux * r, pz = z + uz * r;
      if (!nav.inside(px, pz) || nav.ray(x, z, ux, uz, r + cam) < r + cam - 0.1) continue;
      if (cam && !nav.inside(x + ux * (r + cam), z + uz * (r + cam))) continue;
      return { x: px, z: pz, o, yaw: Math.atan2(-(x - px), -(z - pz)) };
    }
    return null;
  };
  const yokai = Object.fromEntries(g.encounters.list.map((y) => [y.kind, { x: y.x, z: y.z, o: y.o, near: see(y.x, y.z, y.o, [4.5, 5, 4, 5.5], 1.9) || see(y.x, y.z, y.o, [4.5, 5, 4, 5.5]), far: see(y.x, y.z, y.o, [6.5, 6, 7, 5.5]) }]));
  // the platform doors on the Marunouchi line's platform, looking across the track toward the tunnel (tests/parade.mjs)
  const pl = g.rail.platforms.find((x) => x.name.includes('新宿駅')), tk = pl.tracks[0], tr = g.rail.tracks[tk.track], nav = g.nav(pl.o);
  const edge = (along) => {
    const at = (dd) => [tr.p[0] + tr.u[0] * along - tr.n[0] * dd, tr.p[1] + tr.u[1] * along - tr.n[1] * dd];
    let dd = 0;
    while (dd < 8 && !nav.inside(...at(dd))) dd += 0.1;
    return { dd, at };
  };
  let best = null;
  for (let a = -14; a <= 14; a += 1) {
    const e = edge(tr.stop + a);
    if (!best || e.dd < best.dd - 0.05 || (Math.abs(e.dd - best.dd) <= 0.05 && Math.abs(a - 6) < Math.abs(best.a - 6))) best = { ...e, a };
  }
  const [px, pz] = best.at(best.dd + 0.45);
  const fx = -tr.u[0] * 0.62 + tr.n[0] * 0.78, fz = -tr.u[1] * 0.62 + tr.n[1] * 0.78;
  const ax = tr.n[0] - tr.u[0] * 0.25, az = tr.n[1] - tr.u[1] * 0.25;   // straight across the track, a touch toward the tunnel
  let back = null;                                                       // further back on the platform, looking along the track
  for (const extra of [3.2, 2.6, 2, 1.4]) { const [bx, bz] = best.at(best.dd + extra); if (nav.inside(bx, bz)) { back = [bx, bz]; break; } }
  const lx = -tr.u[0] * 0.35 + tr.n[0] * 0.94, lz = -tr.u[1] * 0.35 + tr.n[1] * 0.94;   // across the track, a little toward the tunnel
  const platform = { track: tk.track, x: px, z: pz, o: pl.o, yaw: Math.atan2(-fx, -fz), across: Math.atan2(-ax, -az),
    back: back && { x: back[0], z: back[1], o: pl.o, yaw: Math.atan2(-lx, -lz) } };
  // stairs up from B2, with a run of steps to bound up
  let stairs = null;
  d.conns.forEach((c) => {
    if (c.t !== 6 || stairs) return;
    const [a, b] = d.nodes[c.a][2] < d.nodes[c.b][2] ? [c.a, c.b] : [c.b, c.a];
    const lo = d.nodes[a], pts = c.p[0][2] === lo[2] ? c.p : [...c.p].reverse();
    if (lo[2] !== -2 || pts.length < 2 || Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) < 1) return;
    const dx = pts[1][0] - lo[0], dz = pts[1][1] - lo[1];
    const back = 1.2, L = Math.hypot(dx, dz);
    const sx = lo[0] - (dx / L) * back, sz = lo[1] - (dz / L) * back;
    if (!g.nav(-2).inside(sx, sz)) return;
    stairs = { x: sx, z: sz, o: -2, yaw: Math.atan2(-dx, -dz) };
  });
  // pigeons by an exit, and a run-up to them
  const rooms = g.quilt.patches.flatMap((q) => q.rooms);   // a flock away from any patch, so nothing else sparkles
  const pg = g.critters.list.find((c) => c.species === 'pigeon' && !rooms.some((r) => r.o === c.o && Math.hypot(r.x - c.x, r.z - c.z) < 20) && see(c.x, c.z, c.o, [5, 6, 4]))
    || g.critters.list.find((c) => c.species === 'pigeon' && see(c.x, c.z, c.o, [5, 6, 4]));
  const pigeons = pg && see(pg.x, pg.z, pg.o, [5, 6, 4]);
  const t = g.treasure.list[0];
  const treasure = { ...see(t.x, t.z, t.o, [1.7, 1.5, 2]) };
  return { yokai, platform, stairs, pigeons, treasure };
});
await open(`level=0&play&${WARP}`);
Object.assign(P, await page.evaluate(() => {
  const g = window.__game, out = {};
  const see = (x, z, o, rs, cam = 0) => {
    const nav = g.nav(o);
    for (const r of rs) for (let a = 0; a < 48; a++) {
      const ux = Math.cos(a / 48 * Math.PI * 2), uz = Math.sin(a / 48 * Math.PI * 2), px = x + ux * r, pz = z + uz * r;
      if (!nav.inside(px, pz) || nav.ray(x, z, ux, uz, r + cam) < r + cam - 0.1) continue;
      if (cam && !nav.inside(x + ux * (r + cam), z + uz * (r + cam))) continue;
      return { x: px, z: pz, o, yaw: Math.atan2(-(x - px), -(z - pz)) };
    }
    return null;
  };
  for (const q of g.quilt.patches) {
    out[q.id] = see(q.heart.x, q.heart.z, q.heart.o, [4, 3.5, 5, 3]);
    // the longest open view from the heart, with room behind for the camera
    const nav = g.nav(q.heart.o);
    let vista = null;
    for (let a = 0; a < 64; a++) {
      const ux = Math.sin(a / 64 * Math.PI * 2), uz = Math.cos(a / 64 * Math.PI * 2);
      const ahead = nav.ray(q.heart.x, q.heart.z, -ux, -uz, 60), behind = nav.ray(q.heart.x, q.heart.z, ux, uz, 3);
      if (behind > 2 && (!vista || ahead > vista.ahead)) vista = { x: q.heart.x, z: q.heart.z, o: q.heart.o, yaw: a / 64 * Math.PI * 2, ahead };
    }
    out[`${q.id}-vista`] = vista;
    if (q.portal && !out.portal) out.portal = see(q.portal.x, q.portal.z, q.portal.o, [2.1, 2.4, 1.8]);
  }
  return out;
}));
console.log('places', JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v && (v.x !== undefined ? 'ok' : Object.keys(v).join('/'))]))));

// ---------------------------------------------------------------------------------------------- filming
const at = (p) => `x=${p.x}&z=${p.z}&o=${p.o}&yaw=${p.yaw}`;
const BUSY = { x: 184.45, z: -285.47, o: -2, yaw: 2.874 };   // the Subnade arcade, where the most commuters pass the camera
const shotsDir = path.join(out, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
async function film(name, frames, each) {
  const dir = path.join(shotsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) {
    if (each) await each(i);
    await tick();
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 93 });
  }
  const mp4 = path.join(shotsDir, `${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%03d.jpg'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', mp4]);
  return mp4;
}
// the fight's paw, played by a careful bot (it looks a moment ahead and steps where nothing will be)
const botOn = () => page.evaluate(() => {
  const E = window.__game.encounters, play = E.play.bind(E);
  const bot = (f) => {
    const look = 0.14, t = f.t; f.t = t + look; const fut = f.bullets(); f.t = t;
    const now = f.bullets(), tg = f.target(), sp = 0.45 * (f.action === 'dodge' ? 1.4 : 1);
    let best = [0, 0], bs = -Infinity;
    for (let i = -1; i < 16; i++) {
      const m = i < 0 ? [0, 0] : [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)];
      const x = Math.max(0.02, Math.min(0.98, f.paw.x + m[0] * sp * look)), y = Math.max(0.02, Math.min(0.54, f.paw.y - m[1] * sp * look));
      let clear = 1;
      for (const b of [...fut, ...now]) clear = Math.min(clear, Math.hypot(b.x - x, b.y - y) - b.r - 0.022);
      let s = Math.min(clear, 0.12) - 0.02 * Math.hypot(x - 0.5, y - 0.28);
      if (tg && clear > 0.05) s -= 0.5 * Math.hypot(tg.x - x, tg.y - y);
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  };
  E.play = (dt, S, input) => { const f = E.fight; if (f && f.phase === 'turn') input = { ...input, move: bot(f), act: false, digit: 0 }; return play(dt, S, input); };
});
const key = async (k, down) => (down ? page.keyboard.down(k) : page.keyboard.up(k));
const centre = () => page.evaluate(() => { const E = window.__game.encounters, f = E.frame.bind(E); E.frame = (S, y, top, fov) => f(S, y, 0.86, fov); });
const dist = (p) => page.evaluate((q) => Math.hypot(window.__game.S.x - q.x, window.__game.S.z - q.z), p);

const SHOTS = {
  // a busy concourse: the kitten trots through the Subnade arcade among the commuters
  async crowd() {
    await open(`level=0&play&${DAY}&${at(BUSY)}`);
    await tick(120);
    await key('KeyW', true);
    const f = await film('crowd', FPS);
    await key('KeyW', false);
    return f;
  },
  // kittens bound up stairs
  async stairs() {
    await open(`level=0&play&${DAY}&${at(P.stairs)}`);
    await tick(40);
    await key('KeyW', true); await tick(8); await key('KeyW', false);
    await page.keyboard.press('KeyE');
    await tick(4);
    return film('stairs', FPS);
  },
  // a train brakes in beside the platform doors
  async train() {
    await open(`level=0&play&${DAY}&${at(P.platform.back || P.platform)}`);
    await tick(60);
    await page.evaluate((i) => { const T = window.__game.trains; T.forced.set(i, { at: T.now() - 6.1, tanuki: false, approach: true }); }, P.platform.track);
    return film('train', FPS, () => page.evaluate(() => { window.__game.S.pitch = 0.3; }));
  },
  // zoomies at the pigeons by an exit, and they scatter
  async pigeons() {
    await open(`level=0&play&${DAY}&${at(P.pigeons)}`);
    await tick(60);
    await key('ShiftLeft', true); await key('KeyW', true);
    const f = await film('pigeons', FPS);
    await key('KeyW', false); await key('ShiftLeft', false);
    return f;
  },
  // sometimes it's a train, sometimes it's a crowd of tanuki
  async tanuki() {
    await open(`level=0&play&${DAY}&${at({ ...P.platform, yaw: P.platform.across })}`);
    await tick(60);
    await page.evaluate((i) => { const T = window.__game.trains; T.forced.set(i, { at: T.now() - 12.3, tanuki: true, approach: true }); }, P.platform.track);
    return film('tanuki', FPS, () => page.evaluate(() => { window.__game.S.pitch = 0.42; }));
  },
  // a patch is another night: cherry petals drifting down the corridor
  async sakura() {
    await open(`level=0&play&${WARP}&${at(P['the-last-shutter'])}`);
    await tick(70);
    await key('KeyW', true);
    const f = await film('sakura', FPS);
    await key('KeyW', false);
    return f;
  },
  async snow() {
    await open(`level=0&play&${WARP}&${at(P['three-chalk-cats'])}`);
    await tick(70);
    await key('KeyW', true);
    const f = await film('snow', FPS);
    await key('KeyW', false);
    return f;
  },
  async fireflies() {
    await open(`level=0&play&${WARP}&${at(P['the-vending-machine-choir'])}`);
    await tick(70);
    await key('KeyW', true);
    const f = await film('fireflies', FPS);
    await key('KeyW', false);
    return f;
  },
  // a portal cast with the wand
  async portal() {
    await open(`level=0&play&${WARP}&${at(P.portal)}`);
    await tick(60);
    return film('portal', FPS, () => page.evaluate(() => { window.__game.S.pitch = 0.2; }));
  },
  // a pointless treasure at the end of a dead end
  async treasure() {
    await open(`level=0&play&${DAY}&${at(P.treasure)}`);
    await page.evaluate(() => { window.__game.S.pitch = 0.55; });
    await tick(300);   // let tonight's sky finish being read out
    await words(true);
    await tick(8);
    await key('KeyW', true);
    const f = await film('treasure', FPS, async (i) => { if (i === 20) await key('KeyW', false); });
    await key('KeyW', false);
    return f;
  },
  // into the fog: nobody here
  async fog() {
    const n = P.yokai.noppera;
    const away = { x: n.far.x, z: n.far.z, o: n.o, yaw: n.far.yaw + Math.PI };   // its back to the noppera-bō
    await open(`level=0&play&${DAY}&${at(away)}`);
    // wait out tonight's sky with the fog held back, then let it in: its line shows as you walk into it
    await page.evaluate(() => { window.__game.fog.forEach((p) => { p.cleared = true; }); });
    await tick(300);
    await page.evaluate(() => { window.__game.fog.forEach((p) => { p.cleared = false; }); });
    await words(true);
    await page.evaluate((p) => { const g = window.__game; g.S.x = p.x; g.S.z = p.z; }, { x: n.x + (n.far.x - n.x) * 0.7, z: n.z + (n.far.z - n.z) * 0.7 });
    await tick(36);
    await key('KeyW', true);
    const f = await film('fog', FPS);
    await key('KeyW', false);
    return f;
  },
  // a paper lantern where no lantern should be
  async lantern() {
    const c = P.yokai.chochin;
    await open(`level=0&play&${DAY}&x=${c.near.x}&z=${c.near.z}&o=${c.o}&yaw=${c.near.yaw}`);
    await page.addStyleTag({ content: '#meet { display: none !important; }' });
    await centre();
    await key('KeyW', true);
    for (let i = 0; i < 200 && !(await page.evaluate(() => window.__game.encounters.active)); i++) await tick();
    await key('KeyW', false);
    await tick(10);
    return film('lantern', FPS);
  },
  // someone with their back to you turns round. No face.
  async noppera() {
    const n = P.yokai.noppera;
    await open(`level=0&play&${DAY}&x=${n.near.x}&z=${n.near.z}&o=${n.o}&yaw=${n.near.yaw}`);
    await page.addStyleTag({ content: '#meet { display: none !important; }' });
    // close on its face: the camera a step in front of it, at head height
    await page.evaluate(() => {
      const E = window.__game.encounters;
      E.frame = (S, baseY) => { const y = E.cur, dx = S.x - y.x, dz = S.z - y.z, d = Math.hypot(dx, dz) || 1; return { pos: [y.x + (dx / d) * 1.3, baseY + 1.45, y.z + (dz / d) * 1.3], look: [y.x, baseY + 1.5, y.z] }; };
    });
    await key('KeyW', true);
    for (let i = 0; i < 200 && !(await page.evaluate(() => window.__game.encounters.active)); i++) await tick();
    await key('KeyW', false);
    return film('noppera', FPS);   // it turns round as the fight begins
  },
  // an umbrella hops out of the fog on one leg
  async kasa() {
    const k = P.yokai.kasa;
    await open(`level=0&play&${DAY}&x=${k.near.x}&z=${k.near.z}&o=${k.o}&yaw=${k.near.yaw}`);
    await key('KeyW', true);
    for (let i = 0; i < 200 && !(await page.evaluate(() => window.__game.encounters.active)); i++) await tick();
    await key('KeyW', false);
    await tick(14);
    return film('kasa', FPS);
  },
  // dodge, as a paw
  async dodge() {
    const k = P.yokai.kasa;
    await open(`level=0&play&${DAY}&x=${k.near.x}&z=${k.near.z}&o=${k.o}&yaw=${k.near.yaw}`);
    await botOn();
    await key('KeyW', true);
    for (let i = 0; i < 200 && !(await page.evaluate(() => window.__game.encounters.active)); i++) await tick();
    await key('KeyW', false);
    await page.evaluate(() => { const f = window.__game.encounters.fight; f.skip(); f.choose('dodge'); f.pattern = 'hop'; f.text = ['You get light on your paws.']; });
    await tick(52);
    return film('dodge', FPS);
  },
  // the right words, and it laughs so hard it opens all the way; the fog lifts
  async lift() {
    const k = P.yokai.kasa;
    await open(`level=0&play&${DAY}&x=${k.near.x}&z=${k.near.z}&o=${k.o}&yaw=${k.near.yaw}`);
    await key('KeyW', true);
    for (let i = 0; i < 200 && !(await page.evaluate(() => window.__game.encounters.active)); i++) await tick();
    await key('KeyW', false);
    await page.evaluate(() => {
      const g = window.__game, f = g.encounters.fight;
      if (!g.store.data.notes.includes('yokai:kasa')) g.store.data.notes.push('yokai:kasa');   // so the moment isn't a wall of words
      f.skip(); f.meters.amused = 2; f.choose('sass'); f.sass(f.lines.findIndex((l) => l.good));
    });
    await tick(30);
    await words(true);
    await page.keyboard.press('KeyE');
    return film('lift', FPS + Math.round(FADE * FPS));   // the last clip runs on under the dissolve into the start screen
  },
};
const ORDER = ['crowd', 'stairs', 'train', 'pigeons', 'tanuki', 'sakura', 'fireflies', 'portal', 'treasure', 'fog', 'lantern', 'noppera', 'kasa', 'dodge', 'lift'];
const clips = [];
for (const name of ORDER) {
  const mp4 = path.join(shotsDir, `${name}.mp4`);
  if (only && !only.includes(name) && fs.existsSync(mp4)) { clips.push(mp4); continue; }   // keep the earlier take
  const t0 = Date.now();
  clips.push(await SHOTS[name]());
  console.log('filmed', name, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

// the start screen, held: the real title card over a snowy night (it's cold outside), the camera drifting
const title = path.join(shotsDir, 'title.mp4');
if (!only || only.includes('title') || !fs.existsSync(title)) {
  await open(`level=0&play&${WARP}&${at(P['three-chalk-cats-vista'] || P['three-chalk-cats'])}`);
  await page.evaluate(() => { window.__game.S.pitch = 0.22; });
  await tick(150);
  await page.evaluate(() => { document.getElementById('hud').hidden = true; document.getElementById('title').hidden = false; });
  await film('title', FPS * 6, () => page.evaluate(() => { window.__game.S.yaw += 0.0012; }));
  console.log('filmed title');
}
await browser.close();

// ---------------------------------------------------------------------------------------------- the music
// recorded live from the game's own score (it's generative, so this is one take of it), on the title screen, in tonight's key
const music = path.join(out, 'music.webm');
if (!fs.existsSync(music) || !only) {
  const b2 = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p2 = await b2.newPage();
  await p2.goto(`${base}?level=0&${DAY}`);
  await p2.waitForFunction(() => window.__game && window.__game.S.state === 'title');
  const secs = ORDER.length + 6 + 2;
  const b64 = await p2.evaluate((ms) => new Promise((res) => {
    const g = window.__game;
    g.spawn();                       // tonight's chart sets the key
    g.sound.start();
    const rec = new MediaRecorder(g.sound.tap(), { mimeType: 'audio/webm;codecs=opus' });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      const buf = new Uint8Array(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      res(btoa(s));
    };
    rec.start(1000);
    setTimeout(() => rec.stop(), ms);
  }), secs * 1000);
  fs.writeFileSync(music, Buffer.from(b64, 'base64'));
  await b2.close();
  console.log('recorded the music');
}

// ---------------------------------------------------------------------------------------------- cutting it together
// hard cuts between the clips, a slow dissolve into the start screen, the music fading in and out
const n = clips.length, fade = FADE, total = n + 6;   // every clip a second, the last one plus the dissolve
const inputs = [...clips, title].flatMap((c) => ['-i', c]);
const cuts = clips.map((_, i) => `[${i}:v]`).join('') + `concat=n=${n}:v=1:a=0[cuts]`;
const filter = `${cuts};[cuts]settb=AVTB,fps=${FPS}[c];[${n}:v]settb=AVTB,fps=${FPS}[t];[c][t]xfade=transition=fade:duration=${fade}:offset=${n}[v0];[v0]fade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8[v];` +
  `[${n + 1}:a]atrim=start=0.4,asetpts=PTS-STARTPTS,loudnorm=I=-19:TP=-2:LRA=9,afade=t=in:d=0.6,afade=t=out:st=${(total - 3).toFixed(2)}:d=3,atrim=end=${total.toFixed(2)}[a]`;
const final = path.join(out, 'trailer.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-i', music, '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final]);
console.log('wrote', final, `(${total.toFixed(1)} s)`);
console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
