// Trains on the platforms, and sometimes tanuki.
// Jason (2026-11-10): "we should have trains moving across platforms ... They can be katamari level of detail - goofy
// is fine." Then: "sometimes it's a train, sometimes it's a crowd of tanuki."
//
// Platforms and tracks come from OpenStreetMap (tools/build_rail.py; an ODbL file beside the MLIT one). Each track runs
// a timetable: a train comes in, stops with its doors open, and leaves. timetable() is pure, so it can be tested. About
// one arrival in six is a procession of tanuki instead: Tokyo's tanuki really do walk the railway tracks at night, and
// Meiji-era tales tell of tanuki disguising themselves as trains (偽汽車, "phantom trains").
import * as THREE from 'three';
import { FH } from './world.js';
import { B, S, merged } from './blocks.js';
import { rng, hash } from './seed.js';
import { skySeed, tonight } from './sky.js';

export const TANUKI = {
  ja: 'タヌキ', en: 'the tanuki',
  facts: [
    "Tanuki live in Tokyo's 23 wards, and at night they walk the railway tracks like trails.",
    'Meiji-era tales tell of tanuki disguising themselves as trains on the new railways: 偽汽車, phantom trains. In the stories, the real train usually won.',
  ],
  sources: ['https://dime.jp/genre/2140780/', 'https://yokai.jp/en/yokai/nise-kisha'],
};

const APPROACH = 14, DWELL = 22, LEAVE = 14, RUN = 180;   // seconds, seconds, seconds, metres

// Where a track's train is at time t (seconds), or null between trains. Pure.
// Returns { k (which arrival), phase: 'in' | 'stop' | 'out', s (metres along the track from its stop), doors (0..1) }.
export function timetable(track, sky, levelId, index, t) {
  const r = rng(skySeed(sky, `${levelId}|track|${index}`));
  const period = 75 + Math.floor(r() * 90);                  // a train every 75–165 s
  const offset = r() * period;
  const dir = r() < 0.5 ? 1 : -1;
  const k = Math.floor((t + offset) / period);
  const x = (t + offset) - k * period;
  let phase, s, doors = 0;
  if (x < APPROACH) { phase = 'in'; const q = 1 - x / APPROACH; s = -dir * RUN * q * q; }
  else if (x < APPROACH + DWELL) { phase = 'stop'; s = 0; const d = x - APPROACH; doors = Math.min(1, d / 2, (DWELL - d) / 2); }
  else if (x < APPROACH + DWELL + LEAVE) { phase = 'out'; const q = (x - APPROACH - DWELL) / LEAVE; s = dir * RUN * q * q; }
  else return null;
  return { k, phase, s, doors: Math.max(0, doors), dir, tanuki: isTanuki(sky, levelId, index, k) };
}

// one arrival in six is tanuki, decided by tonight's sky
export function isTanuki(sky, levelId, index, k) {
  return rng(hash(`${skySeed(sky, levelId)}|${index}|${k}|tanuki`))() < 1 / 6;
}

// ---------------------------------------------------------------------------------------------- the trains

// Katamari-level: each car is one merged mesh, plus two meshes of door leaves that slide apart
function trainModel(track) {
  const g = new THREE.Group();
  const cars = Math.max(2, Math.round((track.L * 0.92) / 18));
  const len = 17.4, colour = new THREE.Color(track.colour).getHex();
  const doors = [];
  for (let i = 0; i < cars; i++) {
    const c = new THREE.Group();
    c.position.z = (i - (cars - 1) / 2) * 18;
    const parts = [
      B(2.8, 2.9, len, 0xd8dde2, 0, 1.45, 0),          // the body
      B(2.84, 0.22, len, colour, 0, 0.95, 0),          // the line's colour, a stripe
      B(2.86, 0.7, len - 1, 0x2a3038, 0, 1.75, 0),     // windows
      B(2.7, 0.15, len, 0xa8adb2, 0, 2.95, 0),         // roof
    ];
    if (i === 0 || i === cars - 1) {
      const end = i === 0 ? 1 : -1;
      parts.push(B(2.7, 1.2, 0.1, 0x1a2028, 0, 1.9, end * (len / 2 + 0.03)));                                  // front window
      for (const sx of [-0.9, 0.9]) parts.push(B(0.3, 0.18, 0.08, 0xfff4c0, sx, 0.7, end * (len / 2 + 0.05)));   // headlights
    }
    c.add(merged(parts, true));
    for (const half of [-1, 1]) {
      const leaves = [];
      for (const side of [-1, 1]) for (let d = 0; d < 3; d++) leaves.push(B(0.04, 1.9, 0.62, 0xc0c6cc, side * 1.43, 1.05, (d - 1) * 5.6 + half * 0.31));
      const m = merged(leaves, true);
      m.userData.half = half;
      c.add(m);
      doors.push(m);
    }
    g.add(c);
  }
  return { g, doors, cars };
}

// a tanuki's parts, placed at (ox, oy, oz), facing +z
function tanukiParts(ox, oy, oz, lead) {
  const P = [
    S(0.16, 0x8a7660, ox, oy + 0.22, oz, 0.9, 0.8, 1.25),          // body
    S(0.11, 0xb8a68c, ox, oy + 0.17, oz + 0.06),                    // pale belly
    S(0.105, 0x9a866e, ox, oy + 0.36, oz + 0.18),                   // head
    B(0.2, 0.05, 0.06, 0x2a2420, ox, oy + 0.36, oz + 0.26),         // the dark mask across the eyes
    S(0.035, 0xd8cbb4, ox, oy + 0.325, oz + 0.27),                  // muzzle
    S(0.03, 0x3a3028, ox - 0.06, oy + 0.44, oz + 0.17), S(0.03, 0x3a3028, ox + 0.06, oy + 0.44, oz + 0.17),   // round dark ears
    S(0.07, 0x5a4a3c, ox, oy + 0.2, oz - 0.24, 0.8, 0.8, 1.4),      // bushy tail
  ];
  if (lead) {
    P.push(B(0.09, 0.01, 0.13, 0x4a8a3a, ox, oy + 0.47, oz + 0.18));   // a leaf on the head, for the disguise
    P.push(B(0.07, 0.09, 0.07, 0xfff0a0, ox + 0.18, oy + 0.3, oz + 0.26));   // a lantern: the headlight
  }
  return P;
}

// Tanuki pretending to be a train: stacked three high in two files, so the column is train-sized. The upper two rows
// of each column are one mesh; the bottom row walks (two leg meshes each); the front stack wears the leaf and lantern.
function tanukiParade(track) {
  const g = new THREE.Group();
  const n = Math.min(10, Math.max(5, Math.round(track.L / 14)));
  const gap = 1.5, walkers = [];
  for (let i = 0; i < n; i++) {
    const z = -i * gap, upper = [];
    for (const side of [-0.32, 0.32]) {
      for (let h = 1; h < 3; h++) upper.push(...tanukiParts(side, h * 0.4, 0, i === 0 && h === 2 && side < 0));
      const w = new THREE.Group();
      w.position.set(side, 0, z);
      w.add(merged(tanukiParts(0, 0, 0, false), true));
      const legs = [];
      for (const pair of [[[-0.07, 0.11], [0.07, -0.11]], [[0.07, 0.11], [-0.07, -0.11]]]) {
        const l = new THREE.Group();
        l.position.y = 0.12;
        l.add(merged(pair.map(([x, lz]) => B(0.05, 0.12, 0.05, 0x241e1a, x, -0.06, lz)), true));
        w.add(l);
        legs.push(l);
      }
      g.add(w);
      walkers.push({ g: w, legs });
    }
    const col = merged(upper, true);
    col.position.z = z;
    g.add(col);
    walkers.push({ g: col, legs: [], top: true });
  }
  return { g, members: walkers, n, gap };
}

export class Trains {
  constructor(scene, rail, level, day, store) {
    this.scene = scene; this.store = store; this.level = level;
    this.rail = rail || { tracks: [] };
    this.sky = typeof day === 'string' ? tonight(day) : day;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.t0 = performance.now() / 1000;
    this.forced = new Map();   // for tests: a track made to run a given arrival now
    this.built = new Map();
    this.metTanuki = false;
  }

  dispose() { this.scene.remove(this.root); }

  // tests: make track i bring in a train (or tanuki) and stop now
  force(i, tanuki = false) { this.forced.set(i, { at: this.now(), tanuki }); }
  now() { return performance.now() / 1000 - this.t0; }

  state(i) {
    const tr = this.rail.tracks[i];
    const f = this.forced.get(i);
    if (f) {
      const x = this.now() - f.at + APPROACH;          // forced trains arrive already braking into the stop
      if (x < APPROACH + DWELL + LEAVE) {
        const st = { k: -1, dir: 1, tanuki: f.tanuki, phase: 'stop', s: 0, doors: 0 };
        if (x < APPROACH + DWELL) { const d = x - APPROACH; st.doors = Math.max(0, Math.min(1, d / 2, (DWELL - d) / 2)); }
        else { st.phase = 'out'; const q = (x - APPROACH - DWELL) / LEAVE; st.s = RUN * q * q; }
        return st;
      }
      this.forced.delete(i);
    }
    return timetable(tr, this.sky, this.level.id, i, this.now());
  }

  update(dt, S, time) {
    const out = [];
    this.rail.tracks.forEach((tr, i) => {
      const st = tr.o === S.o ? this.state(i) : null;
      const near = st && Math.hypot(tr.p[0] + tr.u[0] * tr.stop - S.x, tr.p[1] + tr.u[1] * tr.stop - S.z) < tr.L / 2 + 60;
      let b = this.built.get(i);
      if (!near) { if (b) { b.train.g.visible = false; b.parade.g.visible = false; } return; }
      if (!b) {
        b = { train: trainModel(tr), parade: tanukiParade(tr) };
        this.root.add(b.train.g, b.parade.g);
        this.built.set(i, b);
      }
      // place it: along the track, facing the way it's going, its floor at the platform's
      const along = tr.stop + st.s;
      const x = tr.p[0] + tr.u[0] * along, z = tr.p[1] + tr.u[1] * along;
      const yaw = Math.atan2(tr.u[0] * st.dir, tr.u[1] * st.dir);
      const show = Math.abs(st.s) < tr.L / 2 + 40;     // trains appear and vanish in the tunnel, past the fog
      const g = st.tanuki ? b.parade.g : b.train.g;
      b.train.g.visible = !st.tanuki && show;
      b.parade.g.visible = st.tanuki && show;
      if (st.tanuki) {
        g.position.set(x, tr.o * FH - 1.05, z);
        g.rotation.y = yaw;
        const half = ((b.parade.n - 1) * b.parade.gap) / 2;          // centre the column on the stop
        g.position.x += Math.sin(yaw) * half; g.position.z += Math.cos(yaw) * half;
        for (const [j, m] of b.parade.members.entries()) {
          const moving = st.phase !== 'stop';
          m.legs.forEach((l, k) => { l.rotation.x = moving ? Math.sin(time * 18 + j + k * Math.PI) * 0.7 : 0; });
          if (!m.top) m.g.rotation.y = st.phase === 'stop' ? Math.sin(time * 1.5 + j) * 0.35 : 0;   // stopped, they look round at you
          m.g.position.y = moving ? Math.abs(Math.sin(time * 18 + j)) * 0.04 : 0;
        }
        if (!this.metTanuki && st.phase === 'stop' && Math.hypot(x - S.x, z - S.z) < tr.L / 2 + 15) {
          this.metTanuki = true;
          out.push(...(this.store.note('tanuki') ? [`New in your field notes: ${TANUKI.ja}, ${TANUKI.en}.`, ...TANUKI.facts] : []),
            "That wasn't a train. That was a lot of tanuki, pretending.");
        }
      } else {
        g.position.set(x, tr.o * FH - 1.05 + 0.6, z);   // the train's floor a little below the platform's
        g.rotation.y = yaw;
        for (const d of b.train.doors) d.position.z = d.userData.half * 0.6 * st.doors;
      }
    });
    return out;
  }

  // the tracks with a train stopped at them now, for the crowd to get on and off
  stopped(S) {
    const out = [];
    this.rail.tracks.forEach((tr, i) => {
      if (tr.o !== S.o) return;
      const st = this.state(i);
      if (st && st.phase === 'stop' && st.doors > 0.5 && !st.tanuki) out.push({ tr, i });
    });
    return out;
  }
}
