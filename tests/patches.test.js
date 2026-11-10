import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { checkPatch, sew, PATCHES, PATCH_FILES, around } from '../src/patches.js';
import { plan } from '../src/people.js';
import { FloorNav, floorKey, distancesTo, nearestNode } from '../src/nav.js';
import { LEVELS } from '../src/levels.js';

const load = (s) => JSON.parse(fs.readFileSync(new URL(`../public/data/${s}.json`, import.meta.url)));

describe('patches (4–5 room elemental building blocks)', () => {
  it('every patch file follows the recipe', () => {
    expect(PATCH_FILES.length).toBeGreaterThanOrEqual(4);
    for (const { file, patch } of PATCH_FILES) expect([file, checkPatch(patch)]).toEqual([file, []]);
    expect(PATCHES).toHaveLength(PATCH_FILES.length);
  });

  it('turns away patches that break it', () => {
    const good = PATCHES[0];
    const without = (role) => ({ ...good, rooms: good.rooms.filter((r) => r.role !== role) });
    expect(checkPatch(without('blank')).join()).toMatch(/blank/);
    expect(checkPatch(without('gate')).join()).toMatch(/gate/);
    expect(checkPatch({ ...good, rooms: [...good.rooms, { role: 'room', say: ['x'] }, { role: 'room', say: ['y'] }] }).join()).toMatch(/4 or 5/);
    expect(checkPatch({ ...good, name: '' }).join()).toMatch(/name/);
    expect(checkPatch({ ...good, kernel: 'fight' }).join()).toMatch(/kernel/);
    expect(checkPatch({ ...good, rooms: good.rooms.map((r) => (r.role === 'blank' ? { role: 'blank', say: ['not blank'] } : r)) }).join()).toMatch(/blank stays blank/);
    expect(checkPatch({ ...good, rooms: good.rooms.map((r) => (r.role === 'room' ? { ...r, say: ['x'.repeat(161)] } : r)) }).join()).toMatch(/160/);
    expect(checkPatch(null)).not.toEqual([]);
    expect(checkPatch([])).not.toEqual([]);
  });
});

for (const L of LEVELS) {
  describe(`the quilt in ${L.id}`, () => {
    const data = load(L.station);
    const gs = L.goal.at ? [] : data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
    const gx = L.goal.at ? L.goal.at.x : gs.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gs.length;
    const gz = L.goal.at ? L.goal.at.z : gs.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gs.length;
    const route = distancesTo(data, nearestNode(data, gx, gz, L.goal.o), { underground: true });
    const { counter } = plan(data, L, route, '2026-11-10');
    const q = sew(data, L, route, '2026-11-10', PATCHES, { counter });

    it('sews at least three patches, the same way for the same day', () => {
      expect(q.length).toBeGreaterThanOrEqual(3);
      expect(sew(data, L, route, '2026-11-10', PATCHES, { counter })).toEqual(q);
      const sig = (x) => x.map((p) => p.rooms.map((r) => r.key).join()).join('|');
      const others = ['2026-11-11', '2026-11-12', '2026-11-13'].map((d) => sig(sew(data, L, route, d, PATCHES, { counter })));
      expect(others.some((s) => s !== sig(q))).toBe(true);
    });

    it('puts every room on a real place, underground, walkable and reachable without surfacing', () => {
      for (const p of q) for (const rm of p.rooms) {
        expect(rm.o).toBeLessThan(0);
        expect(new FloorNav(data.floors[floorKey(rm.o)]).inside(rm.x, rm.z)).toBe(true);
        expect(Number.isFinite(route.dist[rm.node])).toBe(true);
        expect(rm.name).toBeTruthy();
      }
    });

    it('keeps each patch together: rooms a short walk from the heart, on its floor, apart from each other', () => {
      for (const p of q) {
        const near = around(data, p.heart.node, 200);
        for (const rm of p.rooms) {
          expect(rm.o).toBe(p.heart.o);
          expect(near.get(rm.node)).toBeLessThanOrEqual(rm.role === 'gate' ? 75 * 1.4 : 75);
          for (const o of p.rooms) if (o !== rm) expect(Math.hypot(o.x - rm.x, o.z - rm.z)).toBeGreaterThanOrEqual(8);
        }
      }
      const keys = q.flatMap((p) => p.rooms.map((r) => r.key));
      expect(new Set(keys).size).toBe(keys.length);   // no place in two patches
    });

    it("gives every patch a gate to another underground floor, and stitches every blank", () => {
      for (const p of q) {
        for (const g of p.rooms.filter((r) => r.role === 'gate')) {
          expect(g.to).toBeLessThan(0);
          expect(g.to).not.toBe(g.o);
          expect(data.conns.some((c) => (c.a === g.node || c.b === g.node))).toBe(true);
        }
        const b = p.rooms.find((r) => r.role === 'blank');
        expect(b.stitch).toBeTruthy();
        expect(b.stitch.m).toBeGreaterThan(0);
      }
    });
  });
}
