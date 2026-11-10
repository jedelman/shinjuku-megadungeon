// Critters: the real small animals of Tokyo's stations, living where their lives would put them.
// Jason (2026-11-10): "Let's start to populate the megadungeon. What other critters are cute and inhabit subways?"
//
// Each species is a real urban animal in Japan, and every fact in its field notes carries its source (SOURCES, checked
// by tests/critters.test.js). Where they live is a game ecology read off the real station, not survey data: pigeons
// near the exits, geckos up on the walls, rats and pill bugs in the deep, and swallows nesting only in the patches whose
// night falls in their nesting season. census() is pure, seeded by tonight's chart; Critters renders and runs them.
import * as THREE from 'three';
import { FH, CH } from './world.js';
import { FloorNav, floorKey, nearestNode } from './nav.js';
import { box, ball, rng } from './people.js';
import { tonight, skySeed } from './sky.js';
import { egress } from './patches.js';

// the facts behind the field notes
export const SOURCES = {
  pigeon: [
    'https://www.suntory.co.jp/eco/birds/encyclopedia/detail/4642.html',
    'https://db3.bird-research.jp/news/wp-content/uploads/2016/03/13_3_feralpigeon.pdf',
  ],
  rat: ['https://www.city.minato.tokyo.jp/documents/179652/matinezumi.pdf'],
  gecko: [
    'https://www.env.go.jp/garden/kokyogaien/news/2018/08/post_291.html',
    'https://www.tohoku.ac.jp/japanese/newimg/pressimg/tohokuuniv-press20221201_02web_gecko.pdf',
  ],
  pillbug: [
    'https://www.city.nagoya.jp/kenkofukushi/eisei/1015269/1034848/1015298/1034491/1015373.html',
    'https://nh.kanagawa-museum.jp/assets/icp/pdf/nhr36_053-056_senzaki.pdf',
  ],
  swallow: ['https://trafficnews.jp/post/80221', 'https://tetsudo-ch.com/37471.html'],
};

export const SPECIES = {
  pigeon: {
    ja: 'ドバト', en: 'the feral pigeon',
    facts: ['Wild rock doves bred in cliff crevices. People kept them, as homing pigeons among other things, and some went wild all over the world. A station is all crevices.'],
  },
  rat: {
    ja: 'クマネズミ', en: 'the black rat',
    facts: ['Wary, and good at heights: it nests up in ceilings and between walls.'],
  },
  gecko: {
    ja: 'ニホンヤモリ', en: 'the Japanese gecko',
    facts: ['家守, "house guard": it lives close to people and comes out at night for the insects drawn to the lights.', 'Its ancestors came from China about 3,000 years ago, and followed people east.'],
  },
  pillbug: {
    ja: 'オカダンゴムシ', en: 'the pill bug',
    facts: ['It rolls itself into an almost perfect ball to stay safe. It reached Japan from abroad, probably after the Meiji era.'],
  },
  swallow: {
    ja: 'ツバメ', en: 'the swallow',
    facts: ['Swallows nest in stations because the crowds keep predators away. Railways put boards under the nests for the droppings, spring to summer.'],
  },
};

const NEST_MONTHS = [4, 5, 6, 7, 8];   // swallows raise their young spring to summer
// the smallest are drawn bigger than life, so a 240-line screen can show them (a game choice, not their real size)
const SHOWN = { gecko: 1.6, pillbug: 1.6, swallow: 1.3 };
const WALLS_FOR_GECKOS = new Set(['edge', 'room', 'shop', 'col', 'office', 'info', 'public']);

// Who lives where tonight. Pure: the same chart and level always give the same animals in the same places.
export function census(data, level, route, day, patches = []) {
  const sky = typeof day === 'string' ? tonight(day) : day;
  const r = rng(skySeed(sky, `${level.id}|critters`));
  const pick = (a) => a[Math.floor(r() * a.length)];
  const eg = egress(data);
  const navs = new Map();
  const nav = (o) => { const k = floorKey(o); if (!navs.has(k)) navs.set(k, data.floors[k] ? new FloorNav(data.floors[k]) : null); return navs.get(k); };
  const walkable = (x, z, o) => nav(o)?.inside(x, z) ?? false;

  // the way through the level, start to goal: critters live near it, where you'll meet them
  const seq = [];
  for (let k = nearestNode(data, level.start.x, level.start.z, level.start.o), i = 0; k >= 0 && i < 6000; k = route.next[k], i++) seq.push(k);
  const way = seq.filter((_, i) => i % 4 === 0).map((k) => data.nodes[k]);
  const cand = [];
  data.nodes.forEach(([x, z, o], k) => {
    if (o >= 0 || !Number.isFinite(route.dist[k]) || !Number.isFinite(eg.dist[k]) || !walkable(x, z, o)) return;
    if (!way.some((w) => w[2] === o && Math.hypot(w[0] - x, w[1] - z) < 28)) return;
    cand.push({ k, x, z, o, depth: eg.dist[k] });
  });
  const out = [];
  const spaced = (sp, x, z, o, gap) => out.every((c) => c.species !== sp || c.o !== o || Math.hypot(c.x - x, c.z - z) >= gap);
  const place = (sp, n, ok, gap, make) => {
    const pool = cand.filter(ok);
    for (let t = 0; t < n * 30 && out.filter((c) => c.species === sp).length < n && pool.length; t++) {
      const c = pick(pool);
      if (!spaced(sp, c.x, c.z, c.o, gap)) continue;
      const got = make(c);
      if (got) out.push(...(Array.isArray(got) ? got : [got]));
    }
  };
  const depths = cand.map((c) => c.depth).sort((a, b) => a - b);
  const deep = depths.length ? depths[Math.floor(depths.length * 0.6)] : 0;

  // pigeons: flocks by the exits
  let flock = 0;
  place('pigeon', 12, (c) => c.depth <= 12, 10, (c) => {
    const n = 3 + Math.floor(r() * 3), f = flock++;
    const birds = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = 0.3 + r() * 1.2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (walkable(x, z, c.o)) birds.push({ species: 'pigeon', x, z, o: c.o, flock: f, depth: Math.round(c.depth) });
    }
    return birds.length >= 2 ? birds : null;
  });
  // black rats: the deep end of the level
  place('rat', 5, (c) => c.depth >= Math.max(12, deep), 18, (c) => ({ species: 'rat', x: c.x, z: c.z, o: c.o, depth: Math.round(c.depth) }));
  // geckos: up on a wall, by the light, not too far from daylight
  place('gecko', 6, (c) => c.depth <= 30, 14, (c) => {
    const n = nav(c.o);
    const walls = [...n.near(c.x, c.z, 4)].map((i) => n.walls[i]).filter((w) => WALLS_FOR_GECKOS.has(w[4]) && Math.hypot(w[2] - w[0], w[3] - w[1]) >= 0.6);
    if (!walls.length) return null;
    const [x1, z1, x2, z2] = pick(walls);
    const t = 0.25 + r() * 0.5, len = Math.hypot(x2 - x1, z2 - z1);
    const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
    let nx = -(z2 - z1) / len, nz = (x2 - x1) / len;               // the wall's normal, pointing into the walkable side
    if (!walkable(x + nx * 0.3, z + nz * 0.3, c.o)) { nx = -nx; nz = -nz; }
    if (!walkable(x + nx * 0.3, z + nz * 0.3, c.o)) return null;
    return { species: 'gecko', x: x + nx * 0.02, z: z + nz * 0.02, o: c.o, y: 1.5 + r() * 1.1, wall: { nx, nz, tx: (x2 - x1) / len, tz: (z2 - z1) / len }, depth: Math.round(c.depth) };
  });
  // pill bugs: damp corners, along the foot of a wall
  place('pillbug', 8, (c) => c.depth >= 8, 10, (c) => {
    const n = nav(c.o);
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const d = n.ray(c.x, c.z, dx, dz, 5);
      if (d < 5 && d > 0.4) {
        const x = c.x + dx * (d - 0.15), z = c.z + dz * (d - 0.15);
        if (walkable(x, z, c.o)) return { species: 'pillbug', x, z, o: c.o, heading: r() * Math.PI * 2, depth: Math.round(c.depth) };
      }
    }
    return null;
  });
  // swallows: a nest over the heart of each patch whose night falls in nesting season
  for (const q of patches) {
    if (!NEST_MONTHS.includes(Number(q.date.slice(5, 7)))) continue;
    out.push({ species: 'swallow', x: q.heart.x, z: q.heart.z, o: q.heart.o, patch: q.address });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- the animals

function pigeonModel() {
  const g = new THREE.Group();
  const body = ball(0.09, 0xa3a8b2, 0.13);
  body.scale.set(0.85, 0.8, 1.25);
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.08);
  head.add(ball(0.042, 0x5f7d6a, 0, 0, 0));                         // the shimmering neck and head
  head.add(box(0.014, 0.012, 0.03, 0xd8c8a0, -0.005, 0, 0.045));    // beak
  for (const s of [-1, 1]) head.add(ball(0.007, 0xd05020, 0.01, s * 0.03, 0.02));
  g.add(head);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.07, 0.15, 0);
    w.add(box(0.02, 0.06, 0.17, 0x7c818c, -0.02, s * 0.01, -0.02));
    g.add(w);
    wings.push(w);
  }
  g.add(box(0.07, 0.015, 0.09, 0x50545c, 0.12, 0, -0.14));          // tail
  for (const s of [-1, 1]) g.add(box(0.01, 0.05, 0.01, 0xc06070, 0.025, s * 0.03, 0));
  return { g, head, wings };
}

function ratModel() {
  const g = new THREE.Group();
  const body = ball(0.06, 0x6a625c, 0.055);
  body.scale.set(0.9, 0.78, 1.5);
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.1);
  const skull = ball(0.035, 0x6f6660, 0, 0, 0);
  skull.scale.set(0.9, 0.85, 1.3);
  head.add(skull);
  for (const s of [-1, 1]) {
    head.add(ball(0.022, 0xc8a0a0, 0.035, s * 0.026, -0.01));        // big round ears
    head.add(ball(0.006, 0x111111, 0.012, s * 0.02, 0.03));
  }
  const nose = ball(0.007, 0xe0a0a8, 0, 0, 0.048);
  head.add(nose);
  g.add(head);
  let parent = g;
  const tail = [];
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Group();
    t.position.set(0, i ? 0 : 0.04, i ? -0.065 : -0.09);
    t.add(box(0.008 - i * 0.002, 0.008 - i * 0.002, 0.065, 0xb8a0a0, 0, 0, -0.032));
    parent.add(t);
    tail.push(t);
    parent = t;
  }
  for (const [x, z] of [[-0.03, 0.06], [0.03, 0.06], [-0.035, -0.05], [0.035, -0.05]]) g.add(box(0.014, 0.012, 0.02, 0xd8a8a8, 0.006, x, z));
  return { g, head, nose, tail };
}

// built flat against a wall: +z out of the wall, +y up it
function geckoModel() {
  const g = new THREE.Group();
  const body = ball(0.024, 0xbcae96, 0, 0, 0.008);
  body.scale.set(0.8, 2.1, 0.45);
  g.add(body);
  const head = new THREE.Group();
  head.position.set(0, 0.062, 0.008);
  const skull = ball(0.019, 0xc2b49c, 0, 0, 0);
  skull.scale.set(1, 1.1, 0.6);
  head.add(skull);
  for (const s of [-1, 1]) head.add(ball(0.007, 0x1a1a1a, 0.004, s * 0.014, 0.006));   // big eyes
  g.add(head);
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = box(0.035, 0.008, 0.006, 0xb0a28a, sy * 0.025, sx * 0.025, 0.004);
    leg.rotation.z = sx * sy * 0.5;
    g.add(leg);
  }
  const tail = box(0.012, 0.065, 0.007, 0xb0a28a, -0.08, 0, 0.005);
  g.add(tail);
  return { g, head, tail };
}

function pillbugModel() {
  const g = new THREE.Group();
  const shell = ball(0.018, 0x4a4e52, 0.008);
  shell.scale.set(0.75, 0.5, 1.15);
  g.add(shell);
  for (let i = -1; i <= 1; i++) g.add(box(0.026, 0.003, 0.002, 0x6a6e72, 0.016, 0, i * 0.008));
  for (const s of [-1, 1]) { const a = box(0.002, 0.002, 0.014, 0x3a3e42, 0.006, s * 0.005, 0.024); a.rotation.y = s * 0.4; g.add(a); }
  const ballForm = ball(0.013, 0x4a4e52, 0.013);
  ballForm.visible = false;
  g.add(ballForm);
  return { g, shell, ballForm };
}

function swallowModel() {
  const g = new THREE.Group();
  const body = ball(0.03, 0x1f2a4a, 0);
  body.scale.set(0.8, 0.7, 1.4);
  g.add(body);
  g.add(ball(0.016, 0xb03a2a, -0.005, 0, 0.035));                   // red throat
  g.add(ball(0.02, 0xece6dc, -0.012, 0, 0.005));                    // white belly
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.02, 0.005, 0);
    const blade = box(0.1, 0.006, 0.03, 0x1a2240, 0, s * 0.05, -0.01);
    blade.rotation.y = s * 0.35;
    w.add(blade);
    g.add(w);
    wings.push(w);
  }
  for (const s of [-1, 1]) { const t = box(0.006, 0.004, 0.06, 0x1a2240, 0, s * 0.012, -0.065); t.rotation.y = s * 0.25; g.add(t); }
  return { g, wings };
}

function nestModel() {
  const g = new THREE.Group();
  const cup = ball(0.08, 0x7a5a3a, 0);
  cup.scale.set(1.2, 0.6, 1);
  g.add(cup);
  const beaks = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.045;
    g.add(ball(0.022, 0x5e564c, 0.035, x, 0.01));
    const b = box(0.024, 0.012, 0.02, 0xf0c040, 0.05, x, 0.03);
    g.add(b);
    beaks.push(b);
  }
  return { g, beaks };
}

// a steady number in [0, 1) from a place, so animals look the same every visit
const jitter = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };
const say = (sp, observation) => [`New in your field notes: ${SPECIES[sp].ja}, ${SPECIES[sp].en}.`, ...SPECIES[sp].facts, observation].filter(Boolean);

export class Critters {
  constructor(scene, data, level, route, day, store, patches, nav) {
    this.scene = scene; this.store = store; this.navOf = nav;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.list = census(data, level, route, day, patches);
    this.met = new Set();
    this.still = 0;
    for (const c of this.list) {
      const y0 = c.o * FH;
      if (c.species === 'pigeon') {
        Object.assign(c, pigeonModel(), { state: 'peck', t: jitter(c.x, c.z) * 3, home: { x: c.x, z: c.z } });
        c.g.rotation.y = jitter(c.z, c.x) * Math.PI * 2;
      } else if (c.species === 'rat') {
        Object.assign(c, ratModel(), { state: 'sniff', t: 0 });
        c.g.rotation.y = jitter(c.z, c.x) * Math.PI * 2;
      } else if (c.species === 'gecko') {
        Object.assign(c, geckoModel(), { state: 'still', t: 0 });
        c.g.position.set(c.x, y0 + c.y, c.z);
        c.g.up.set(0, 1, 0);
        c.g.lookAt(c.x + c.wall.nx, y0 + c.y, c.z + c.wall.nz);
      } else if (c.species === 'pillbug') {
        Object.assign(c, pillbugModel(), { state: 'walk', t: 0, vx: 0, vz: 0 });
      } else if (c.species === 'swallow') {
        const nest = nestModel();
        nest.g.position.set(c.x, y0 + CH - 0.12, c.z);
        const bird = swallowModel();
        const board = box(0.42, 0.015, 0.32, 0xc8a878, 0, 0, 0);   // the droppings board
        board.position.set(c.x, y0 + CH - 0.62, c.z);
        Object.assign(c, { nest, bird, board, g: new THREE.Group() });
        c.g.add(nest.g, bird.g, board);
      }
      if (c.species !== 'gecko' && c.species !== 'swallow') c.g.position.set(c.x, y0, c.z);
      if (c.species === 'swallow') { c.nest.g.scale.setScalar(SHOWN.swallow); c.bird.g.scale.setScalar(SHOWN.swallow); }
      else if (SHOWN[c.species]) c.g.scale.setScalar(SHOWN[c.species]);
      this.root.add(c.g);
    }
  }

  dispose() { this.scene.remove(this.root); }
  count(sp) { return this.list.filter((c) => c.species === sp).length; }

  // first meetings go into the field notes; returns the lines to show
  meet(sp, observation) {
    if (this.met.has(sp)) return [];
    this.met.add(sp);
    const first = this.store.note(sp);
    return first ? say(sp, observation) : [observation];
  }

  update(dt, S, time) {
    const out = [];
    this.still = S.speed < 0.05 && !S.ride ? this.still + dt : 0;
    const nav = this.navOf(S.o);
    const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw);    // where the kitten faces
    for (const c of this.list) {
      const near = c.o === S.o && Math.hypot(c.x - S.x, c.z - S.z) < 45;
      c.g.visible = near;
      if (!near) continue;
      const d = Math.hypot(c.x - S.x, c.z - S.z), y0 = c.o * FH;
      if (c.species === 'pigeon') {
        if (c.state === 'peck') {
          c.t += dt;
          c.head.position.y = 0.2 - Math.max(0, Math.sin(c.t * 5 + c.x)) * 0.08;   // peck, peck
          c.wings.forEach((w) => { w.rotation.z = 0; });
          if (S.speed > 3 && d < 2.5) {
            // zoomies: the whole flock goes up and comes down somewhere quieter
            for (const p of this.list) if (p.species === 'pigeon' && p.flock === c.flock && p.state === 'peck') {
              const ax = p.x - S.x, az = p.z - S.z, al = Math.hypot(ax, az) || 1;
              let tx = p.x + (ax / al) * 5, tz = p.z + (az / al) * 5;
              if (!nav.inside(tx, tz)) { tx = p.x; tz = p.z; }
              Object.assign(p, { state: 'fly', t: 0, from: { x: p.x, z: p.z }, to: { x: tx, z: tz } });
            }
            out.push(...this.meet('pigeon', 'These ones go up all at once at a zoomie, and come down a little way off.'));
          } else if (d < 1.2 && S.speed < 1.2) out.push(...this.meet('pigeon', "These ones don't mind a slow kitten."));
        } else {
          c.t += dt;
          const k = Math.min(1, c.t / 1.3);
          c.x = c.from.x + (c.to.x - c.from.x) * k; c.z = c.from.z + (c.to.z - c.from.z) * k;
          c.g.position.set(c.x, y0 + Math.sin(k * Math.PI) * 1.1, c.z);
          c.g.rotation.y = Math.atan2(c.to.x - c.from.x, c.to.z - c.from.z);
          c.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(time * 30) * 0.9; });
          if (k >= 1) { c.state = 'peck'; c.t = 0; }
          continue;
        }
        c.g.position.set(c.x, y0, c.z);
      } else if (c.species === 'rat') {
        c.t += dt;
        c.nose.position.y = Math.sin(time * 22 + c.x) * 0.003;
        if (c.state === 'sniff') {
          c.head.rotation.y = Math.sin(time * 1.3 + c.z) * 0.6;
          if (S.speed > 1.5 && d < 3.5) { c.state = 'flee'; c.t = 0; }
          else if (this.still > 3 && d < 5) { c.state = 'come'; c.t = 0; }
        } else if (c.state === 'flee') {
          const ax = c.x - S.x, az = c.z - S.z, al = Math.hypot(ax, az) || 1;
          [c.x, c.z] = nav.move(c.x, c.z, (ax / al) * 2.8 * dt, (az / al) * 2.8 * dt, 0.05);
          c.g.rotation.y = Math.atan2(ax, az);
          if (c.t > 1.2) { c.state = 'sniff'; c.t = 0; }
        } else if (c.state === 'come') {
          // you sat still long enough: it comes to see you
          const tx = S.x + fx * 0.45, tz = S.z + fz * 0.45, ax = tx - c.x, az = tz - c.z, al = Math.hypot(ax, az);
          if (S.speed > 1.5) { c.state = 'flee'; c.t = 0; }
          else if (al < 0.08) {
            c.state = 'friend';
            out.push(...this.meet('rat', "Sit still long enough and one comes right up, whiskers going, and decides you're all right."));
          } else {
            [c.x, c.z] = nav.move(c.x, c.z, (ax / al) * Math.min(al, 0.7 * dt), (az / al) * Math.min(al, 0.7 * dt), 0.04);
            c.g.rotation.y = Math.atan2(ax, az);
          }
        } else if (c.state === 'friend') {
          c.g.rotation.y = Math.atan2(S.x - c.x, S.z - c.z);
          c.head.rotation.y = Math.sin(time * 2) * 0.3;
          if (d > 3) { c.state = 'sniff'; c.t = 0; }
        }
        c.tail.forEach((t, i) => { t.rotation.y = Math.sin(time * 2 + i) * 0.3; t.rotation.x = 0.15; });
        c.g.position.set(c.x, y0, c.z);
      } else if (c.species === 'gecko') {
        const along = (S.x - c.x) * c.wall.tx + (S.z - c.z) * c.wall.tz;
        c.head.rotation.z = Math.sin(time * 0.7 + c.x) * 0.25;
        if (c.state === 'still' && d < 1.1) {
          // too close: it darts along the wall, away from you
          c.state = 'dart'; c.t = 0; c.dir = along > 0 ? -1 : 1;
        }
        if (c.state === 'dart') {
          c.t += dt;
          c.x += c.wall.tx * c.dir * 2.4 * dt; c.z += c.wall.tz * c.dir * 2.4 * dt;
          c.tail.rotation.z = Math.sin(time * 40) * 0.4;
          if (c.t > 0.35) c.state = 'still';
          c.g.position.set(c.x, y0 + c.y, c.z);
        }
        if (d < 2.6) out.push(...this.meet('gecko', 'This one is up by the light, waiting for moths.'));
      } else if (c.species === 'pillbug') {
        if (c.state === 'walk') {
          c.heading += Math.sin(time * 0.8 + c.x * 7) * dt * 0.8;
          const vx = Math.sin(c.heading) * 0.03 * dt, vz = Math.cos(c.heading) * 0.03 * dt;
          const [nx, nz] = nav.move(c.x, c.z, vx, vz, 0.02);
          if (Math.hypot(nx - c.x - vx, nz - c.z - vz) > 1e-4) c.heading += Math.PI * 0.6;   // bumped a wall: turn
          c.x = nx; c.z = nz;
          c.g.rotation.y = c.heading;
          c.shell.visible = true; c.ballForm.visible = false;
          if (d < 0.24 && S.speed > 0.3) {
            // a paw touches it: it rolls into a ball, and off it goes
            c.state = 'ball'; c.t = 0;
            const sp = Math.max(0.7, S.speed * 0.8), hx = Math.sin(S.head), hz = Math.cos(S.head);
            c.vx = hx * sp; c.vz = hz * sp;
            out.push(...this.meet('pillbug', 'Touch one and it rolls up tight. Then it rolls.'));
          }
        } else {
          c.t += dt;
          c.shell.visible = false; c.ballForm.visible = true;
          const [nx, nz] = nav.move(c.x, c.z, c.vx * dt, c.vz * dt, 0.013 * SHOWN.pillbug);
          if (Math.abs(nx - c.x - c.vx * dt) > 1e-4) c.vx = -c.vx * 0.5;
          if (Math.abs(nz - c.z - c.vz * dt) > 1e-4) c.vz = -c.vz * 0.5;
          c.x = nx; c.z = nz;
          const f = Math.exp(-dt * 1.6);
          c.vx *= f; c.vz *= f;
          c.ballForm.rotation.x += Math.hypot(c.vx, c.vz) * dt / (0.013 * SHOWN.pillbug);
          c.g.rotation.y = Math.atan2(c.vx, c.vz);
          if (c.t > 3.5 && Math.hypot(c.vx, c.vz) < 0.05) { c.state = 'walk'; c.heading = c.g.rotation.y; }
        }
        c.g.position.set(c.x, y0, c.z);
      } else if (c.species === 'swallow') {
        // a parent circles under the ceiling and swoops to the nest; the chicks' beaks open and shut
        const a = time * 1.1 + c.x;
        const r = 1.4 + Math.sin(time * 0.37) * 0.6;
        const bx = c.x + Math.cos(a) * r, bz = c.z + Math.sin(a) * r;
        c.bird.g.position.set(bx, y0 + CH - 0.55 + Math.sin(time * 2.3) * 0.15, bz);
        c.bird.g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2;
        c.bird.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(time * 18) * 0.6; });
        c.nest.beaks.forEach((b, i) => { b.scale.y = 1 + Math.max(0, Math.sin(time * 9 + i * 2)) * 1.2; });
        if (d < 4) out.push(...this.meet('swallow', 'A nest up on the ceiling, three chicks, and a board underneath for the droppings.'));
      }
    }
    return out;
  }
}
