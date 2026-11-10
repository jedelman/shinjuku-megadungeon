import { describe, it, expect } from 'vitest';
import { makeKitten, BODY_Y } from '../src/kitten.js';

describe('kitten animation', () => {
  const k = makeKitten();

  it('binds every clip track to a real joint', () => {
    for (const clip of Object.values(k.clips)) {
      for (const track of clip.tracks) {
        const nodeName = track.name.split('.')[0];
        expect(k.root.getObjectByName(nodeName), `${clip.name}: ${track.name}`).toBeTruthy();
      }
    }
  });

  it('has the six clips', () => {
    expect(Object.keys(k.clips).sort()).toEqual(['gallop', 'hop', 'idle', 'sit', 'trot', 'walk']);
  });

  it('animates every gait and mode without NaNs, and the legs actually move', () => {
    const leg = k.root.getObjectByName('legFL');
    const seen = new Set();
    for (const [speed, mode] of [[0, null], [0.8, null], [2.4, null], [6.5, null], [0, 'stairs'], [0, 'escalator']]) {
      for (let i = 0; i < 40; i++) {
        k.animate(1 / 60, speed, mode);
        k.root.traverse((o) => {
          for (const v of [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w, o.position.x, o.position.y, o.position.z]) {
            expect(Number.isFinite(v)).toBe(true);
          }
        });
        if (speed > 0) seen.add(leg.quaternion.x.toFixed(2));
      }
    }
    expect(seen.size).toBeGreaterThan(8);
  });

  it('sits down after a few idle seconds', () => {
    const body = k.root.getObjectByName('body');
    for (let i = 0; i < 60 * 7; i++) k.animate(1 / 60, 0, null);
    expect(body.position.y).toBeLessThan(BODY_Y - 0.01); // sitting lowers the body
  });
});
