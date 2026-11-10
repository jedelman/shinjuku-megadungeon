// The crowd: people shuffling about, so the station isn't empty.
// Jason (2026-11-10): "people shuffling about, it's kind of eerie with no one in here. They can be katamari level of
// detail - goofy is fine."
//
// Commuters walk the real walking network on the kitten's floor, fade in from the fog and out again, step round the
// kitten, and wait on platforms facing the tracks; when a train stops with its doors open, they get on. Inside a patch
// (another night, at midnight) the station nearly empties. Each commuter is one merged, vertex-coloured mesh for body
// and head, plus legs and arms that swing, all see-through when they're between the camera and the kitten.
import * as THREE from 'three';
import { FH } from './world.js';
import { rng } from './seed.js';
import { B, S, merged } from './blocks.js';

const COATS = [0x2b3346, 0x3a3a40, 0x222226, 0xc8b08a, 0xa8865a, 0xe8e6e0, 0xb33a3a, 0xd0a030, 0x7fa6c8, 0x4a7a5a, 0x6a4a6a, 0xd88a9a];
const SKIN = [0xf0d0b8, 0xe8c6a4, 0xd8b08a, 0xc89870, 0xa87a58];
const HAIR = [0x1a1612, 0x2a201a, 0x3a2a20, 0x6a5a50, 0xb8b0a8, 0x8a5a3a];
const LEGS = [0x22252c, 0x2a2a30, 0x3a3226, 0x1c2a44];

// a goofy, blocky commuter, from a seed
export function commuter(seed) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const coat = pick(COATS), skin = pick(SKIN), hair = pick(HAIR), legs = pick(LEGS);
  const h = 1.55 + r() * 0.3, k = h / 1.7;
  const parts = [
    B(0.48, 0.66, 0.3, coat, 0, 1.17, 0),                   // body
    S(0.17, skin, 0, 1.68, 0.01),                           // a big round head (goofy is fine)
    S(0.175, hair, 0, 1.74, -0.02, 1, 0.62, 1),             // hair
    S(0.025, 0x141414, -0.06, 1.69, 0.155), S(0.025, 0x141414, 0.06, 1.69, 0.155),   // eyes
  ];
  if (r() < 0.35) parts.push(B(0.18, 0.09, 0.05, 0xf4f4f0, 0, 1.61, 0.15));          // a mask
  if (r() < 0.45) parts.push(B(0.34, 0.26, 0.09, pick([0x2a2420, 0x1a1a20, 0x6a4a2a]), 0.32, 0.8, 0.02));   // a bag
  else if (r() < 0.3) parts.push(B(0.34, 0.42, 0.16, pick([0x2a3a5a, 0x5a2a2a, 0x2a2a2a]), 0, 1.15, -0.23)); // a backpack
  // people between the camera and the kitten turn see-through, like walls do
  const g = new THREE.Group();
  g.add(merged(parts, true));
  const limb = (w, hgt, hex, x, y) => {
    const j = new THREE.Group();
    j.position.set(x, y, 0);
    j.add(merged([B(w, hgt, w, hex, 0, -hgt / 2, 0)], true));
    g.add(j);
    return j;
  };
  const legsJ = [limb(0.15, 0.84, legs, -0.11, 0.86), limb(0.15, 0.84, legs, 0.11, 0.86)];
  const arms = [limb(0.11, 0.6, coat, -0.3, 1.46), limb(0.11, 0.6, coat, 0.3, 1.46)];
  g.scale.setScalar(k);
  return { g, legs: legsJ, arms, speed: 1.05 + r() * 0.45, lane: (r() - 0.5) * 1.1, phase: r() * 6 };
}

export class Crowd {
  constructor(scene, data, rail, nav, trains, seed = 1) {
    this.scene = scene; this.data = data; this.rail = rail || { platforms: [], tracks: [] }; this.navOf = nav; this.trains = trains;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.r = rng(seed);
    // the walking network, same-floor links only
    this.adj = Array.from({ length: data.nodes.length }, () => []);
    for (const [a, b, t] of data.links) if (t === 1 && data.nodes[a][2] === data.nodes[b][2]) { this.adj[a].push(b); this.adj[b].push(a); }
    this.byFloor = new Map();
    data.nodes.forEach((n, i) => { if (this.adj[i].length) { if (!this.byFloor.has(n[2])) this.byFloor.set(n[2], []); this.byFloor.get(n[2]).push(i); } });
    this.people = [];
    this.seed = seed;
    this.warm = true;
  }

  dispose() { this.scene.remove(this.root); }
  get active() { return this.people.filter((p) => p.on); }

  person() {
    let p = this.people.find((q) => !q.on);
    if (!p) {
      p = commuter(this.seed * 7919 + this.people.length * 104729);
      this.root.add(p.g);
      this.people.push(p);
    }
    p.on = true; p.g.visible = true;
    return p;
  }

  // a node on this floor, some way off (in the fog), or anywhere near when the station is filling up
  spawnNode(S, near) {
    const list = this.byFloor.get(S.o);
    if (!list) return -1;
    for (let t = 0; t < 24; t++) {
      const k = list[Math.floor(this.r() * list.length)];
      const [x, z] = this.data.nodes[k];
      const d = Math.hypot(x - S.x, z - S.z);
      if (d < (near ? 40 : 38) && d > (near ? 4 : 24)) return k;
    }
    return -1;
  }

  // quiet: inside a patch (another night, at midnight). empty: how deep you are in a fog pocket, 0..1
  update(dt, S, time, quiet, empty = 0) {
    const nav = this.navOf(S.o);
    const want = S.outside || S.o >= 1 || empty > 0.5 ? 0 : Math.round((quiet ? 3 : 34) * (1 - 2 * empty));
    // people too far away, or on another floor, go home; in the fog, anyone a few steps off is simply not there
    for (const p of this.active) {
      const d = Math.hypot(p.x - S.x, p.z - S.z);
      if (p.o !== S.o || d > 46 || p.gone || (empty > 0.5 && d > 3.5)) { p.on = false; p.g.visible = false; p.gone = false; }
    }
    // walkers
    let walkers = this.active.filter((p) => p.mode === 'walk').length;
    // coming out of the fog, people come back from a distance, out of the haze, not right beside you
    this.clear = empty > 0.05 ? 0 : (this.clear ?? Infinity) + dt;
    for (let t = 0; t < 5 && walkers < want; t++) {
      const k = this.spawnNode(S, this.warm && this.clear > 8);
      if (k < 0) break;
      const nb = this.adj[k];
      const p = this.person();
      Object.assign(p, { mode: 'walk', o: S.o, a: k, b: nb[Math.floor(this.r() * nb.length)], s: 0, x: this.data.nodes[k][0], z: this.data.nodes[k][1] });
      walkers++;
    }
    this.warm = walkers < want * 0.8;
    // people waiting on the platforms of this floor, near the kitten (none while a train stands there: they're boarding)
    const boarding = new Set((this.trains?.stopped(S) || []).map((s) => s.i));
    if (!quiet && empty < 0.2) for (const [pi, pl] of (this.rail.platforms || []).entries()) {
      if (pl.o !== S.o || Math.hypot(pl.c[0] - S.x, pl.c[1] - S.z) > pl.L / 2 + 30) continue;
      if (pl.tracks.some((t) => boarding.has(t.track))) continue;
      const waiting = this.active.filter((p) => p.mode === 'wait' && p.platform === pi).length;
      for (let t = waiting; t < 7; t++) {
        const tk = pl.tracks[Math.floor(this.r() * pl.tracks.length)];
        const tr = this.rail.tracks[tk.track];
        const along = (this.r() - 0.5) * pl.L * 0.8;
        // stand a step back from the platform doors, facing the track
        const d = tk.off - Math.sign(tk.off) * 1.1;
        const x = pl.c[0] + pl.u[0] * along - pl.u[1] * d, z = pl.c[1] + pl.u[1] * along + pl.u[0] * d;
        if (!nav.inside(x, z)) continue;
        const p = this.person();
        Object.assign(p, { mode: 'wait', o: S.o, platform: pi, track: tk.track, x, z, face: Math.atan2(tr.p[0] - x + tr.u[0] * ((x - tr.p[0]) * tr.u[0] + (z - tr.p[1]) * tr.u[1]), tr.p[1] - z + tr.u[1] * ((x - tr.p[0]) * tr.u[0] + (z - tr.p[1]) * tr.u[1])) });
      }
    }
    for (const p of this.active) {
      const y0 = p.o * FH;
      if (p.mode === 'walk') {
        const A = this.data.nodes[p.a], Bn = this.data.nodes[p.b];
        const L = Math.hypot(Bn[0] - A[0], Bn[1] - A[1]) || 0.01;
        const dx = (Bn[0] - A[0]) / L, dz = (Bn[1] - A[1]) / L;
        // step round the kitten
        const kx = S.x - p.x, kz = S.z - p.z, kd = Math.hypot(kx, kz);
        const slow = kd < 1.0 ? 0.45 : 1;
        p.s += p.speed * slow * dt;
        if (p.s >= L) {
          // on to the next link: mostly straight on, sometimes a turn
          const nb = this.adj[p.b].filter((q) => q !== p.a);
          const opts = nb.length ? nb : this.adj[p.b];
          let best = opts[0], bs = -Infinity;
          for (const q of opts) {
            const N = this.data.nodes[q], ql = Math.hypot(N[0] - Bn[0], N[1] - Bn[1]) || 0.01;
            const sc = ((N[0] - Bn[0]) * dx + (N[1] - Bn[1]) * dz) / ql + this.r() * 1.2;
            if (sc > bs) { bs = sc; best = q; }
          }
          p.a = p.b; p.b = best; p.s = 0;
          continue;
        }
        let lane = p.lane;
        if (kd < 1.0) lane += Math.sign((-dz) * kx + dx * kz || 1) * -0.6;      // sidestep away from the kitten
        let x = A[0] + dx * p.s - dz * lane, z = A[1] + dz * p.s + dx * lane;
        if (!nav.inside(x, z)) { x = A[0] + dx * p.s; z = A[1] + dz * p.s; }
        p.x += (x - p.x) * Math.min(1, dt * 8); p.z += (z - p.z) * Math.min(1, dt * 8);
        p.g.position.set(p.x, y0, p.z);
        p.g.rotation.y = Math.atan2(dx, dz);
        const sw = Math.sin(time * 7 * p.speed + p.phase) * 0.5 * slow;
        p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
        p.arms[0].rotation.x = -sw * 0.7; p.arms[1].rotation.x = sw * 0.7;
      } else if (p.mode === 'wait') {
        p.g.position.set(p.x, y0, p.z);
        p.g.rotation.y = p.face + Math.sin(time * 0.4 + p.phase) * 0.15;
        p.legs.forEach((l) => { l.rotation.x = 0; });
        p.arms.forEach((a, i) => { a.rotation.x = -0.9 + (i ? 0.9 : 0); });   // one hand up: checking a phone
        if (boarding.has(p.track)) { p.mode = 'board'; p.t = 0; }
      } else if (p.mode === 'board') {
        // a few steps toward the open doors, then aboard
        p.t += dt;
        p.x += Math.sin(p.face) * 1.1 * dt; p.z += Math.cos(p.face) * 1.1 * dt;
        p.g.position.set(p.x, y0, p.z);
        const sw = Math.sin(time * 8 + p.phase) * 0.5;
        p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
        if (p.t > 1.2) p.gone = true;
      }
    }
  }
}
