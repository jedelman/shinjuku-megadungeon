// Record the tanuki parade: node tests/parade.mjs [baseUrl] [outDir]
// Stands the kitten at the platform doors on the Marunouchi line's platform at Shinjuku (B2), past the stop, looking back
// down the track; brings a tanuki "train" in from the tunnel, and records it arriving, stopping and leaving. Writes
// parade.webm, and parade.mp4 if ffmpeg is on the path.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'parade-out';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
// find the vantage first, without recording
const probe = await browser.newPage();
await probe.goto(base + '?level=0&play&day=2026-11-10');
await probe.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.rail);
const v = await probe.evaluate(() => {
  const g = window.__game, pl = g.rail.platforms.find((x) => x.name.includes('新宿駅'));
  const tk = pl.tracks[0], tr = g.rail.tracks[tk.track], nav = g.nav(pl.o);
  // find the stretch near the stop where the platform comes closest to the track: open platform doors, not a kiosk
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
  const [x, z] = best.at(best.d + 0.45);                         // right at the platform doors
  const fx = -tr.u[0] * 0.62 + tr.n[0] * 0.78, fz = -tr.u[1] * 0.62 + tr.n[1] * 0.78;   // across the track, a little toward the tunnel they come from
  return { ti: tk.track, x, z, o: pl.o, yaw: Math.atan2(-fx, -fz) };
});
await probe.close();

const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
const page = await ctx.newPage();
await page.goto(base + `?level=0&play&day=2026-11-10&x=${v.x}&z=${v.z}&o=${v.o}&yaw=${v.yaw}`);
await page.waitForFunction(() => window.__game && window.__game.S.state === 'play' && window.__game.trains);
await page.evaluate(() => { window.__game.S.pitch = 0.75; window.__game.store.data.notes = []; });
await page.waitForTimeout(1500);
await page.evaluate((i) => window.__game.trains.force(i, true, true), v.ti);
// in from the tunnel (14 s), stopped (22 s), out (14 s)
for (let t = 0; t < 48; t++) {
  await page.evaluate(() => { window.__game.S.pitch = 0.75; });
  await page.waitForTimeout(1000);
}
const video = page.video();
await ctx.close();
const webm = path.join(out, 'parade.webm');
fs.renameSync(await video.path(), webm);
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'parade.mp4')]);
  console.log('wrote', path.join(out, 'parade.mp4'));
} catch {
  console.log('wrote', webm, '(no ffmpeg for mp4)');
}
await browser.close();
