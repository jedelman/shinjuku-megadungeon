// Record a minute on a platform, with sound: node tests/listen.mjs [baseUrl] [outDir]
// Stands the kitten at the platform doors on the Marunouchi line's platform at Shinjuku (B2), as tests/parade.mjs does,
// with the music playing. A train comes in from the tunnel (its rumble Doppler-shifted), stops, chimes its doors open and
// closed, and leaves; then the tanuki come, drumming. Writes listen.mp4 (video and sound) if ffmpeg is on the path, and
// listen-sound.webm (the sound alone) either way. Playwright's video has no sound, so the page records its own mix and
// ffmpeg puts the two together.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'listen-out';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const probe = await browser.newPage();
await probe.goto(base + '?level=0&play&day=2026-11-10');
await probe.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.rail);
const v = await probe.evaluate(() => {
  const g = window.__game, pl = g.rail.platforms.find((x) => x.name.includes('新宿駅'));
  const tk = pl.tracks[0], tr = g.rail.tracks[tk.track], nav = g.nav(pl.o);
  const edge = (along) => {
    const at = (dd) => [tr.p[0] + tr.u[0] * along - tr.n[0] * dd, tr.p[1] + tr.u[1] * along - tr.n[1] * dd];
    let d = 0;
    while (d < 8 && !nav.inside(...at(d))) d += 0.1;
    return { d, at };
  };
  let best = null;
  for (let a = -14; a <= 14; a += 1) {
    const e = edge(tr.stop + a);
    if (!best || e.d < best.d - 0.05 || (Math.abs(e.d - best.d) <= 0.05 && Math.abs(a - 6) < Math.abs(best.a - 6))) best = { ...e, a };
  }
  const [x, z] = best.at(best.d + 0.45);
  const fx = -tr.u[0] * 0.62 + tr.n[0] * 0.78, fz = -tr.u[1] * 0.62 + tr.n[1] * 0.78;
  return { ti: tk.track, x, z, o: pl.o, yaw: Math.atan2(-fx, -fz) };
});
await probe.close();

const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(base + `?level=0&play&day=2026-11-10&x=${v.x}&z=${v.z}&o=${v.o}&yaw=${v.yaw}`);
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.trains);
await page.addStyleTag({ content: '#say{display:none!important}' });
await page.mouse.click(480, 270);   // sound starts on a tap
await page.waitForFunction(() => window.__game.sound.ctx?.state === 'running');
const lead = (Date.now() - t0) / 1000;
await page.evaluate(() => {
  const g = window.__game;
  g.S.pitch = 0.75; g.store.data.notes = [];
  const rec = new MediaRecorder(g.sound.tap(), { mimeType: 'audio/webm;codecs=opus' });
  window.__chunks = [];
  rec.ondataavailable = (e) => window.__chunks.push(e.data);
  rec.start(1000);
  window.__rec = rec;
});
const music = 4;
await page.waitForTimeout(music * 1000);
await page.evaluate((i) => window.__game.trains.force(i, false, true), v.ti);
for (let t = 0; t < 51; t++) { await page.evaluate(() => { window.__game.S.pitch = 0.75; }); await page.waitForTimeout(1000); }
await page.evaluate((i) => window.__game.trains.force(i, true, true), v.ti);
for (let t = 0; t < 24; t++) { await page.evaluate(() => { window.__game.S.pitch = 0.75; }); await page.waitForTimeout(1000); }
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
const webm = path.join(out, 'listen-video.webm'), sound = path.join(out, 'listen-sound.webm');
fs.renameSync(await video.path(), webm);
fs.writeFileSync(sound, Buffer.from(b64, 'base64'));
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', lead.toFixed(2), '-i', webm, '-i', sound, '-map', '0:v', '-map', '1:a', '-shortest',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(out, 'listen.mp4')]);
  console.log('wrote', path.join(out, 'listen.mp4'));
} catch (e) {
  console.log('wrote', sound, '(no ffmpeg to put sound and video together)', String(e).slice(0, 200));
}
await browser.close();
