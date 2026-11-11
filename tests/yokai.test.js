import { describe, it, expect } from 'vitest';
import { YOKAI, haunt } from '../src/yokai.js';
import { KINDS, KIND_IDS } from '../src/fight.js';
import { Store } from '../src/people.js';
import { cast } from '../src/sky.js';

describe('yokai field notes', () => {
  it('cover every kind you can meet, and every fact has a source', () => {
    expect(Object.keys(YOKAI).sort()).toEqual([...KIND_IDS].sort());
    for (const [id, y] of Object.entries(YOKAI)) {
      expect(y.ja && y.en, id).toBeTruthy();
      expect(y.ja).toBe(KINDS[id].ja);
      expect(y.facts.length, id).toBeGreaterThanOrEqual(3);
      expect(y.sources.length, id).toBeGreaterThanOrEqual(2);
      for (const u of y.sources) expect(u).toMatch(/^https:\/\//);
    }
  });
  it('lend only the shape of that other game: none of its words in the fight', () => {
    const all = JSON.stringify(KINDS).toLowerCase();   // (the folklore's "souls" in the field notes are the tsukumogami's own)
    for (const w of ['determination', 'mercy', 'soul', 'undertale', 'fight', ' act ']) expect(all.includes(w), w).toBe(false);
  });
});

describe('who waits in the fog', () => {
  const pockets = [{ id: 0 }, { id: 1 }, { id: 2 }];
  it('is the same for the same night, each kind once before any repeats', () => {
    const a = haunt(pockets, cast('1988-08-08'), 'level-0'), b = haunt(pockets, cast('1988-08-08'), 'level-0');
    expect(a.map((x) => x.kind)).toEqual(b.map((x) => x.kind));
    expect(new Set(a.map((x) => x.kind)).size).toBe(3);
    const nights = new Set(['1964-10-10', '2001-01-01', '2033-05-05', '1979-08-18', '2066-03-19'].map((d) => haunt(pockets, cast(d), 'level-0')[0].kind));
    expect(nights.size).toBeGreaterThan(1);
  });
  it('remembers how you met each one, and which fog you cleared tonight', () => {
    const m = new Map(), s = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    const a = new Store(s);
    expect(a.yokai('kasa', 'befriended', 'night|level|fog|0')).toBe(1);
    expect(a.yokai('kasa', 'bowled', 'night|level|fog|1')).toBe(1);
    expect(a.yokai('noppera', 'tired')).toBe(2);
    const b = new Store(s);
    expect(b.data.yokai.kasa).toEqual({ befriended: 1, bowled: 1 });
    expect(b.found('night|level|fog|1')).toBe(true);
  });
});
