import { describe, it, expect } from 'vitest';
import { doppler, rootOf, SCALE, C_SPEED } from '../src/audio.js';
import { cast } from '../src/sky.js';

describe('the sound', () => {
  it('shifts a train up as it comes and down as it goes, by c / (c - v)', () => {
    expect(doppler(0)).toBe(1);
    expect(doppler(20)).toBeCloseTo(C_SPEED / (C_SPEED - 20), 10);
    expect(doppler(20)).toBeGreaterThan(1);
    expect(doppler(-20)).toBeLessThan(1);
    expect(Number.isFinite(doppler(1e6))).toBe(true);   // clamped, never through the sound barrier
  });
  it("plays in tonight's key: the Sun's sign picks the root, within an octave", () => {
    const roots = new Set();
    for (const d of ['1988-08-08', '1964-10-10', '2001-01-01', '2033-05-05']) {
      const f = rootOf(cast(d));
      expect(f).toBeGreaterThanOrEqual(110);
      expect(f).toBeLessThan(220);
      roots.add(f.toFixed(3));
    }
    expect(roots.size).toBeGreaterThan(1);
    expect(SCALE).toEqual([0, 2, 4, 7, 9]);   // pentatonic: no note can clash
  });
});
