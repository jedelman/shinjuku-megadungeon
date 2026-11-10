// People and their things.
//
// Lost property (Jason, 2026-11-10): useless in the dungeon; carry it to the lost-and-found counter, where the
// owner has left word, and they give you something useful. Owners always leave word at the counter, so the
// return is always to the same place.
// Lost wanderers (Jason, 2026-11-10): people trying to get somewhere. You can help them only if you've been
// to the place they're looking for.
//
// plan() is pure (seeded by level and date), so it can be tested; People renders and runs it.
import * as THREE from 'three';
import { makeMaterial } from './ps1.js';
import { FH } from './world.js';
import { distancesTo, nearestNode } from './nav.js';

// Where the counter is. Shinjuku's is real: the Tokyo Metropolitan Government's Shinjuku terminal data marks
// StationOffice/LostandFoundoffice at the Marunouchi line's B2 station office, 1.7 m from MLIT's office polygon.
// Elsewhere the game puts the counter at a real MLIT station office near the middle of the level, and says so.
export const LOST_AND_FOUND = {
  shinjuku: { x: -68.58, z: -122.32, o: -2, real: true },
};

export const ITEMS = [
  { id: 'umbrella', ja: 'ビニール傘', en: 'a clear umbrella', owner: 'a commuter', word: "It's only a cheap umbrella, but it's mine. Thank you." },
  { id: 'glove', ja: '手袋', en: 'one glove', owner: 'a student', word: 'My left hand has been cold all week.' },
  { id: 'scarf', ja: 'マフラー', en: 'a scarf', owner: 'a grandmother', word: 'My granddaughter knitted it.' },
  { id: 'pass', ja: '定期入れ', en: 'a pass case', owner: 'an office worker', word: "My pass was in it. I've been buying tickets all week." },
  { id: 'plush', ja: 'ぬいぐるみ', en: 'a little plush', owner: 'a child', word: 'Her name is Mochi.' },
  { id: 'earbud', ja: 'イヤホン', en: 'one earbud', owner: 'a musician', word: 'The right one. I still have the left.' },
  { id: 'book', ja: '文庫本', en: 'a paperback', owner: 'a reader', word: 'I was on the last chapter.' },
];

// what owners give back, in order; after these, stamps for your book
export const REWARDS = [
  { id: 'lantern', name: 'a lantern charm', does: 'Your wand lights farther.' },
  { id: 'map', name: 'a folded station map', does: 'A map of the floor you are on.' },
  { id: 'boots', name: 'a pair of tiny boots', does: 'Zoomies are faster.' },
];

const SAYS = [
  'Excuse me… do you know the way to', 'Sorry, I think I am lost. Where is', 'I have been walking for ages. Which way is',
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

// named places a person might be looking for: gates and exits, one per name and floor
export function places(data) {
  const m = new Map();
  const add = (name, o, x, z, kind) => {
    const k = `${name}@${o}`;
    if (!m.has(k)) m.set(k, { key: k, name, o, xs: [], zs: [], kind });
    m.get(k).xs.push(x); m.get(k).zs.push(z);
  };
  for (const g of data.gates) if (g.n) add(g.n, g.o, (g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2, 'gate');
  for (const e of data.exits) if (e.n && !e.closed) add(`exit ${e.n}`, e.o, e.x, e.z, 'exit');
  return [...m.values()].map((p) => ({
    key: p.key, name: p.name, o: p.o, kind: p.kind,
    x: p.xs.reduce((a, b) => a + b, 0) / p.xs.length, z: p.zs.reduce((a, b) => a + b, 0) / p.zs.length,
  }));
}

export function plan(data, level, route, day) {
  const r = rng(hash(`${level.id}|${day}`));
  const startNode = nearestNode(data, level.start.x, level.start.z, level.start.o);
  // nodes on the route there, underground, in order
  const seq = [];
  for (let k = startNode, i = 0; k >= 0 && i < 5000; k = route.next[k], i++) seq.push(k);
  const under = data.nodes.map((n, i) => i).filter((i) => data.nodes[i][2] < 0 && Number.isFinite(route.dist[i]));
  const near = (k, rad) => under.filter((i) => {
    const a = data.nodes[i], b = data.nodes[k];
    return a[2] === b[2] && Math.hypot(a[0] - b[0], a[1] - b[1]) < rad;
  });
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const along = (f) => seq[Math.min(seq.length - 1, Math.floor(seq.length * f))];

  // lost property: a few things a short detour off the route, spread along it
  const items = [];
  const kinds = [...ITEMS];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  kinds.length = 4;
  kinds.forEach((it, j) => {
    const k = pick(near(along(0.12 + j * 0.2 + r() * 0.08), 35)) ?? along(0.2 + j * 0.2);
    const [x, z, o] = data.nodes[k];
    items.push({ ...it, x: x + (r() - 0.5) * 1.2, z: z + (r() - 0.5) * 1.2, o, taken: false });
  });

  // the lost-and-found counter
  let lf = LOST_AND_FOUND[level.station];
  if (!lf) {
    const mid = data.nodes[along(0.5)];
    const office = data.offices.filter((f) => f.o < 0).sort((a, b) => Math.hypot(a.x - mid[0], a.z - mid[1]) - Math.hypot(b.x - mid[0], b.z - mid[1]))[0];
    lf = office ? { x: office.x, z: office.z, o: office.o, real: false } : { x: mid[0], z: mid[1], o: mid[2], real: false };
  }
  const lfNode = nearestNode(data, lf.x, lf.z, lf.o, 40);
  const counter = lfNode >= 0 ? { x: data.nodes[lfNode][0], z: data.nodes[lfNode][1], o: lf.o, office: lf, real: lf.real } : null;

  // lost wanderers: each wants a named place in this station they can walk to without surfacing
  const all = places(data).filter((p) => p.o < 0);
  const wanderers = [];
  for (let j = 0; j < 3; j++) {
    const k = pick(near(along(0.2 + j * 0.28 + r() * 0.1), 30)) ?? along(0.3 + j * 0.25);
    const [x, z, o] = data.nodes[k];
    const far = all.filter((p) => Math.hypot(p.x - x, p.z - z) > 80 && !wanderers.some((w) => w.dest.key === p.key));
    if (!far.length) continue;
    const dest = pick(far);
    const dn = nearestNode(data, dest.x, dest.z, dest.o, 25);
    if (dn < 0) continue;
    const toDest = distancesTo(data, dn, { underground: true });
    if (!Number.isFinite(toDest.dist[k])) continue;
    wanderers.push({ x, z, o, node: k, dest, say: pick(SAYS), coat: Math.floor(r() * 6), path: toDest });
  }
  return { items, counter, wanderers };
}

// ---------------------------------------------------------------------------------------------- rendering

let white;
const mat = (tint, glow = 0) => {
  if (!white) { white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true; }
  return makeMaterial(white, { tint, glow });
};
function box(w, h, d, tint, y = 0, x = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3));
  const m = new THREE.Mesh(g, mat(tint));
  m.position.set(x, y, z);
  return m;
}
function ball(r, tint, y = 0, x = 0, z = 0) {
  const g = new THREE.SphereGeometry(r, 7, 5);
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3));
  const m = new THREE.Mesh(g, mat(tint));
  m.position.set(x, y, z);
  return m;
}
function label(text, fg, bg, w = 256, h = 64) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `bold ${Math.floor(h * 0.55)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.NoColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
}

const COATS = [0x3c4a5e, 0x6b3a3a, 0x4d5a3a, 0x2e2e33, 0x8a6a3a, 0x5a4a6e];
function makePerson(coat) {
  const g = new THREE.Group();
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.1, 0.82, 0);
    const leg = box(0.13, 0.8, 0.15, 0x26262b, -0.4);
    hip.add(leg);
    g.add(hip);
    legs.push(hip);
  }
  g.add(box(0.44, 0.66, 0.26, COATS[coat % COATS.length], 1.15));
  for (const s of [-1, 1]) g.add(box(0.11, 0.6, 0.12, COATS[coat % COATS.length], 1.15, s * 0.28));
  const head = ball(0.12, 0xe2c4a4, 1.6);
  g.add(head);
  g.add(ball(0.125, 0x1f1b18, 1.65, 0, -0.015));
  return { g, legs, head };
}

function makeItem(it) {
  const g = new THREE.Group();
  const tint = { umbrella: 0xdfe8ee, glove: 0x7a3a3a, scarf: 0xb84a3a, pass: 0x2e3a5e, plush: 0xf0d8c8, earbud: 0xf4f4f4, book: 0x3a6a4a }[it.id];
  if (it.id === 'umbrella') { const s = box(0.03, 0.7, 0.03, tint, 0.02); s.rotation.z = Math.PI / 2; g.add(s); const c = box(0.12, 0.1, 0.12, tint, 0.05, 0.3); g.add(c); }
  else if (it.id === 'scarf') g.add(box(0.5, 0.03, 0.12, tint, 0.015));
  else g.add(box(0.1, 0.05, 0.08, tint, 0.025));
  const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), mat(0xfff6c0, 1));
  glint.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(glint.geometry.attributes.position.count * 3).fill(1), 3));
  glint.position.y = 0.22;
  g.add(glint);
  return { g, glint };
}

export class People {
  constructor(scene, data, level, route, day, store) {
    this.scene = scene; this.data = data; this.level = level; this.store = store;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.p = plan(data, level, route, day);
    this.bag = [];
    this.returned = 0;
    this.helped = 0;
    this.items = this.p.items.map((it) => { const v = makeItem(it); v.g.position.set(it.x, it.o * FH, it.z); this.root.add(v.g); return { ...it, ...v }; });
    this.wanderers = this.p.wanderers.map((w) => {
      const v = makePerson(w.coat);
      v.g.position.set(w.x, w.o * FH, w.z);
      v.g.rotation.y = Math.atan2(w.dest.x - w.x, w.dest.z - w.z) + 1.2;
      const q = label('?', '#141414', '#f2c81c', 64, 64);
      q.scale.set(0.3, 0.3, 1); q.position.y = 2.0;
      v.g.add(q);
      this.root.add(v.g);
      return { ...w, ...v, q, state: 'lost', t: 0 };
    });
    if (this.p.counter) {
      const c = this.p.counter;
      const g = new THREE.Group();
      g.add(box(1.4, 1.0, 0.6, 0x6e6a60, 0.5));
      g.add(box(1.4, 0.05, 0.7, 0xd8d0bc, 1.02));
      const clerk = makePerson(3);
      clerk.g.position.set(0, 0, -0.55);
      clerk.g.rotation.y = 0;
      g.add(clerk.g);
      // the sign sits just above the counter, where a kitten looking up can read it
      const sign = label('忘れ物取扱所', '#ffffff', '#2c5a8a', 384, 64);
      sign.scale.set(1.5, 0.25, 1); sign.position.y = 1.35;
      g.add(sign);
      g.position.set(c.x, c.o * FH, c.z);
      // face the walkway: the clerk stands on the office side
      g.rotation.y = Math.atan2(c.x - c.office.x, c.z - c.office.z);
      this.root.add(g);
      this.counter = { ...c, g };
    }
  }

  dispose() { this.scene.remove(this.root); }

  // the closest thing you could act on, or null
  nearest(S) {
    let best = null, bd = Infinity;
    const at = (x, z, o, r, what) => {
      if (o !== S.o) return;
      const d = Math.hypot(x - S.x, z - S.z);
      if (d < r && d < bd) { bd = d; best = what; }
    };
    for (const it of this.items) if (!it.taken) at(it.x, it.z, it.o, 0.9, { kind: 'item', it, prompt: `Pick up ${it.ja} (${it.en})` });
    for (const w of this.wanderers) if (w.state === 'lost') at(w.x, w.z, w.o, 1.9, { kind: 'wanderer', w, prompt: 'Listen' });
    if (this.counter) at(this.counter.x, this.counter.z, this.counter.o, 2.6,
      { kind: 'counter', prompt: this.bag.length ? `Return ${this.bag.length} thing${this.bag.length > 1 ? 's' : ''}` : 'Lost and found' });
    return best;
  }

  // act on it; returns lines to show
  act(n, visited) {
    if (n.kind === 'item') {
      n.it.taken = true; n.it.g.visible = false;
      this.bag.push(n.it);
      return [`You picked up ${n.it.ja}, ${n.it.en}. It's no use to a kitten.`, 'Its owner will have left word at the lost-and-found.'];
    }
    if (n.kind === 'wanderer') {
      const w = n.w;
      if (!visited.has(w.dest.key)) return [`"${w.say} ${w.dest.name}?"`, "You haven't been there yet."];
      w.state = 'led'; w.t = 0; w.q.visible = false;
      this.helped++;
      this.store.bump('helped');
      return [`"${w.say} ${w.dest.name}?"`, 'You know the way. You lead them to it, and they bow. ありがとう!'];
    }
    if (n.kind === 'counter') {
      if (!this.bag.length) return [this.counter.real ? 'The lost-and-found counter. Nothing to return yet.' : 'A station office, standing in as the lost-and-found. Nothing to return yet.'];
      const out = [];
      for (const it of this.bag.splice(0)) {
        this.returned++;
        const got = this.store.reward();
        out.push(`${it.ja}: ${it.owner} left word. "${it.word}"`);
        out.push(got.id === 'stamp' ? 'They left a station stamp for your book.' : `They left you ${got.name}. ${got.does}`);
      }
      return out;
    }
    return [];
  }

  update(dt, S, time) {
    for (const it of this.items) if (!it.taken) { it.glint.rotation.y = time * 2; it.glint.position.y = 0.22 + Math.sin(time * 3 + it.x) * 0.03; }
    for (const w of this.wanderers) {
      w.g.visible = w.o === S.o && w.state !== 'gone';
      if (w.state === 'lost') {
        w.head.rotation.y = Math.sin(time * 0.7 + w.x) * 0.7;           // looking around
        w.q.position.y = 2.0 + Math.sin(time * 2 + w.z) * 0.04;
      } else if (w.state === 'led') {
        // walk the way, toward the place, and fade into the fog
        w.t += dt;
        const nx = w.path.next[w.node];
        if (nx < 0 || this.data.nodes[nx][2] !== w.o || w.t > 40) { w.state = 'gone'; continue; }
        const [tx, tz] = this.data.nodes[nx];
        const d = Math.hypot(tx - w.x, tz - w.z), step = 1.3 * dt;
        if (d <= step) { w.x = tx; w.z = tz; w.node = nx; }
        else { w.x += ((tx - w.x) / d) * step; w.z += ((tz - w.z) / d) * step; w.g.rotation.y = Math.atan2(tx - w.x, tz - w.z); }
        w.g.position.set(w.x, w.o * FH, w.z);
        const sw = Math.sin(w.t * 7) * 0.45;
        w.legs[0].rotation.x = sw; w.legs[1].rotation.x = -sw;
      }
    }
  }
}

// progress kept across levels and visits: rewards, counts, places you've been
export class Store {
  constructor(storage) {
    this.s = storage;
    this.data = { rewards: [], returned: 0, helped: 0, stamps: 0 };
    try { Object.assign(this.data, JSON.parse(storage?.getItem('md.progress') || '{}')); } catch { /* fresh */ }
  }
  save() { try { this.s?.setItem('md.progress', JSON.stringify(this.data)); } catch { /* private mode */ } }
  has(id) { return this.data.rewards.includes(id); }
  bump(k) { this.data[k] = (this.data[k] || 0) + 1; this.save(); }
  reward() {
    this.data.returned++;
    const next = REWARDS.find((r) => !this.has(r.id));
    if (next) { this.data.rewards.push(next.id); this.save(); return next; }
    this.data.stamps++; this.save();
    return { id: 'stamp' };
  }
  visited(station) {
    let set;
    try { set = new Set(JSON.parse(this.s?.getItem(`md.visited.${station}`) || '[]')); } catch { set = new Set(); }
    const save = () => { try { this.s?.setItem(`md.visited.${station}`, JSON.stringify([...set])); } catch { /* */ } };
    return { set, add: (k) => { if (set.has(k)) return false; set.add(k); save(); return true; } };
  }
}
