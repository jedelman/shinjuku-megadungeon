// Patches: the dungeon written in 4–5 room elemental building blocks and sewn onto the real station like a quilt.
//
// After Rise Up Comus (Joshy Mcroo), "The Elemental Level of Megadungeon Construction" (2026-09-03,
// https://riseupcomus.blogspot.com/2026/09/the-elemental-level-of-megadungeon.html): start with a kernel (a reason
// to explore, a reason to talk, a reason to run away), build 2–3 rooms around it, connect an intentionally blank
// room for the assembler to fill, put a gate that connects to another level, and give it an evocative name.
// "Make your megadungeons like a quilt."
//
// Here a room is a real place in the station (a ticket gate, an exit, a station office), a patch is a cluster of
// them a short walk apart, and its gate is a real stair, escalator or lift to another floor. Patches are written
// against kinds of place, never coordinates, so one patch sews into any station. They're data (patches/*.json),
// so a friend's patch is a file, checked against hard caps like any untrusted input. sew() is pure and seeded by
// tonight's chart (src/sky.js), like the people; Quilt renders it and runs the kernels.
//
// Then the underworld (src/arcana.js, after His Majesty the Worm's layout procedure): the chart deals a major arcana
// card to each patch, lowest card to the shallowest patch (nearest daylight, by walking distance to an open exit),
// highest to the deepest. Patches next to each other on the table are stitched with chalk; the others the cards
// connect are joined by portals the kitten casts with her wand.
import * as THREE from 'three';
import { FH, CH } from './world.js';
import { nearestNode, FloorNav, floorKey, MinHeap } from './nav.js';
import { places, rng, hash, box, makePerson, label } from './people.js';
import { tonight, skySeed, cast, randomDate, season, validDate, longDate } from './sky.js';
import { draw, layout, title, roman } from './arcana.js';

export const KERNELS = ['explore', 'talk', 'run'];
const ROLES = ['heart', 'room', 'blank', 'gate'];
const AT = ['gate', 'exit', 'office', 'any'];
const LINE = 160, LINES = 4;
const PROPS = ['vending', 'bench', 'cart'];

// what's wrong with a patch, as a list ([] means it's fine). Caps hold for anyone's patch.
export function checkPatch(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['a patch is an object'];
  const bad = [];
  const str = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  const lines = (a, what, need) => {
    if (a === undefined) { if (need) bad.push(`${what}: required`); return; }
    if (!Array.isArray(a) || !a.length || a.length > LINES || !a.every((l) => str(l, LINE))) bad.push(`${what}: 1 to ${LINES} lines of up to ${LINE} characters`);
  };
  if (!str(p.name, 60)) bad.push('name: an evocative name, up to 60 characters');
  if (!str(p.by, 80)) bad.push('by: who wrote it');
  if (!KERNELS.includes(p.kernel)) bad.push(`kernel: one of ${KERNELS.join(', ')}`);
  if (!str(p.idea, 200)) bad.push('idea: the kernel in a sentence, up to 200 characters');
  const rooms = Array.isArray(p.rooms) ? p.rooms : [];
  if (rooms.length < 4 || rooms.length > 5) bad.push('rooms: 4 or 5 of them');
  const n = (role) => rooms.filter((r) => r && r.role === role).length;
  if (n('heart') !== 1) bad.push('rooms: exactly one heart, where the kernel lives');
  if (n('room') < 1) bad.push('rooms: at least one room around the heart');
  if (n('blank') !== 1) bad.push('rooms: exactly one blank, left for the assembler');
  if (n('gate') < 1 || n('gate') > 2) bad.push('rooms: one or two gates to another floor');
  rooms.forEach((r, i) => {
    const what = `rooms[${i}]`;
    if (!r || typeof r !== 'object' || !ROLES.includes(r.role)) { bad.push(`${what}: role is one of ${ROLES.join(', ')}`); return; }
    if (r.at !== undefined && !AT.includes(r.at)) bad.push(`${what}.at: one of ${AT.join(', ')}`);
    if (r.prop !== undefined && !PROPS.includes(r.prop)) bad.push(`${what}.prop: one of ${PROPS.join(', ')}`);
    if (r.role === 'blank') {
      if (r.say || r.prop) bad.push(`${what}: a blank stays blank (the assembler fills it)`);
      return;
    }
    lines(r.say, `${what}.say`, true);
    if (r.role === 'heart') {
      lines(r.found, `${what}.found`, p.kernel === 'explore' || p.kernel === 'run');
      lines(r.missed, `${what}.missed`, p.kernel === 'run');
      lines(r.then, `${what}.then`, false);
    }
  });
  return bad;
}

// the quilt's own patches, one file each
const files = import.meta.glob('../patches/*.json', { eager: true, import: 'default' });
export const PATCH_FILES = Object.entries(files).map(([path, p]) => ({ file: path.split('/').pop(), patch: p }));
export const PATCHES = PATCH_FILES.filter(({ file, patch }) => {
  const bad = checkPatch(patch);
  if (bad.length) console.warn(`patch ${file} left out:`, bad.join('; '));
  return !bad.length;
}).map(({ file, patch }) => ({ id: file.replace(/\.json$/, ''), ...patch }));

const NODE = 75;    // a patch's rooms lie within this walk of its heart
const APART = 60;   // hearts of different patches at least this far apart
const ROOMS_APART = 8;
const KIND = { 4: 'Lift', 5: 'Escalator', 6: 'Stairs', 7: 'Slope' };
const floorName = (o) => (o < 0 ? `B${-o}F` : o === 0 ? 'Street' : `${o}F`);

// network adjacency, built once per station
const ADJ = new WeakMap();
function adjacency(data) {
  if (!ADJ.has(data)) {
    const adj = Array.from({ length: data.nodes.length }, () => []);
    for (const [a, b, t, d] of data.links) { const w = t === 4 ? 8 : d; adj[a].push([b, w]); adj[b].push([a, w]); }
    ADJ.set(data, adj);
  }
  return ADJ.get(data);
}
// walking distances from one node, underground only, out to max metres
export function around(data, src, max) {
  const adj = adjacency(data);
  const dist = new Map([[src, 0]]);
  const heap = new MinHeap();
  heap.push(0, src);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > dist.get(u)) continue;
    for (const [v, w] of adj[u]) {
      const nd = d + w;
      if (nd > max || data.nodes[v][2] >= 0) continue;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); heap.push(nd, v); }
    }
  }
  return dist;
}

// How far every node is from the street: walking to the nearest open exit, plus that exit's climb (MLIT puts many exits
// at the foot of their stairs, on B1 or B2; the climb is counted at the game's 5 m a floor, a design value, not data).
// This is the underworld's depth ("Dungeon levels farther away from the entrances are more difficult to access").
const EGRESS = new WeakMap();
export function egress(data) {
  if (EGRESS.has(data)) return EGRESS.get(data);
  const adj = adjacency(data);
  const dist = new Float64Array(data.nodes.length).fill(Infinity);
  const exit = new Int32Array(data.nodes.length).fill(-1);
  const heap = new MinHeap();
  data.exits.forEach((e, i) => {
    if (e.closed) return;
    const k = nearestNode(data, e.x, e.z, e.o, 15);
    const climb = Math.max(0, -e.o) * FH;
    if (k >= 0 && climb < dist[k]) { dist[k] = climb; exit[k] = i; heap.push(climb, k); }
  });
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > dist[u]) continue;
    for (const [v, w] of adj[u]) if (d + w < dist[v]) { dist[v] = d + w; exit[v] = exit[u]; heap.push(dist[v], v); }
  }
  const out = { dist, exit };
  EGRESS.set(data, out);
  return out;
}

// What placing patches on a level needs: its real places and connectors, which of them are usable (underground,
// walkable, reachable from the level's route). Built once per level.
const CTX = new WeakMap();
function context(data, route) {
  if (CTX.has(route)) return CTX.get(route);
  const navs = new Map();
  const walkable = (k) => {
    const o = data.nodes[k][2], key = floorKey(o);
    if (!navs.has(key)) navs.set(key, data.floors[key] ? new FloorNav(data.floors[key]) : null);
    return navs.get(key)?.inside(data.nodes[k][0], data.nodes[k][1]) ?? false;
  };
  // a room sits on a network node that's underground, on the walkable floor, and reachable from the route
  const ok = (k) => k >= 0 && data.nodes[k][2] < 0 && Number.isFinite(route.dist[k]) && walkable(k);
  const spots = places(data).filter((p) => p.o < 0);
  for (const f of data.offices) if (f.o < 0) spots.push({ key: `office@${Math.round(f.x)},${Math.round(f.z)},${f.o}`, name: 'a station office', kind: 'office', x: f.x, z: f.z, o: f.o });
  for (const s of spots) {
    s.node = nearestNode(data, s.x, s.z, s.o, 25);
    if (s.node >= 0) [s.x, s.z] = data.nodes[s.node];   // from here on a room is where its node is
  }
  const usable = spots.filter((s) => ok(s.node));
  const ends = [];
  data.conns.forEach((c, ci) => {
    for (const [h, t] of [[c.a, c.b], [c.b, c.a]]) {
      if (ok(h) && t >= 0 && data.nodes[t][2] < 0 && Number.isFinite(route.dist[t]) && data.nodes[t][2] !== data.nodes[h][2]) ends.push({ node: h, to: data.nodes[t][2], t: c.t, conn: ci, key: `conn${ci}@${h}` });
    }
  });
  const ctx = { data, usable, ends };
  CTX.set(route, ctx);
  return ctx;
}

// One patch on one night. Its own chart (cast for Tokyo at midnight on that date) alone decides where it lies, so
// an address like `the-last-shutter@1927-12-30` always names the same patch in a station: dungeons you can share,
// replay and test. Jason (2026-11-10): "A chart makes the patch!" Returns null if this night it doesn't fit.
export function placePatch(ctx, P, date, station) {
  const { data, usable, ends } = ctx;
  const chart = cast(date);
  const r = rng(skySeed(chart, `${station}|${P.id}`));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fits = (s, at) => !at || at === 'any' || s.kind === at;
  const at = (k) => ({ x: data.nodes[k][0], z: data.nodes[k][1], o: data.nodes[k][2], node: k });
  const defs = P.rooms;
  const hd = defs.find((d) => d.role === 'heart');
  for (const h of shuffle(usable.filter((s) => fits(s, hd.at))).slice(0, 40)) {
    const near = around(data, h.node, NODE * 1.4);
    const used = [h];
    const far = (s) => used.every((u) => Math.hypot(u.x - s.x, u.z - s.z) >= ROOMS_APART && u.node !== s.node);
    const rooms = [];
    let failed = false;
    for (const d of defs) {
      let spot;
      if (d.role === 'heart') spot = h;
      else if (d.role === 'gate') {
        spot = shuffle(ends.filter((e) => data.nodes[e.node][2] === h.o && near.has(e.node) && far(at(e.node))))[0];
        if (spot) spot = { ...spot, ...at(spot.node), name: `${KIND[spot.t] || 'Stairs'} to ${floorName(spot.to)}`, kind: 'conn' };
      } else {
        spot = shuffle(usable.filter((s) => s.o === h.o && fits(s, d.at) && (near.get(s.node) ?? Infinity) <= NODE && far(s)))[0];
      }
      if (!spot) { failed = true; break; }
      used.push(spot);
      rooms.push({ role: d.role, def: d, name: spot.name, kind: spot.kind, key: spot.key, ...at(spot.node), ...(d.role === 'gate' ? { to: spot.to, t: spot.t } : {}) });
    }
    if (failed) continue;
    return {
      id: P.id, name: P.name, by: P.by, kernel: P.kernel, idea: P.idea, rooms, heart: rooms.find((x) => x.role === 'heart'),
      date, address: `${P.id}@${date}`,
      night: { date, season: season(date), phase: chart.phase, sun: chart.planets.sun.sign, moon: chart.planets.moon.sign },
    };
  }
  return null;
}

// a patch address, `id@YYYY-MM-DD`
export function parseAddress(a) {
  const m = /^([a-z0-9-]{1,60})@(\d{4}-\d{2}-\d{2})$/.exec(String(a).trim());
  return m && validDate(m[2]) ? { id: m[1], date: m[2] } : null;
}

// Sew the night's patches onto the station. Tonight's sky picks, for each patch, a night of its own (a random date),
// trying again until it lies clear of the patches already sewn; `pick` replays exact addresses instead. Each patch's
// rooms are real places within a short walk on one floor, its gate a real connector to another underground floor,
// everything reachable from the level's route without surfacing. Then tonight's sky deals the cards.
export function sew(data, level, route, day, patches = PATCHES, { max = 4, counter = null, pick = null } = {}) {
  const sky = typeof day === 'string' ? tonight(day) : day;
  const ctx = context(data, route);
  const station = level.station;
  let out = [];
  if (pick) {
    for (const a of pick) {
      const ad = parseAddress(a);
      const P = ad && patches.find((p) => p.id === ad.id);
      const q = P && placePatch(ctx, P, ad.date, station);
      if (q && !out.some((o) => o.id === q.id)) out.push(q);
    }
  } else {
    // one greedy pass can strand the last patch, so try a few, and keep the fullest quilt
    const r = rng(skySeed(sky, `${level.id}|quilt`));
    const want = Math.min(max, patches.length);
    for (let attempt = 0; attempt < 4 && out.length < want; attempt++) {
      const order = [...patches];
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const got = [], taken = new Set();
      for (const P of order) {
        if (got.length >= max) break;
        for (let t = 0; t < 16; t++) {
          const q = placePatch(ctx, P, randomDate(r), station);
          if (!q) continue;
          if (q.rooms.some((rm) => taken.has(rm.key))) continue;
          if (got.some((o) => Math.hypot(o.heart.x - q.heart.x, o.heart.z - q.heart.z) < APART)) continue;
          for (const rm of q.rooms) taken.add(rm.key);
          got.push(q);
          break;
        }
      }
      if (got.length > out.length) out = got;
    }
  }

  // the underworld: deal tonight's cards, lowest to the patch nearest daylight, highest to the deepest
  const eg = egress(data);
  // a patch's depth is the mean over its rooms (a heart that sits on an exit doesn't make the whole patch shallow)
  // Shinjuku is riddled with exits, so patches are often equally deep; then the lower floor is deeper, then the
  // patch with the deepest room, then the name
  const key = new Map();
  for (const q of out) {
    const ds = q.rooms.map((rm) => eg.dist[rm.node]).filter(Number.isFinite);
    const mean = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : Infinity;
    q.depth = Number.isFinite(mean) ? Math.round(mean) : Infinity;
    key.set(q, [mean, -q.heart.o, ds.length ? Math.max(...ds) : Infinity]);
  }
  out.sort((a, b) => {
    const [ka, kb] = [key.get(a), key.get(b)];
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || (a.id < b.id ? -1 : 1);
  });
  const cards = draw(sky, out.length).sort((a, b) => a.n - b.n);
  out.forEach((q, i) => { q.card = cards[i]; });
  const table = out.length ? layout(cards) : null;
  const byCard = new Map(out.map((q) => [q.card.n, q]));
  for (const q of out) {
    const n = q.card.n;
    q.place = n === table.entrance ? 'entrance' : n === table.deepest ? 'deepest' : table.side.includes(n) ? 'beside' : 'between';
    // cards I–V (and the entrance) open to the street: the patch's nearest open exit, known if its card was above
    // the horizon tonight, sealed and secret if below
    q.surface = null;
    if (table.surface.includes(n)) {
      const e = data.exits[eg.exit[q.heart.node]];
      if (e) {
        const k = nearestNode(data, e.x, e.z, e.o, 15);
        q.surface = { exit: e.n, x: e.x, z: e.z, o: e.o, node: k, known: q.card.up };
      }
    }
    // connections: neighbours on the table are walked (a chalk stitch), the rest are portals
    q.portals = [];
    q.walks = [];
    for (const e of table.edges) {
      if (e.a !== n && e.b !== n) continue;
      const other = byCard.get(e.a === n ? e.b : e.a);
      if (e.how.includes('adjacent')) q.walks.push(other.id);
      else q.portals.push({ to: other.id, how: e.how });
    }
  }

  // fill the blanks: a chalk stitch to the next patch down the table (the deepest points back up, the cards beside the
  // entrance point to it); a lone patch points to the lost-and-found
  const byId = new Map(out.map((q) => [q.id, q]));
  const column = table ? table.column.map((n) => byCard.get(n)) : [];
  for (const q of out) {
    const b = q.rooms.find((x) => x.role === 'blank');
    let other = null;
    if (q.place === 'beside') other = byCard.get(table.entrance);
    else if (column.length > 1) { const i = column.indexOf(q); other = column[i + 1] || column[i - 1]; }
    else if (q.walks.length) other = byId.get(q.walks[0]);
    const target = other ? { ...other.heart, name: other.name } : counter ? { name: '忘れ物取扱所 (lost and found)', x: counter.x, z: counter.z, o: counter.o, node: nearestNode(data, counter.x, counter.z, counter.o, 40) } : null;
    b.stitch = null;
    if (target && target.node >= 0) {
      const m = Math.round(around(data, target.node, 4000).get(b.node) ?? NaN);
      if (Number.isFinite(m)) b.stitch = { name: target.name, m, o: target.o };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- rendering

// chalk marks on the floor, one per role, so a patch reads as a patch from a few metres off
function chalk(role) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(240,236,224,0.9)'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath();
  if (role === 'heart') { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 11 : 26; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); } g.closePath(); }
  else if (role === 'room') { g.arc(32, 36, 16, 0, Math.PI * 2); g.moveTo(20, 26); g.lineTo(18, 10); g.lineTo(28, 21); g.moveTo(44, 26); g.lineTo(46, 10); g.lineTo(36, 21); }
  else if (role === 'blank') { g.moveTo(10, 32); g.lineTo(52, 32); g.moveTo(40, 20); g.lineTo(52, 32); g.lineTo(40, 44); }
  else { g.moveTo(14, 18); g.lineTo(50, 18); g.lineTo(32, 48); g.closePath(); }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  return t;
}

function prop(kind) {
  const g = new THREE.Group();
  if (kind === 'vending') {
    g.add(box(0.9, 1.8, 0.7, 0xb8bcc0, 0.9));
    g.add(box(0.7, 0.9, 0.02, 0xe8f0e0, 1.25, 0, 0.36));   // the lit front
    g.add(box(0.5, 0.12, 0.02, 0x2a2a2e, 0.35, 0, 0.36));  // the slot
  } else if (kind === 'bench') {
    g.add(box(1.6, 0.06, 0.4, 0x8a7a5a, 0.42));
    for (const s of [-0.65, 0.65]) g.add(box(0.06, 0.42, 0.36, 0x4a4a4e, 0.21, s));
  } else if (kind === 'cart') {
    g.add(box(0.6, 0.5, 0.4, 0x3a6a8a, 0.35));
    g.add(box(0.04, 0.5, 0.04, 0xcfcfcf, 0.85, 0.28));
    g.add(box(0.3, 0.3, 0.3, 0xe0d050, 0.75, -0.1));
  }
  return g;
}

// Each patch is a pocket of another night: its season drifts down through the corridor, as if the station were a
// house of leaves (bigger inside than out), but a cute one.
const DRIFT = {
  sakura: { color: 0xf6c6d4, size: 0.09, fall: 0.22, sway: 0.25, say: 'Cherry petals drift down out of the ceiling.' },
  fireflies: { color: 0xd8ff7a, size: 0.07, fall: 0, sway: 0.18, say: 'Fireflies, underground.' },
  osmanthus: { color: 0xf2b230, size: 0.07, fall: 0.3, sway: 0.12, say: 'The air smells of osmanthus. Tiny gold flowers fall from nowhere.' },
  ginkgo: { color: 0xf3d03e, size: 0.11, fall: 0.34, sway: 0.35, say: 'Ginkgo leaves drift down out of the ceiling.' },
  snow: { color: 0xf4f8ff, size: 0.08, fall: 0.16, sway: 0.15, say: "It's snowing indoors, a little." },
};
export function drift(date) {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? 'sakura' : m >= 6 && m <= 8 ? 'fireflies' : m === 9 || m === 10 ? 'osmanthus' : m === 11 ? 'ginkgo' : 'snow';
}
// the fog inside a patch: its season's light, brighter under a full moon
const TINT = { spring: 0xe8c8d0, summer: 0x9fc7a8, autumn: 0xe0b860, winter: 0xc8d8e8 };
const ZONE = 9;   // within this of any of its rooms, you're in the patch's night

const dirWord = (S, x, z) => {
  const a = Math.atan2(x - S.x, z - S.z) - (S.yaw + Math.PI);   // the kitten faces yaw + π
  const d = Math.atan2(Math.sin(a), Math.cos(a));
  if (Math.abs(d) < Math.PI / 4) return 'ahead of you';
  if (Math.abs(d) > (3 * Math.PI) / 4) return 'behind you';
  return d > 0 ? 'to your left' : 'to your right';
};

export class Quilt {
  constructor(scene, data, level, route, day, store, people, nav, pick = null) {
    this.scene = scene; this.data = data; this.store = store; this.people = people;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.patches = sew(data, level, route, day, PATCHES, { counter: people?.p.counter, pick });
    this.zone = null;
    this.timer = null;
    this.walked = [];
    this.marks = [];
    this.props = 0;
    const tex = {};
    for (const q of this.patches) {
      q.seen = new Set();
      q.state = null;
      for (const rm of q.rooms) {
        const t = tex[rm.role] || (tex[rm.role] = chalk(rm.role));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        if (rm.role === 'blank' && rm.stitch === null) m.visible = false;
        m.position.set(rm.x, rm.o * FH + 0.012, rm.z);
        this.root.add(m);
        this.marks.push({ m, rm });
        const kind = rm.def.prop;
        if (kind) {
          // against the nearest wall within a few metres, facing into the passage; out in a wide concourse it
          // stands free beside the spot
          const n = nav(rm.o);
          let best = null;
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
            const d = n.ray(rm.x, rm.z, dx, dz, 7);
            if (d > 1.4 && (!best || d < best.d)) best = { a, dx, dz, d };
          }
          const off = best ? (best.d < 7 ? best.d - 0.55 : 1.4) : 0;
          const px = rm.x + (best ? best.dx : 0) * off, pz = rm.z + (best ? best.dz : 0) * off;
          if (n.inside(px, pz)) {
            const p = prop(kind);
            p.position.set(px, rm.o * FH, pz);
            p.rotation.y = (best ? best.a : 0) + Math.PI;
            this.root.add(p);
            this.props++;
            rm.propAt = [px, pz];
          }
        }
      }
      if (q.kernel === 'talk') {
        const h = q.heart;
        const v = makePerson(Math.floor(hash(q.id) % 6));
        const n = nav(h.o);
        q.px = h.x; q.pz = h.z;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          if (n.inside(h.x + Math.sin(a) * 0.9, h.z + Math.cos(a) * 0.9)) { q.px = h.x + Math.sin(a) * 0.9; q.pz = h.z + Math.cos(a) * 0.9; break; }
        }
        v.g.position.set(q.px, h.o * FH, q.pz);
        v.g.rotation.y = Math.atan2(h.x - q.px, h.z - q.pz);
        this.root.add(v.g);
        q.person = v;
      }
      // the patch's card, hung over its heart
      const card = label(roman(q.card.n), '#2a2418', '#efe6cc', 160, 96);
      card.scale.set(0.42, 0.26, 1);
      card.position.set(q.heart.x, q.heart.o * FH + 1.6, q.heart.z);
      this.root.add(card);
      q.cardSprite = card;
      // a portal in the blank, if the cards connect this patch to one it doesn't neighbour on the table
      const b = q.rooms.find((x) => x.role === 'blank');
      if (q.portals.length) {
        const g = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 18), new THREE.MeshBasicMaterial({ color: 0xc8a8ff, transparent: true, opacity: 0.9 }));
        const veil = new THREE.Mesh(new THREE.CircleGeometry(0.46, 18), new THREE.MeshBasicMaterial({ color: 0x7a4ad8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
        g.add(ring, veil);
        g.position.set(b.x, b.o * FH + 0.6, b.z);
        this.root.add(g);
        // where you step out when you arrive: just off the ring, on the floor
        const n = nav(b.o);
        let ax = b.x, az = b.z;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          if (n.inside(b.x + Math.sin(a) * 1.3, b.z + Math.cos(a) * 1.3)) { ax = b.x + Math.sin(a) * 1.3; az = b.z + Math.cos(a) * 1.3; break; }
        }
        q.portal = { g, x: b.x, z: b.z, o: b.o, ax, az, next: 0 };
      }
    }
    // each patch's night: its season drifting through it, and its light
    let seed = 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const q of this.patches) {
      const kind = drift(q.date), D = DRIFT[kind];
      // around every room of the patch, not its middle: a patch's rooms can be 75 m apart
      const cx = q.rooms.reduce((a, r) => a + r.x, 0) / q.rooms.length, cz = q.rooms.reduce((a, r) => a + r.z, 0) / q.rooms.length;
      const n = 40 * q.rooms.length, pos = new Float32Array(n * 3), y0 = q.heart.o * FH;
      const home = (i) => q.rooms[i % q.rooms.length];
      for (let i = 0; i < n; i++) { pos[i * 3] = home(i).x + (rand() - 0.5) * 9; pos[i * 3 + 1] = y0 + rand() * CH; pos[i * 3 + 2] = home(i).z + (rand() - 0.5) * 9; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: D.color, size: D.size, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false }));
      pts.frustumCulled = false;
      this.root.add(pts);
      const fog = new THREE.Color(0x8c9a8a).lerp(new THREE.Color(TINT[q.night.season]), 0.5);
      fog.multiplyScalar(0.82 + 0.3 * (1 - Math.cos((q.night.phase * Math.PI) / 180)) / 2);
      q.warp = { kind, pts, cx, cz, y0, rand, fog, home };
    }
    this.byId = new Map(this.patches.map((q) => [q.id, q]));
    this.jump = null;
  }

  // the addresses of tonight's patches, for replaying them (?patches=...)
  addresses() { return this.patches.map((q) => q.address); }

  // the spread, in order of the cards
  spread() {
    const qs = [...this.patches].sort((a, b) => a.card.n - b.card.n);
    if (!qs.length) return [];
    return [`The spread: ${qs.map((q) => `${title(q.card)}${q.place === 'entrance' ? ' (the way in)' : q.place === 'deepest' ? ' (the deepest)' : ''}`).join(' · ')}`];
  }

  dispose() { this.scene.remove(this.root); }

  nearest(S) {
    for (const q of this.patches) {
      if (q.kernel !== 'talk' || q.heart.o !== S.o) continue;
      if (Math.hypot(q.px - S.x, q.pz - S.z) < 1.9) return { from: 'quilt', kind: 'talk', q, prompt: 'Listen' };
    }
    for (const q of this.patches) {
      if (!q.portal || q.portal.o !== S.o || Math.hypot(q.portal.x - S.x, q.portal.z - S.z) > 1.6) continue;
      const to = this.byId.get(q.portals[q.portal.next % q.portals.length].to);
      return { from: 'quilt', kind: 'portal', q, prompt: `Cast: ${roman(q.card.n)} → ${title(to.card)}` };
    }
    return null;
  }

  act(n, S) {
    const q = n.q;
    if (n.kind === 'portal') {
      const link = q.portals[q.portal.next++ % q.portals.length];
      const to = this.byId.get(link.to);
      const [hi, lo] = q.card.n > to.card.n ? [q.card, to.card] : [to.card, q.card];
      const why = link.how.includes('divisible')
        ? `${roman(lo.n === 0 ? lo.n : hi.n)} is divisible by ${roman(lo.n === 0 ? hi.n : lo.n)}.`
        : `${roman(lo.n)} and ${roman(hi.n)} follow each other.`;
      const p = to.portal;
      this.jump = { x: p.ax, z: p.az, o: p.o, yaw: Math.atan2(p.ax - p.x, p.az - p.z) };
      return [`You raise your wand. The ring of ${title(q.card)} opens onto ${title(to.card)}: ${why}`, `You step out in ${to.name}.`];
    }
    const out = [...q.heart.def.say];
    const items = (this.people?.items || []).filter((it) => !it.taken);
    if (items.length) {
      const it = items.reduce((a, b) => (Math.hypot(b.x - S.x, b.z - S.z) < Math.hypot(a.x - S.x, a.z - S.z) ? b : a));
      const m = Math.round(Math.hypot(it.x - S.x, it.z - S.z));
      out.push(`"There's ${it.ja} lying about ${m} m ${dirWord(S, it.x, it.z)}${it.o !== S.o ? `, on ${floorName(it.o)}` : ''}."`);
    } else out.push('"Nothing dropped today that hasn\'t been picked up."');
    if (q.place === 'deepest' && !q.paid) { q.paid = true; out.push('For listening, this deep: a station stamp.'); this.reward(q, out); }
    const c = this.people?.counter;
    if (this.people?.bag.length && c) out.push(`"The lost-and-found is about ${Math.round(Math.hypot(c.x - S.x, c.z - S.z))} m ${dirWord(S, c.x, c.z)}${c.o !== S.o ? `, on ${floorName(c.o)}` : ''}."`);
    this.enter(q, q.heart);
    return out;
  }

  // mark a room as reached; true the first time
  enter(q, rm) {
    if (q.seen.has(rm)) return false;
    q.seen.add(rm);
    if (q.seen.size === q.rooms.length) { this.walked.push(q.name); this.store.bump('patches'); }
    return true;
  }

  // the lines for walking into a patch: its name and card, how deep it is, its way up if that's known
  arrive(q) {
    const out = [`✶ ${q.name} · ${title(q.card)}`, `You step into the night of ${longDate(q.date)}. ${DRIFT[q.warp.kind].say}`];
    const deep = Number.isFinite(q.depth) ? `${q.depth.toLocaleString()} m from the street, walking and climbing` : 'nowhere near the street';
    out.push(`Drawn for ${q.card.why}. ${q.place === 'entrance' ? `The way in, ${deep}.` : q.place === 'deepest' ? `The deepest patch tonight, ${deep}.` : `${deep[0].toUpperCase() + deep.slice(1)}.`}`);
    if (q.surface?.known) out.push(`Its way up to the street: exit ${q.surface.exit}.`);
    return out;
  }

  reward(q, out) {
    this.store.stamp();
    if (q.place === 'deepest') { this.store.stamp(); out.push('The deepest patch tonight pays twice: a second stamp.'); }
  }

  // every few frames: rooms you've walked into, the run kernel's clock. Returns lines to show.
  tick(S) {
    const out = [];
    for (const q of this.patches) {
      const w = q.surface;
      if (!w || w.known || w.found || w.o !== S.o || Math.hypot(w.x - S.x, w.z - S.z) > 6) continue;
      w.found = true;
      this.store.bump('secrets');
      out.push(`A sealed way up, found: exit ${w.exit}. ${title(q.card)} was below the horizon tonight.`);
    }
    if (this.timer && performance.now() > this.timer.until) {
      const q = this.timer.q;
      this.timer = null;
      q.state = 'missed';
      out.push(...q.heart.def.missed);
    }
    for (const q of this.patches) {
      const ring = q.rooms.filter((x) => x.role === 'room');
      for (const rm of q.rooms) {
        if (rm.o !== S.o || Math.hypot(rm.x - S.x, rm.z - S.z) > 3.5) continue;
        // the run's finish line, even if you passed it before the clock started
        if (this.timer && this.timer.q === q && rm === this.timer.gate) {
          this.timer = null;
          q.state = 'won';
          out.push(...q.heart.def.found);
          this.reward(q, out);
          this.enter(q, rm);
          continue;
        }
        // explore's find, once every room around the heart has been found
        if (rm.role === 'heart' && q.kernel === 'explore' && q.state !== 'found' && ring.every((x) => q.seen.has(x))) {
          q.state = 'found';
          out.push(...q.heart.def.found);
          this.reward(q, out);
          this.enter(q, rm);
          continue;
        }
        const first = q.seen.size === 0;
        if (!this.enter(q, rm)) {
          // a run you haven't tried yet (another patch's clock was running) starts when you come back
          if (rm.role === 'heart' && q.kernel === 'run' && q.state === null && !this.timer) this.start(q, out);
          continue;
        }
        if (first) out.push(...this.arrive(q));
        if (rm.role === 'blank') {
          out.push(rm.stitch ? `Chalked on the floor: an arrow, and "${rm.stitch.name}", ${rm.stitch.m.toLocaleString()} m${rm.stitch.o !== rm.o ? ` (${floorName(rm.stitch.o)})` : ''}.` : `${rm.name}. Nothing here yet.`);
        } else if (rm.role === 'gate') {
          out.push(...rm.def.say, `${rm.name}: this patch's way to another floor.`);
        } else if (rm.role === 'heart') {
          if (q.kernel === 'talk') continue;          // they talk when you listen
          out.push(...rm.def.say);
          if (q.kernel === 'run' && !this.timer) this.start(q, out);
        } else {
          out.push(...rm.def.say);
          if (q.kernel === 'explore' && q.state !== 'found' && ring.every((x) => q.seen.has(x)) && q.seen.has(q.heart)) {
            out.push(...(q.heart.def.then || [`Something has changed in ${q.name}.`]));
          }
        }
      }
    }
    return out;
  }

  start(q, out) {
    const g = q.rooms.find((x) => x.role === 'gate');
    const m = around(this.data, q.heart.node, NODE * 2).get(g.node) ?? NODE;
    const s = Math.round(m / 4 + 6);
    this.timer = { q, gate: g, until: performance.now() + s * 1000 };
    q.state = null;
    out.push(`${s} seconds to the ${g.name.toLowerCase()}, ${Math.round(m)} m.`);
  }

  // the run's clock, for the HUD
  clock(S) {
    if (!this.timer) return '';
    const s = Math.max(0, Math.ceil((this.timer.until - performance.now()) / 1000));
    const g = this.timer.gate;
    return `⏱ ${s} s · ${g.name}${g.o === S.o ? `, ${Math.round(Math.hypot(g.x - S.x, g.z - S.z))} m` : ''}`;
  }

  update(dt, S, time) {
    // which patch's night you're standing in
    this.zone = this.patches.find((q) => q.heart.o === S.o && q.rooms.some((rm) => Math.hypot(rm.x - S.x, rm.z - S.z) < ZONE)) || null;
    for (const q of this.patches) {
      const w = q.warp, D = DRIFT[w.kind];
      const near = q.heart.o === S.o && q.rooms.some((rm) => Math.hypot(rm.x - S.x, rm.z - S.z) < 35);
      w.pts.visible = near;
      if (!near) continue;
      const p = w.pts.geometry.attributes.position, a = p.array;
      for (let i = 0; i < p.count; i++) {
        if (D.fall) {
          a[i * 3 + 1] -= D.fall * dt * (0.7 + 0.6 * ((i * 37) % 10) / 10);
          a[i * 3] += Math.sin(time * 0.9 + i) * D.sway * dt;
          a[i * 3 + 2] += Math.cos(time * 0.7 + i * 1.3) * D.sway * dt;
          if (a[i * 3 + 1] < w.y0) { const h = w.home(i); a[i * 3 + 1] = w.y0 + CH; a[i * 3] = h.x + (w.rand() - 0.5) * 9; a[i * 3 + 2] = h.z + (w.rand() - 0.5) * 9; }
        } else {
          // fireflies hover and wander
          a[i * 3] += Math.sin(time * 0.6 + i * 2.1) * D.sway * dt;
          a[i * 3 + 1] = w.y0 + 0.4 + ((i * 0.37) % 1.6) + Math.sin(time * 1.1 + i) * 0.15;
          a[i * 3 + 2] += Math.cos(time * 0.5 + i * 1.7) * D.sway * dt;
        }
      }
      p.needsUpdate = true;
      w.pts.material.opacity = D.fall ? 0.9 : 0.55 + 0.4 * Math.sin(time * 3 + q.card.n);
    }
    for (const { m, rm } of this.marks) {
      if (rm.o !== S.o) { m.material.opacity = 0; continue; }
      const d = Math.hypot(rm.x - S.x, rm.z - S.z);
      m.material.opacity = Math.max(0, Math.min(1, (16 - d) / 8)) * 0.8;
    }
    for (const q of this.patches) {
      if (q.person) {
        q.person.g.visible = q.heart.o === S.o;
        q.person.head.rotation.y = Math.sin(time * 0.4 + q.heart.x) * 0.5;
      }
      q.cardSprite.visible = q.heart.o === S.o;
      q.cardSprite.position.y = q.heart.o * FH + 1.6 + Math.sin(time * 1.3 + q.card.n) * 0.03;
      if (q.portal) {
        q.portal.g.visible = q.portal.o === S.o;
        q.portal.g.rotation.y = time * 0.8;
        q.portal.g.children[1].material.opacity = 0.25 + 0.15 * Math.sin(time * 2.4 + q.card.n);
      }
    }
  }
}
