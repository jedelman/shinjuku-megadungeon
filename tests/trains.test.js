import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { timetable, isTanuki, TANUKI } from '../src/trains.js';
import { Crowd, commuter } from '../src/crowd.js';
import { FloorNav, floorKey } from '../src/nav.js';
import { cast } from '../src/sky.js';
import * as THREE from 'three';

const load = (s) => JSON.parse(fs.readFileSync(new URL(`../public/data/${s}.json`, import.meta.url)));

for (const [station, railName] of [['shinjuku', 'shinjuku-rail'], ['shinjuku-astra', 'shinjuku-rail'], ['tokyo', 'tokyo-rail']]) {
  describe(`rail in ${station} (OpenStreetMap, ODbL)`, () => {
    const data = load(station), rail = load(railName);
    it('is an ODbL file of its own, credited to OpenStreetMap', () => {
      expect(rail.meta.license).toMatch(/ODbL/);
      expect(rail.meta.source).toMatch(/OpenStreetMap/);
      expect(rail.platforms.length).toBeGreaterThan(0);
    });
    it('puts every platform on a floor of the map, and every train just off it, not on it', () => {
      for (const t of rail.tracks) {
        expect(t.colour).toMatch(/^#[0-9a-f]{6}$/);
        const f = data.floors[floorKey(t.o)];
        if (!f) continue;   // Astra's file has floors the MLIT-only file shares; Tochomae's are Astra-only
        const nav = new FloorNav(f);
        let off = 0, n = 0;
        for (let k = -0.4; k <= 0.4; k += 0.1) {
          const a = t.stop + k * t.L;
          n++;
          if (!nav.inside(t.p[0] + t.u[0] * a, t.p[1] + t.u[1] * a)) off++;
        }
        expect(off / n, `${t.line} on ${t.o}`).toBeGreaterThanOrEqual(0.8);   // the track runs beside the platform
      }
    });
  });
}

describe('the timetable', () => {
  const rail = load('shinjuku-rail'), sky = cast('1988-08-08');
  it('brings a train in, stops it with its doors open, and takes it out, the same way every time', () => {
    const tr = rail.tracks[0];
    const seen = { in: 0, stop: 0, out: 0 };
    let last = null;
    for (let t = 0; t < 400; t += 0.5) {
      const st = timetable(tr, sky, 'level', 0, t);
      expect(timetable(tr, sky, 'level', 0, t)).toEqual(st);
      if (!st) { last = null; continue; }
      seen[st.phase]++;
      if (st.phase !== 'stop') expect(st.doors).toBe(0);
      if (last && last.k === st.k) expect(Math.abs(st.s - last.s)).toBeLessThan(30);   // no jumps
      last = st;
    }
    expect(seen.in && seen.stop && seen.out).toBeTruthy();
  });
  it('knows how fast each train is going, for the Doppler shift', () => {
    const tr = rail.tracks[0];
    let checked = 0, top = 0;
    for (let t = 0; t < 400; t += 0.25) {
      const a = timetable(tr, sky, 'level', 0, t), b = timetable(tr, sky, 'level', 0, t + 0.01);
      if (!a || !b || a.k !== b.k || a.phase !== b.phase) continue;
      expect(a.v).toBeCloseTo((b.s - a.s) / 0.01, 0);
      if (a.phase === 'stop') expect(a.v).toBe(0);
      top = Math.max(top, Math.abs(a.v));
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
    expect(top).toBeGreaterThan(15);   // a real train's pace coming out of a tunnel
    expect(top).toBeLessThan(30);
  });
  it('sends tanuki about one arrival in six', () => {
    let n = 0;
    for (let k = 0; k < 1200; k++) if (isTanuki(sky, 'level', k % 7, k)) n++;
    expect(n / 1200).toBeGreaterThan(0.1);
    expect(n / 1200).toBeLessThan(0.25);
  });
  it('has sourced field notes for the tanuki', () => {
    expect(TANUKI.facts.length).toBeGreaterThan(0);
    for (const u of TANUKI.sources) expect(u).toMatch(/^https:\/\//);
  });
});

describe('the crowd', () => {
  it('builds goofy commuters from seeds, the same each time', () => {
    const a = commuter(42), b = commuter(42);
    expect(a.speed).toBe(b.speed);
    expect(a.legs).toHaveLength(2);
  });
  it('walks people on the walking network near the kitten', () => {
    const data = load('shinjuku');
    const navs = new Map();
    const nav = (o) => { const k = floorKey(o); if (!navs.has(k)) navs.set(k, new FloorNav(data.floors[k])); return navs.get(k); };
    const crowd = new Crowd(new THREE.Scene(), data, null, nav, null, 7);
    const S = { x: 28.81, z: -426.74, o: -2, outside: false };
    for (let i = 0; i < 120; i++) crowd.update(1 / 30, S, i / 30, false);
    const act = crowd.active;
    expect(act.length).toBeGreaterThan(10);
    const inside = act.filter((p) => nav(p.o).inside(p.x, p.z)).length;
    expect(inside / act.length).toBeGreaterThan(0.8);
    for (let i = 0; i < 60; i++) crowd.update(1 / 30, S, 4 + i / 30, true);   // midnight inside a patch: nearly empty
    expect(crowd.active.filter((p) => p.mode === 'walk').length).toBeLessThanOrEqual(34);
  });
  it('is gone in a fog pocket, and comes back out of the haze when you leave it', () => {
    const data = load('shinjuku');
    const navs = new Map();
    const nav = (o) => { const k = floorKey(o); if (!navs.has(k)) navs.set(k, new FloorNav(data.floors[k])); return navs.get(k); };
    const crowd = new Crowd(new THREE.Scene(), data, null, nav, null, 7);
    const S = { x: 28.81, z: -426.74, o: -2, outside: false };
    for (let i = 0; i < 120; i++) crowd.update(1 / 30, S, i / 30, false);
    expect(crowd.active.length).toBeGreaterThan(20);
    for (let i = 0; i < 30; i++) crowd.update(1 / 30, S, 4 + i / 30, false, 1);
    for (const p of crowd.active) expect(Math.hypot(p.x - S.x, p.z - S.z)).toBeLessThanOrEqual(3.6);
    for (let i = 0; i < 300; i++) crowd.update(1 / 30, S, 5 + i / 30, false, 1);
    expect(crowd.active.length).toBe(0);
    for (let i = 0; i < 10; i++) crowd.update(1 / 30, S, 20 + i / 30, false, 0);
    expect(crowd.active.length).toBeGreaterThan(0);
    for (const p of crowd.active) expect(Math.hypot(p.x - S.x, p.z - S.z)).toBeGreaterThan(20);   // from a distance, in the haze
  });
});
