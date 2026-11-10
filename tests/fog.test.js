import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { pockets, fogAt, pocketAt, mainPath, CORE, EDGE, LINES } from '../src/fog.js';
import { sew } from '../src/patches.js';
import { FloorNav, floorKey, distancesTo, nearestNode } from '../src/nav.js';
import { LEVELS } from '../src/levels.js';
import { cast } from '../src/sky.js';

const load = (s) => JSON.parse(fs.readFileSync(new URL(`../public/data/${s}.json`, import.meta.url)));

describe('how thick the fog is', () => {
  const list = [{ x: 0, z: 0, o: -1, id: 0 }];
  it('is whole in the middle, gone past the edge, and only on its own floor', () => {
    expect(fogAt(list, 0, 0, -1)).toBe(1);
    expect(fogAt(list, CORE, 0, -1)).toBe(1);
    expect(fogAt(list, CORE + EDGE / 2, 0, -1)).toBeCloseTo(0.5, 5);
    expect(fogAt(list, CORE + EDGE + 1, 0, -1)).toBe(0);
    expect(fogAt(list, 0, 0, -2)).toBe(0);
    expect(pocketAt(list, 1, 1, -1)).toBe(list[0]);
    expect(pocketAt(list, CORE + 1, 0, -1)).toBe(null);
  });
  it('has lines to notice it by', () => { expect(LINES.length).toBeGreaterThanOrEqual(4); });
});

for (const L of LEVELS) {
  describe(`the fog pockets of ${L.id}`, () => {
    const data = load(L.station);
    const gs = L.goal.at ? [] : data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
    const gx = L.goal.at ? L.goal.at.x : gs.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gs.length;
    const gz = L.goal.at ? L.goal.at.z : gs.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gs.length;
    const route = distancesTo(data, nearestNode(data, gx, gz, L.goal.o), { underground: true });
    const sky = cast('1988-08-08');
    const patches = sew(data, L, route, sky);
    const list = pockets(data, L, route, sky, patches);

    it('are the same for the same night, and move on another', () => {
      expect(pockets(data, L, route, sky, patches)).toEqual(list);
      const other = cast('1964-10-10');
      expect(pockets(data, L, route, other, sew(data, L, route, other)).map((p) => p.node)).not.toEqual(list.map((p) => p.node));
    });
    it('are real places: underground, on the floor, reachable, apart, and clear of patches', () => {
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.length).toBeLessThanOrEqual(3);
      for (const p of list) {
        expect(p.o).toBeLessThan(0);
        expect(new FloorNav(data.floors[floorKey(p.o)]).inside(p.x, p.z)).toBe(true);
        expect(Number.isFinite(route.dist[p.node])).toBe(true);
        for (const q of patches) for (const rm of q.rooms) if (rm.o === p.o) expect(Math.hypot(rm.x - p.x, rm.z - p.z)).toBeGreaterThanOrEqual(30);
        for (const q of list) if (q !== p && q.o === p.o) expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThanOrEqual(60);
      }
    });
    it('put at least one on the way, so you walk into it', () => {
      const path = new Set(mainPath(data, L, route));
      expect(list.some((p) => p.way && path.has(p.node))).toBe(true);
    });
  });
}
