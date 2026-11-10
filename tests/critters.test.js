import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { census, SPECIES, SOURCES } from '../src/critters.js';
import { sew } from '../src/patches.js';
import { FloorNav, floorKey, distancesTo, nearestNode } from '../src/nav.js';
import { LEVELS } from '../src/levels.js';
import { cast } from '../src/sky.js';

const load = (s) => JSON.parse(fs.readFileSync(new URL(`../public/data/${s}.json`, import.meta.url)));

describe('field notes', () => {
  it('every species has real facts, and every fact has a source', () => {
    expect(Object.keys(SPECIES).sort()).toEqual(Object.keys(SOURCES).sort());
    for (const [id, sp] of Object.entries(SPECIES)) {
      expect(sp.ja && sp.en).toBeTruthy();
      expect(sp.facts.length).toBeGreaterThan(0);
      expect(SOURCES[id].length, id).toBeGreaterThan(0);
      for (const u of SOURCES[id]) expect(u).toMatch(/^https:\/\//);
    }
  });
});

for (const L of LEVELS) {
  describe(`the animals of ${L.id}`, () => {
    const data = load(L.station);
    const gs = L.goal.at ? [] : data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
    const gx = L.goal.at ? L.goal.at.x : gs.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gs.length;
    const gz = L.goal.at ? L.goal.at.z : gs.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gs.length;
    const route = distancesTo(data, nearestNode(data, gx, gz, L.goal.o), { underground: true });
    const sky = cast('1988-08-08');
    const patches = sew(data, L, route, sky);
    const all = census(data, L, route, sky, patches);
    const nav = (o) => new FloorNav(data.floors[floorKey(o)]);

    it('is the same for the same night, and different on another', () => {
      expect(census(data, L, route, sky, patches)).toEqual(all);
      const other = census(data, L, route, cast('1964-10-10'), sew(data, L, route, cast('1964-10-10')));
      expect(other.map((c) => [c.species, Math.round(c.x)])).not.toEqual(all.map((c) => [c.species, Math.round(c.x)]));
    });

    it('has pigeons, rats, geckos and pill bugs, all underground and on the walkable floor', () => {
      for (const sp of ['pigeon', 'rat', 'gecko', 'pillbug']) expect(all.filter((c) => c.species === sp).length, sp).toBeGreaterThan(0);
      for (const c of all) {
        expect(c.o).toBeLessThan(0);
        if (c.species === 'gecko') expect(nav(c.o).inside(c.x + c.wall.nx * 0.3, c.z + c.wall.nz * 0.3)).toBe(true);
        else if (c.species !== 'swallow') expect(nav(c.o).inside(c.x, c.z)).toBe(true);
      }
    });

    it('puts each where its life would: pigeons by the exits, rats deep, geckos up a wall', () => {
      // depth: metres from the street (walk to an exit plus its climb) at the spot each was placed by
      for (const c of all.filter((c) => c.species === 'pigeon')) expect(c.depth).toBeLessThanOrEqual(12);
      for (const c of all.filter((c) => c.species === 'rat')) expect(c.depth).toBeGreaterThanOrEqual(12);
      for (const c of all.filter((c) => c.species === 'gecko')) expect(c.depth).toBeLessThanOrEqual(30);
      for (const c of all.filter((c) => c.species === 'pillbug')) expect(c.depth).toBeGreaterThanOrEqual(8);
      for (const c of all.filter((c) => c.species === 'gecko')) {
        expect(c.y).toBeGreaterThanOrEqual(1.5);
        const n = nav(c.o);
        const near = Math.min(...[...n.near(c.x, c.z, 1)].map((i) => {
          const [x1, z1, x2, z2] = n.walls[i], vx = x2 - x1, vz = z2 - z1, L2 = vx * vx + vz * vz;
          const t = Math.max(0, Math.min(1, ((c.x - x1) * vx + (c.z - z1) * vz) / L2));
          return Math.hypot(c.x - (x1 + t * vx), c.z - (z1 + t * vz));
        }));
        expect(near).toBeLessThan(0.1);   // on the wall
      }
    });

    it('nests swallows only in the patches whose night is April to August', () => {
      const nests = all.filter((c) => c.species === 'swallow');
      const season = patches.filter((q) => { const m = Number(q.date.slice(5, 7)); return m >= 4 && m <= 8; });
      expect(nests.map((n) => n.patch).sort()).toEqual(season.map((q) => q.address).sort());
    });
  });
}
