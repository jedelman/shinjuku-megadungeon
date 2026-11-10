import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { FloorNav, floorKey, distancesTo, nearestNode } from '../src/nav.js';
import { LEVELS } from '../src/levels.js';

const load = (s) => JSON.parse(fs.readFileSync(new URL(`../public/data/${s}.json`, import.meta.url)));

describe('world data (MLIT Tokyo Station area)', () => {
  const data = load('tokyo');
  it('has floors B2 to 1F, with the Tokyo credit line', () => {
    expect(Object.keys(data.floors).map(Number).sort((a, b) => a - b)).toEqual([-2, -1, 0, 1]);
    expect(data.meta.source).toContain('東京駅周辺屋内地図データ');
    expect(data.meta.source).toContain('mlit-indoor-tokyo-r2');
  });
  it('keeps every exit from every subway file set (144), closed ones marked', () => {
    expect(data.exits).toHaveLength(144);
    const closed = data.exits.filter((e) => e.closed).map((e) => e.n).sort();
    expect(closed).toEqual(['A5', 'B9']);
  });
  it('puts nearly all underground network nodes inside the walkable area', () => {
    for (const o of [-2, -1]) {
      const n = new FloorNav(data.floors[floorKey(o)]);
      const ns = data.nodes.filter((x) => x[2] === o);
      expect(ns.filter(([x, z]) => n.inside(x, z)).length / ns.length).toBeGreaterThan(0.95);
    }
  });
});

describe('every level', () => {
  for (const L of LEVELS) {
    const data = load(L.station);
    const gates = L.goal.at ? [] : data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
    it(`${L.id}: goal exists, start is walkable, and there's a route that never surfaces`, () => {
      if (!L.goal.at) expect(gates.length).toBeGreaterThan(0);
      expect(new FloorNav(data.floors[floorKey(L.start.o)]).inside(L.start.x, L.start.z)).toBe(true);
      const gx = L.goal.at ? L.goal.at.x : gates.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gates.length;
      const gz = L.goal.at ? L.goal.at.z : gates.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gates.length;
      const R = distancesTo(data, nearestNode(data, gx, gz, L.goal.o), { underground: true });
      const d = R.dist[nearestNode(data, L.start.x, L.start.z, L.start.o)];
      expect(Number.isFinite(d)).toBe(true);
      const km = parseFloat(L.length);
      expect(Math.abs(d / 1000 - km)).toBeLessThan(0.15); // the title card's length is honest
    });
  }
});
