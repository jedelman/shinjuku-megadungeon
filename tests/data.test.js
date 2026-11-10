import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { FloorNav, floorKey, distancesTo, nearestNode } from '../src/nav.js';
import { LEVELS } from '../src/levels.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/shinjuku.json', import.meta.url)));
const navs = {};
const nav = (o) => (navs[floorKey(o)] ??= new FloorNav(data.floors[floorKey(o)]));

describe('world data (MLIT Shinjuku)', () => {
  it('has every floor from B3 to 4F, with attribution', () => {
    expect(Object.keys(data.floors).map(Number).sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3, 4]);
    expect(data.meta.credit).toContain('国土交通省');
    expect(data.meta.source).toContain('加工して作成');
  });

  it('keeps the named exits, including A17 and the closed B12', () => {
    expect(data.exits).toHaveLength(150);
    expect(data.exits.some((e) => e.n === 'A17')).toBe(true);
    expect(data.exits.find((e) => e.n === 'B12')?.closed).toBe(true);
  });

  it('is one connected walking network', () => {
    const seen = new Set([0]);
    const adj = new Map();
    for (const [a, b] of data.links) {
      (adj.get(a) ?? adj.set(a, []).get(a)).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)).push(a);
    }
    const stack = [0];
    while (stack.length) for (const v of adj.get(stack.pop()) ?? []) if (!seen.has(v)) { seen.add(v); stack.push(v); }
    expect(seen.size).toBe(data.nodes.length);
  });

  it('puts nearly all underground network nodes inside the walkable area', () => {
    for (const o of [-3, -2, -1]) {
      const ns = data.nodes.filter((n) => n[2] === o);
      const inside = ns.filter(([x, z]) => nav(o).inside(x, z)).length;
      expect(inside / ns.length).toBeGreaterThan(0.95);
    }
  });
});

describe('level 0', () => {
  const L = LEVELS[0];
  const gates = data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
  const gx = gates.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gates.length;
  const gz = gates.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gates.length;
  const goal = nearestNode(data, gx, gz, L.goal.o);
  const R = distancesTo(data, goal, { underground: true });

  it('starts somewhere walkable', () => {
    expect(nav(L.start.o).inside(L.start.x, L.start.z)).toBe(true);
  });

  it('reaches the Keio New Line gate without surfacing, a bit over a kilometre', () => {
    const s = nearestNode(data, L.start.x, L.start.z, L.start.o);
    expect(Number.isFinite(R.dist[s])).toBe(true);
    expect(R.dist[s]).toBeGreaterThan(1000);
    expect(R.dist[s]).toBeLessThan(1200);
  });
});

describe('collision', () => {
  it('never moves a body out of the walkable area', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const o of [-2, -1]) {
      const n = nav(o);
      const ns = data.nodes.filter(([x, z, no]) => no === o && n.inside(x, z));
      for (let i = 0; i < 300; i++) {
        const [x, z] = ns[Math.floor(rnd() * ns.length)];
        const a = rnd() * Math.PI * 2, d = rnd() * 6;
        const [nx, nz] = n.move(x, z, Math.cos(a) * d, Math.sin(a) * d, 0.3);
        expect(n.inside(nx, nz)).toBe(true);
      }
    }
  });
});
