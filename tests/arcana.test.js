import { describe, it, expect } from 'vitest';
import { MAJOR, draw, layout, roman } from '../src/arcana.js';
import { cast, tonight, SIGNS, PLANETS } from '../src/sky.js';

const card = (n) => ({ n, name: MAJOR[n].name, why: '', up: true });
const edge = (L, a, b) => L.edges.find((e) => e.a === Math.min(a, b) && e.b === Math.max(a, b));

describe('the major arcana', () => {
  it('has all 22, each belonging to one sign, planet or element, every sign and classical planet once', () => {
    expect(MAJOR.map((c) => c.n)).toEqual([...Array(22).keys()]);
    for (let s = 0; s < 12; s++) expect(MAJOR.filter((c) => c.of.sign === s)).toHaveLength(1);
    for (const p of PLANETS) expect(MAJOR.filter((c) => c.of.planet === p)).toHaveLength(1);
    for (const e of ['fire', 'earth', 'air', 'water']) expect(MAJOR.filter((c) => c.of.element === e)).toHaveLength(1);
    expect(SIGNS).toHaveLength(12);
    expect([0, 4, 9, 14, 19, 21].map(roman)).toEqual(['0', 'IV', 'IX', 'XIV', 'XIX', 'XXI']);
  });

  it('draws different cards from the chart, starting with the rising sign, Sun and Moon', () => {
    for (const date of ['1927-12-30', '1964-10-10', '2026-11-10', '2074-11-02']) {
      const c = cast(date);
      const cards = draw(c, 5);
      expect(cards).toHaveLength(5);
      expect(new Set(cards.map((x) => x.n)).size).toBe(5);
      expect(MAJOR[cards[0].n].of.sign).toBe(c.asc.sign);
      expect(cards[0].why).toMatch(/rising/);
      expect(cards[0].up).toBe(true);
    }
  });

  it('connects cards the way the book does', () => {
    // the book's examples: IV–V and V–VI are sequential; XII connects to II, III, IV and VI
    const L = layout([2, 3, 4, 5, 6, 12].map(card));
    expect(edge(L, 4, 5).how).toContain('sequential');
    expect(edge(L, 5, 6).how).toContain('sequential');
    for (const k of [2, 3, 4, 6]) expect(edge(L, 12, k).how).toContain('divisible');
    expect(edge(L, 5, 12)).toBeUndefined();
  });

  it('lays out the table: lowest is the entrance, highest the deepest, I–V beside the entrance and open to the surface', () => {
    const L = layout([15, 3, 13, 21, 5].map(card));
    expect(L.entrance).toBe(3);
    expect(L.deepest).toBe(21);
    expect(L.side).toEqual([5]);
    expect(L.column).toEqual([3, 13, 15, 21]);
    expect(L.surface).toEqual([3, 5]);
    expect(edge(L, 3, 5).how).toContain('adjacent');
    expect(edge(L, 13, 15).how).toContain('adjacent');
    expect(edge(L, 3, 15).how).toEqual(['divisible']);   // not neighbours on the table: a portal
    expect(edge(L, 3, 21).how).toEqual(['divisible']);
  });

  it('gives tonight a spread', () => {
    const cards = draw(tonight('2026-11-10'), 4);
    expect(cards).toHaveLength(4);
    expect(layout(cards).edges.length).toBeGreaterThanOrEqual(3);
  });
});
