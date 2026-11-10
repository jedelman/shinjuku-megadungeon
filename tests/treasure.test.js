import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { deadEnds, hoard, TREASURES } from '../src/treasure.js';
import { Store } from '../src/people.js';
import { FloorNav, floorKey, distancesTo, nearestNode } from '../src/nav.js';
import { LEVELS } from '../src/levels.js';
import { cast } from '../src/sky.js';

const load = (s) => JSON.parse(fs.readFileSync(new URL(`../public/data/${s}.json`, import.meta.url)));

describe('pointless treasure', () => {
  it('has kinds with names, a line each, and a shape to draw', () => {
    expect(TREASURES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TREASURES.map((t) => t.id)).size).toBe(TREASURES.length);
    for (const t of TREASURES) expect(t.ja && t.en && t.line && t.shape).toBeTruthy();
  });
  it('keeps your collection, and which dead ends you emptied', () => {
    const m = new Map(), s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    const a = new Store(s);
    expect(a.treasure('yen', 'night|l|1')).toBe(1);
    expect(a.treasure('yen', 'night|l|2')).toBe(1);
    expect(a.treasure('marble', 'night|l|3')).toBe(2);
    const b = new Store(s);
    expect(b.data.treasures.yen).toBe(2);
    expect(b.found('night|l|2')).toBe(true);
    expect(b.found('night|l|9')).toBe(false);
  });
});

for (const L of LEVELS) {
  describe(`the dead ends of ${L.id}`, () => {
    const data = load(L.station);
    const gs = L.goal.at ? [] : data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
    const gx = L.goal.at ? L.goal.at.x : gs.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gs.length;
    const gz = L.goal.at ? L.goal.at.z : gs.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gs.length;
    const route = distancesTo(data, nearestNode(data, gx, gz, L.goal.o), { underground: true });
    const ends = deadEnds(data, route);
    it('are real: one link, underground, on the floor, reachable, and not an exit or a gate', () => {
      expect(ends.length).toBeGreaterThan(20);
      const deg = new Array(data.nodes.length).fill(0);
      for (const [a, b] of data.links) { deg[a]++; deg[b]++; }
      for (const k of ends) {
        const [x, z, o] = data.nodes[k];
        expect(deg[k]).toBe(1);
        expect(o).toBeLessThan(0);
        expect(new FloorNav(data.floors[floorKey(o)]).inside(x, z)).toBe(true);
        expect(Number.isFinite(route.dist[k])).toBe(true);
        expect(data.exits.some((e) => e.o === o && Math.hypot(e.x - x, e.z - z) < 8)).toBe(false);
      }
    });
    it('each hold one treasure, the same for the same night, different on another', () => {
      const a = hoard(data, L, route, cast('1988-08-08')), b = hoard(data, L, route, cast('1988-08-08')), c = hoard(data, L, route, cast('1964-10-10'));
      expect(a).toEqual(b);
      expect(a).toHaveLength(ends.length);
      expect(new Set(a.map((t) => t.key)).size).toBe(a.length);
      for (const t of a) expect(TREASURES.some((k) => k.id === t.kind)).toBe(true);
      expect(c.map((t) => t.kind)).not.toEqual(a.map((t) => t.kind));
    });
  });
}
