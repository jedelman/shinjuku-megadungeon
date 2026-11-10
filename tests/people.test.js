import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { plan, places, Store, REWARDS, LOST_AND_FOUND } from '../src/people.js';
import { FloorNav, floorKey, distancesTo, nearestNode } from '../src/nav.js';
import { LEVELS } from '../src/levels.js';

const load = (s) => JSON.parse(fs.readFileSync(new URL(`../public/data/${s}.json`, import.meta.url)));

function routeFor(data, L) {
  const gs = data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
  const gx = gs.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gs.length;
  const gz = gs.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gs.length;
  return distancesTo(data, nearestNode(data, gx, gz, L.goal.o), { underground: true });
}

for (const L of LEVELS) {
  describe(`people in ${L.id}`, () => {
    const data = load(L.station);
    const route = routeFor(data, L);
    const p = plan(data, L, route, '2026-11-10');

    it('is the same for the same day, and changes with the day', () => {
      expect(plan(data, L, route, '2026-11-10')).toEqual(p);
      const q = plan(data, L, route, '2026-11-11');
      expect(q.items.map((i) => [i.id, i.x])).not.toEqual(p.items.map((i) => [i.id, i.x]));
    });

    it('drops four things on reachable underground floor', () => {
      expect(p.items).toHaveLength(4);
      for (const it of p.items) {
        expect(it.o).toBeLessThan(0);
        const k = nearestNode(data, it.x, it.z, it.o);
        expect(Math.hypot(data.nodes[k][0] - it.x, data.nodes[k][1] - it.z)).toBeLessThan(1.0);
        expect(Number.isFinite(route.dist[k])).toBe(true);
      }
    });

    it('has a lost-and-found counter you can reach', () => {
      expect(p.counter).toBeTruthy();
      expect(new FloorNav(data.floors[floorKey(p.counter.o)]).inside(p.counter.x, p.counter.z)).toBe(true);
      expect(p.counter.real).toBe(Boolean(LOST_AND_FOUND[L.station]));
    });

    it('has lost people whose destinations you can walk to without surfacing', () => {
      expect(p.wanderers.length).toBeGreaterThan(0);
      const names = new Set(places(data).map((x) => x.key));
      for (const w of p.wanderers) {
        expect(names.has(w.dest.key)).toBe(true);
        expect(Number.isFinite(w.path.dist[w.node])).toBe(true);
      }
    });
  });
}

describe('progress', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  it('gives rewards in order, then stamps, and remembers them', () => {
    const s = mem();
    const a = new Store(s);
    expect(REWARDS.map(() => a.reward().id)).toEqual(REWARDS.map((r) => r.id));
    expect(a.reward().id).toBe('stamp');
    const b = new Store(s);
    expect(b.has('map')).toBe(true);
    expect(b.data.stamps).toBe(1);
  });
  it('remembers places you have been, per station', () => {
    const s = mem();
    const v = new Store(s).visited('tokyo');
    expect(v.add('中央改札@-1')).toBe(true);
    expect(v.add('中央改札@-1')).toBe(false);
    expect(new Store(s).visited('tokyo').set.has('中央改札@-1')).toBe(true);
    expect(new Store(s).visited('shinjuku').set.has('中央改札@-1')).toBe(false);
  });
});
