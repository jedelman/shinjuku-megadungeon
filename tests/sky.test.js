import { describe, it, expect } from 'vitest';
import * as A from 'astronomy-engine';
import { cast, tonight, midnightJD, longitudes, ascendant, obliquity, siderealTime, TOKYO, validDate, skySeed, describe as tell, randomDate, sombre, SOMBRE } from '../src/sky.js';
import { rng } from '../src/seed.js';

const RAD = Math.PI / 180;
const BODIES = { sun: A.Body.Sun, moon: A.Body.Moon, mercury: A.Body.Mercury, venus: A.Body.Venus, mars: A.Body.Mars, jupiter: A.Body.Jupiter, saturn: A.Body.Saturn };
const dates = (() => {
  const r = rng(20261110);
  return Array.from({ length: 150 }, () => {
    const y = 1900 + Math.floor(r() * 200), m = 1 + Math.floor(r() * 12), d = 1 + Math.floor(r() * 28);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });
})();

describe('the sky (checked against astronomy-engine)', () => {
  it('casts at 00:00 JST, which is 15:00 UT the day before', () => {
    const t = new Date((midnightJD('2026-11-10') - 2440587.5) * 864e5);
    expect(t.toISOString()).toBe('2026-11-09T15:00:00.000Z');
  });

  it('puts the Sun, Moon and planets within a tenth of a degree of where they were, 1900–2099', () => {
    for (const date of dates) {
      const jd = midnightJD(date);
      const t = A.MakeTime(new Date((jd - 2440587.5) * 864e5));
      const mine = longitudes(jd);
      for (const [p, b] of Object.entries(BODIES)) {
        const ref = A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(t), A.GeoVector(b, t, true))).lon;
        const diff = Math.abs(((mine[p] - ref + 540) % 360) - 180);
        expect([date, p, diff < 0.1]).toEqual([date, p, true]);
      }
    }
  });

  it('puts the Ascendant on the eastern horizon over Tokyo', () => {
    for (const date of dates) {
      const jd = midnightJD(date);
      const asc = ascendant(jd), e = obliquity(jd), th = siderealTime(jd, TOKYO.lon);
      const dec = Math.asin(Math.sin(e * RAD) * Math.sin(asc * RAD));
      const ra = Math.atan2(Math.cos(e * RAD) * Math.sin(asc * RAD), Math.cos(asc * RAD));
      const H = th * RAD - ra;
      const alt = Math.asin(Math.sin(TOKYO.lat * RAD) * Math.sin(dec) + Math.cos(TOKYO.lat * RAD) * Math.cos(dec) * Math.cos(H)) / RAD;
      expect(Math.abs(alt)).toBeLessThan(1e-6);
      expect(Math.sin(H)).toBeLessThan(0);   // east of the meridian: rising, not setting
      const st = A.SiderealTime(A.MakeTime(new Date((jd - 2440587.5) * 864e5))) * 15 + TOKYO.lon;
      expect(Math.abs(((th - st) % 360 + 540) % 360 - 180)).toBeLessThan(0.01);
    }
  });

  it('counts whole-sign houses from the rising sign', () => {
    const c = cast('1964-10-10');
    expect(c.asc.house).toBe(1);
    for (const p of Object.values(c.planets)) expect(p.house).toBe(((p.sign - c.asc.sign + 12) % 12) + 1);
  });

  it('draws one random date per real day (or the one you choose), and the chart is the seed', () => {
    const a = tonight('2026-11-10'), b = tonight('2026-11-10'), c = tonight('2026-11-11');
    expect(a).toEqual(b);
    expect(a.date).not.toBe(c.date);
    expect(a.date >= '1900-01-01' && a.date <= '2099-12-31').toBe(true);
    expect(tonight('2026-11-10', '1927-12-30').date).toBe('1927-12-30');
    expect(tonight('2026-11-10', 'not a date').date).toBe(a.date);
    expect(validDate('2026-02-30')).toBe(false);
    expect(skySeed(a, 'x')).toBe(skySeed(b, 'x'));
    expect(skySeed(a, 'x')).not.toBe(skySeed(a, 'y'));
    expect(tell(a)[0]).toMatch(/cast for Tokyo at midnight on \d+ \w+ \d{4}/);
  });

  it('never steps into the sombre nights: not drawn, not choosable', () => {
    const r = rng(7);
    for (let i = 0; i < 40000; i++) expect(sombre(randomDate(r))).toBe(false);
    for (const d of ['1995-03-20', '1923-09-01', '1945-03-10', '1945-08-15', '2011-03-11']) {
      expect(validDate(d)).toBe(false);
      expect(tonight('2026-11-10', d).date).toBe(tonight('2026-11-10').date);
    }
    expect(validDate('1995-03-22')).toBe(true);
    for (const [a, b] of SOMBRE) expect(a <= b).toBe(true);
  });
});
