// Pointless treasure: a consolation prize at the end of every dead end.
// Jason (2026-11-10): "In addition to lost items we need pointless treasure. There's so many dead ends ... that we should
// put a little consolation prize in each one."
//
// A dead end is a real one: a node of the walking network with a single link, underground, on the walkable floor,
// reachable, and not an exit, a ticket gate or the foot of a stair (those only look like dead ends because the street
// isn't mapped). Each holds one treasure, its kind drawn from tonight's chart. They do nothing. You keep them anyway.
import * as THREE from 'three';
import { FH } from './world.js';
import { FloorNav, floorKey } from './nav.js';
import { rng } from './seed.js';
import { skySeed, tonight } from './sky.js';
import { B, S, merged } from './blocks.js';

// shape: what it looks like on the floor (Katamari-level)
export const TREASURES = [
  { id: 'marble', ja: 'ビー玉', en: 'a marble', line: 'Green glass, with a bubble in it.', shape: 'ball', c: 0x6ac8a0 },
  { id: 'cap', ja: '王冠', en: 'a bottle cap', line: 'Bent. Shiny on one side.', shape: 'disc', c: 0xc8ccd0 },
  { id: 'yen', ja: '一円玉', en: 'a one-yen coin', line: 'It floats, if you lay it on water gently.', shape: 'disc', c: 0xe8e8ec },
  { id: 'crane', ja: '折り鶴', en: 'an origami crane', line: 'Folded from a receipt.', shape: 'crane', c: 0xf4f0e8 },
  { id: 'fish', ja: '醤油の魚', en: 'a soy-sauce fish', line: 'From somebody\'s bento. Empty. Still smiling.', shape: 'fish', c: 0xd84040 },
  { id: 'capsule', ja: 'カプセル', en: 'a capsule-toy capsule', line: 'The toy is long gone. It clicks shut nicely.', shape: 'ball', c: 0xf0a0c8 },
  { id: 'petal', ja: '押し花', en: 'a pressed cherry petal', line: 'Pressed flat between the pages of a timetable.', shape: 'leaf', c: 0xf6c6d4 },
  { id: 'acorn', ja: 'どんぐり', en: 'an acorn', line: 'How did it get all the way down here?', shape: 'ball', c: 0x8a5a2a },
  { id: 'button', ja: 'ボタン', en: 'a button', line: 'Navy, with four holes.', shape: 'disc', c: 0x2b3346 },
  { id: 'ticket', ja: '切符', en: 'a used ticket', line: 'Punched once. The date has worn off.', shape: 'card', c: 0xe8dcb8 },
  { id: 'band', ja: '輪ゴム', en: 'a rubber band', line: 'Perfectly good. Perfectly pointless.', shape: 'disc', c: 0xd8a860 },
  { id: 'pin', ja: 'ヘアピン', en: 'a hair pin', line: 'With a tiny plastic strawberry on it.', shape: 'card', c: 0xe04050 },
  { id: 'bell', ja: '鈴', en: 'a little bell', line: 'It rings like a cat\'s collar. You approve.', shape: 'ball', c: 0xe8c040 },
  { id: 'eraser', ja: '消しゴム', en: 'an eraser', line: 'Shaped like a rice ball.', shape: 'box', c: 0xf4f4f0 },
  { id: 'bouncy', ja: 'スーパーボール', en: 'a bouncy ball', line: 'It goes everywhere.', shape: 'ball', c: 0x40a0f0 },
  { id: 'key', ja: '鍵', en: 'a key to nothing', line: 'It fits no door in the station. You checked.', shape: 'card', c: 0xc8a850 },
  { id: 'feather', ja: '羽根', en: 'a pigeon feather', line: 'Grey, with a green shine at the base.', shape: 'leaf', c: 0x9aa0aa },
  { id: 'glass', ja: 'シーグラス', en: 'a piece of sea glass', line: 'Worn smooth, a long way from any sea.', shape: 'ball', c: 0x9ad8c8 },
  { id: 'sticker', ja: 'シール', en: 'a lucky-cat sticker', line: 'Waving at no one.', shape: 'card', c: 0xf8f0e0 },
  { id: 'starsand', ja: '星の砂', en: 'a vial of star sand', line: 'Tiny shells, each one shaped like a star.', shape: 'box', c: 0xe8dcc0 },
  { id: 'konpeito', ja: '金平糖', en: 'one konpeitō', line: 'A sugar star. Far too old to eat.', shape: 'ball', c: 0xf8e080 },
  { id: 'balloon', ja: '紙風船', en: 'a paper balloon', line: 'Flat. Blow into it and it\'s a ball.', shape: 'box', c: 0xe86060 },
  { id: 'phone', ja: '糸電話', en: 'half a string telephone', line: 'Nobody on the other end.', shape: 'box', c: 0xf0f0e8 },
  { id: 'puppet', ja: '指人形', en: 'a tanuki finger puppet', line: 'Wearing a leaf. Pretending to be something.', shape: 'ball', c: 0xa48660 },
];

// the real dead ends of a level: one link, underground, on the floor, reachable, not an exit, gate or stair foot
export function deadEnds(data, route) {
  const deg = new Array(data.nodes.length).fill(0);
  for (const [a, b] of data.links) { deg[a]++; deg[b]++; }
  const stair = new Set();
  for (const c of data.conns) { stair.add(c.a); stair.add(c.b); }
  const navs = new Map();
  const inside = (x, z, o) => {
    const k = floorKey(o);
    if (!navs.has(k)) navs.set(k, data.floors[k] ? new FloorNav(data.floors[k]) : null);
    return navs.get(k)?.inside(x, z) ?? false;
  };
  const out = [];
  data.nodes.forEach(([x, z, o], k) => {
    if (deg[k] !== 1 || o >= 0 || stair.has(k) || !Number.isFinite(route.dist[k]) || !inside(x, z, o)) return;
    if (data.exits.some((e) => e.o === o && Math.hypot(e.x - x, e.z - z) < 8)) return;
    if (data.gates.some((g) => g.o === o && Math.hypot((g.a[0] + g.b[0]) / 2 - x, (g.a[1] + g.b[1]) / 2 - z) < 5)) return;
    out.push(k);
  });
  return out;
}

// what lies in each dead end tonight
export function hoard(data, level, route, day) {
  const sky = typeof day === 'string' ? tonight(day) : day;
  return deadEnds(data, route).map((k) => {
    const r = rng(skySeed(sky, `${level.id}|treasure|${k}`));
    const [x, z, o] = data.nodes[k];
    return { node: k, x, z, o, kind: TREASURES[Math.floor(r() * TREASURES.length)].id, key: `${sky.date}|${level.id}|${k}` };
  });
}

function model(t) {
  const shapes = {
    ball: () => [S(0.03, t.c, 0, 0.03, 0)],
    disc: () => [B(0.06, 0.008, 0.06, t.c, 0, 0.004, 0)],
    box: () => [B(0.06, 0.045, 0.045, t.c, 0, 0.022, 0)],
    card: () => [B(0.07, 0.004, 0.035, t.c, 0, 0.002, 0)],
    leaf: () => [B(0.05, 0.004, 0.03, t.c, 0, 0.002, 0), B(0.015, 0.004, 0.01, t.c, 0.03, 0.002, 0)],
    crane: () => [B(0.08, 0.004, 0.02, t.c, 0, 0.03, 0), B(0.02, 0.04, 0.05, t.c, 0, 0.02, 0)],
    fish: () => [S(0.022, t.c, 0, 0.022, 0, 1.7, 0.9, 0.9), B(0.02, 0.025, 0.006, t.c, -0.045, 0.022, 0), B(0.008, 0.012, 0.012, 0xf0d040, 0.035, 0.04, 0)],
  };
  const g = new THREE.Group();
  g.add(merged(shapes[t.shape]()));
  const glint = merged([B(0.045, 0.045, 0.045, 0xffd0f0)]);   // a pink sparkle, so you spot it from the corridor
  glint.position.y = 0.2;
  glint.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  g.add(glint);
  return { g, glint };
}

export class Treasure {
  constructor(scene, data, level, route, day, store) {
    this.scene = scene; this.store = store;
    this.sky = typeof day === 'string' ? tonight(day) : day;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.list = hoard(data, level, route, this.sky).filter((t) => !store.found(t.key));
    this.byId = new Map(TREASURES.map((t) => [t.id, t]));
    this.tonight = 0;
    for (const t of this.list) {
      Object.assign(t, model(this.byId.get(t.kind)));
      t.g.position.set(t.x, t.o * FH, t.z);
      t.g.rotation.y = (t.node * 2.399) % (Math.PI * 2);
      this.root.add(t.g);
    }
  }

  dispose() { this.scene.remove(this.root); }

  update(dt, S, time) {
    const out = [];
    for (const t of this.list) {
      if (t.taken) continue;
      const near = t.o === S.o && Math.hypot(t.x - S.x, t.z - S.z) < 40;
      t.g.visible = near;
      if (!near) continue;
      t.glint.rotation.y = time * 2.5 + t.node;
      t.glint.position.y = 0.2 + Math.sin(time * 3 + t.node) * 0.03;
      if (Math.hypot(t.x - S.x, t.z - S.z) < 0.45) {
        // walk onto it and it's yours
        t.taken = true; t.g.visible = false;
        this.tonight++;
        const kinds = this.store.treasure(t.kind, t.key);
        const k = this.byId.get(t.kind);
        out.push(`Consolation prize: ${k.ja}, ${k.en}.`, k.line, `Completely pointless. Yours now. (${kinds} of ${TREASURES.length} kinds)`);
      }
    }
    return out;
  }
}
