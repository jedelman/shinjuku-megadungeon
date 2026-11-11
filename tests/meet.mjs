// Record a meeting with a yokai, with sound: node tests/meet.mjs [baseUrl] [outDir] [kind]
// Walks the kitten up to tonight's kasa-obake on level 0 (or the kind given) and plays every action once: a Pounce at
// its tassel, a Sass, a clean Dodge, then the right words until it laughs. A careful little bot moves the paw (it looks a
// moment ahead and steps where nothing will be). Writes meet.mp4 (video and sound) with ffmpeg, as tests/listen.mjs does.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'meet-out';
const want = process.argv[4] || 'kasa';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const probe = await browser.newPage();
await probe.goto(base + '?level=0&play&day=2026-11-10');
await probe.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.encounters);
const p = await probe.evaluate((want) => {
  const g = window.__game, y = g.encounters.list.find((q) => q.kind === want) || g.encounters.list[0], nav = g.nav(y.o);
  for (let r = 7; r >= 4; r -= 0.5) for (let a = 0; a < 32; a++) {
    const x = y.x + Math.cos(a / 32 * Math.PI * 2) * r, z = y.z + Math.sin(a / 32 * Math.PI * 2) * r;
    if (nav.inside(x, z) && nav.ray(y.x, y.z, (x - y.x) / r, (z - y.z) / r, r) >= r - 0.1) return { kind: y.kind, x, z, o: y.o, yaw: Math.atan2(-(y.x - x), -(y.z - z)) };
  }
  return null;
}, want);
await probe.close();
if (!p) { console.log('no spot that can see the yokai'); process.exit(1); }

const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(base + `?level=0&play&day=2026-11-10&x=${p.x}&z=${p.z}&o=${p.o}&yaw=${p.yaw}`);
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.encounters);
await page.mouse.click(480, 100);
await page.waitForFunction(() => window.__game.sound.ctx?.state === 'running');
const lead = (Date.now() - t0) / 1000;
await page.evaluate(() => {
  const g = window.__game, E = g.encounters, play = E.play.bind(E);
  // the bot: looks 0.14 s ahead, steps where nothing will be, and goes for the tassel when it's safe
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
  E.play = (dt, S, input) => {
    const f = E.fight;
    if (f && f.phase === 'turn') input = { ...input, move: bot(f), act: false, digit: 0 };
    return play(dt, S, input);
  };
  const rec = new MediaRecorder(g.sound.tap(), { mimeType: 'audio/webm;codecs=opus' });
  window.__chunks = [];
  rec.ondataavailable = (e) => window.__chunks.push(e.data);
  rec.start(1000);
  window.__rec = rec;
});
const phase = (w, timeout = 10000) => page.waitForFunction((x) => window.__game.encounters.fight?.phase === x, w, { timeout });
await page.waitForTimeout(1500);
await page.keyboard.down('KeyW');
await page.waitForFunction(() => window.__game.encounters.active, null, { timeout: 15000 });
await page.keyboard.up('KeyW');
await page.waitForTimeout(2600);                       // read the intro
await page.keyboard.press('KeyE');
await phase('menu');
const pause = (ms) => page.waitForTimeout(ms);
const turnThenMenu = async () => { await phase('turn', 6000); await page.waitForFunction(() => window.__game.encounters.fight?.phase !== 'turn', null, { timeout: 9000 }); await pause(1400); if (await page.evaluate(() => window.__game.encounters.fight?.phase === 'react')) await page.keyboard.press('KeyE'); };
const sass = async (good) => {
  await page.keyboard.press('Digit3'); await phase('sass', 3000); await pause(1500);
  const i = await page.evaluate((good) => window.__game.encounters.fight.lines.findIndex((l) => l.good === good), good);
  await page.click(`#meet-menu button[data-i="${i}"]`);
  await pause(1800);
  if (await page.evaluate(() => window.__game.encounters.fight?.phase === 'react')) await page.keyboard.press('KeyE');
};
await pause(900); await page.keyboard.press('Digit2'); await pause(900); await page.keyboard.press('KeyE');   // pounce
await turnThenMenu();
await phase('menu'); await pause(600); await sass(true); await turnThenMenu();
await phase('menu'); await pause(600); await page.keyboard.press('Digit1'); await pause(900); await page.keyboard.press('KeyE'); await turnThenMenu();   // dodge
for (let n = 0; n < 4; n++) {
  const ph = await page.evaluate(() => window.__game.encounters.fight?.phase);
  if (ph === 'won' || !ph) break;
  await phase('menu'); await pause(600); await sass(true);
  if (await page.evaluate(() => window.__game.encounters.fight?.phase === 'won')) break;
  await turnThenMenu();
}
await pause(3500);
await page.keyboard.press('KeyE');
await pause(4000);
console.log(JSON.stringify(await page.evaluate(() => ({ notes: window.__game.store.data.notes, mist: window.__game.mist }))));
const b64 = await page.evaluate(() => new Promise((res) => {
  window.__rec.onstop = async () => {
    const buf = new Uint8Array(await new Blob(window.__chunks, { type: 'audio/webm' }).arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    res(btoa(s));
  };
  window.__rec.stop();
}));
const video = page.video();
await ctx.close();
const webm = path.join(out, 'meet-video.webm'), sound = path.join(out, 'meet-sound.webm');
fs.renameSync(await video.path(), webm);
fs.writeFileSync(sound, Buffer.from(b64, 'base64'));
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', lead.toFixed(2), '-i', webm, '-i', sound, '-map', '0:v', '-map', '1:a', '-shortest',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(out, 'meet.mp4')]);
  console.log('wrote', path.join(out, 'meet.mp4'));
} catch (e) {
  console.log('wrote', sound, '(no ffmpeg to put sound and video together)', String(e).slice(0, 200));
}
await browser.close();
