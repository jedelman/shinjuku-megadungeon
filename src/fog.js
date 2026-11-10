// Fog pockets: places where the fog comes in and the crowd is gone.
// Jason (2026-11-10): "We should somewhat fill this with people, so the encounters feel creepy - fog and no people, and
// some kind of yokai."
//
// The station is busy, so emptiness means something. Each night has two or three pockets, drawn from tonight's chart:
// up to two on the way to the goal (so you walk into one) and one anywhere. Inside a pocket the fog closes in, the
// people thin out and are gone, the music falls away to the drone and a draught. pockets() is pure, so it can be tested.
import { rng } from './seed.js';
import { skySeed, tonight } from './sky.js';
import { FloorNav, floorKey, nearestNode } from './nav.js';

export const CORE = 9, EDGE = 10;     // metres: thick fog within CORE of the middle, thinning out over EDGE more
const APART = 60;                     // pockets keep this far from each other
const CLEAR = 30;                     // and from a patch (another night has its own weather), the start and the goal

// what you notice as you walk in
export const LINES = [
  'The fog comes in from nowhere. Everyone has gone.',
  'The announcements have stopped.',
  'No footsteps but yours. The fog is thick here.',
  'The crowd was here a moment ago.',
  'The lights hum. Nobody else is in the fog.',
  'It is very quiet. Too quiet for a station.',
];

// the way to the goal from the level's start, node by node
export function mainPath(data, level, route) {
  const out = [];
  let k = nearestNode(data, level.start.x, level.start.z, level.start.o);
  for (let i = 0; k >= 0 && i < 5000; i++) { out.push(k); k = route.next[k]; }
  return out;
}

export function pockets(data, level, route, day, patches = []) {
  const sky = typeof day === 'string' ? tonight(day) : day;
  const r = rng(skySeed(sky, `${level.id}|fog`));
  const navs = new Map();
  const inside = (x, z, o) => {
    const k = floorKey(o);
    if (!navs.has(k)) navs.set(k, data.floors[k] ? new FloorNav(data.floors[k]) : null);
    return navs.get(k)?.inside(x, z) ?? false;
  };
  const near = (x, z, o, list, d) => list.some((p) => p.o === o && Math.hypot(p.x - x, p.z - z) < d);
  const rooms = patches.flatMap((q) => q.rooms);
  const ends = [{ ...level.start }, ...(level.goal.at ? [{ ...level.goal.at, o: level.goal.o }] : [])];
  const at = (k) => { const [x, z, o] = data.nodes[k]; return { node: k, x, z, o }; };
  const ok = (k, chosen) => {
    const p = at(k);
    return p.o < 0 && Number.isFinite(route.dist[k]) && inside(p.x, p.z, p.o) && !near(p.x, p.z, p.o, rooms, CLEAR)
      && !near(p.x, p.z, p.o, ends, CLEAR) && route.dist[k] > CLEAR && !near(p.x, p.z, p.o, chosen, APART);
  };
  const out = [];
  // on the way: somewhere between a fifth and nine tenths of the walk
  const path = mainPath(data, level, route);
  const total = route.dist[path[0]] || 0;
  const onWay = path.filter((k) => route.dist[k] < total * 0.8 && route.dist[k] > total * 0.1);
  for (let t = 0; t < 40 && out.length < 2 && onWay.length; t++) {
    const k = onWay[Math.floor(r() * onWay.length)];
    if (ok(k, out)) out.push({ ...at(k), way: true });
  }
  // and one anywhere you can reach
  const all = data.nodes.map((_, k) => k).filter((k) => data.nodes[k][2] < 0 && Number.isFinite(route.dist[k]));
  const want = out.length + 1;
  for (let t = 0; t < 80 && out.length < want && all.length; t++) {
    const k = all[Math.floor(r() * all.length)];
    if (ok(k, out)) out.push({ ...at(k), way: false });
  }
  return out.map((p, i) => ({ ...p, id: i, line: LINES[Math.floor(r() * LINES.length)] }));
}

// how deep in a pocket you are: 1 inside the core, falling to 0 at its edge
export function fogAt(list, x, z, o) {
  let h = 0;
  for (const p of list) {
    if (p.o !== o) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    const f = d <= CORE ? 1 : d >= CORE + EDGE ? 0 : 1 - (d - CORE) / EDGE;
    if (f > h) h = f;
  }
  return h * h * (3 - 2 * h);   // smooth in and out
}

// which pocket you're in, if any (for the line you notice once, and later for what's waiting in it)
export function pocketAt(list, x, z, o) {
  return list.find((p) => p.o === o && Math.hypot(p.x - x, p.z - z) < CORE) || null;
}
