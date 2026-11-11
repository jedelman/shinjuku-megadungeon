import { describe, it, expect } from 'vitest';
import { Fight, KINDS, KIND_IDS, PATTERNS, W, H, PAW, TURN, SPEED, NERVE, NEED } from '../src/fight.js';

// a careful player: looks a moment ahead and steps where nothing will be (telegraphs count as danger)
function bot(f, dt, chase = false) {
  const look = 0.14, sp = SPEED * (f.action === 'dodge' ? 1.4 : 1);
  const future = [...f.K && PATTERNS[f.pattern](f.t + look, f.pseed, f.k * (f.action === 'pounce' ? 0.8 : 1)), ...f.bullets()];
  const tg = f.target();
  let best = [0, 0], bs = -Infinity;
  for (let i = -1; i < 16; i++) {
    const m = i < 0 ? [0, 0] : [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)];
    const x = Math.max(PAW, Math.min(W - PAW, f.paw.x + m[0] * sp * look)), y = Math.max(PAW, Math.min(H - PAW, f.paw.y - m[1] * sp * look));
    let clear = 1;
    for (const b of future) clear = Math.min(clear, Math.hypot(b.x - x, b.y - y) - b.r - PAW);
    let s = Math.min(clear, 0.12) - 0.02 * Math.hypot(x - 0.5, y - H / 2);
    if (chase && tg && clear > 0.05) s -= 0.5 * Math.hypot(tg.x - x, tg.y - y);
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
const playTurn = (f, mover) => { const dt = 1 / 30; while (f.phase === 'turn') f.step(dt, mover(f, dt)); };

describe('the arena', () => {
  for (const kind of KIND_IDS) for (const p of KINDS[kind].patterns) {
    it(`${kind}: ${p} can be dodged by a careful paw, and can't be ignored`, () => {
      let botHits = 0, stillHits = 0, n = 0;
      for (let seed = 1; seed <= 24; seed++) {
        for (const [mover, add] of [[(f, dt) => bot(f, dt), (h) => { botHits += h; }], [() => [0, 0], (h) => { stillHits += h; }]]) {
          const f = new Fight(kind, seed);
          f.nerve = 99;
          f.phase = 'menu'; f.choose('dodge');
          f.pattern = p;
          playTurn(f, mover);
          add(f.hits);
        }
        n++;
      }
      expect(botHits / n, `${p}: careful hits per turn`).toBeLessThanOrEqual(0.5);
      expect(stillHits / n, `${p}: standing still`).toBeGreaterThan(0.5);
    });
  }
  it('keeps every bullet a sane size and near the arena', () => {
    for (const p of Object.keys(PATTERNS)) for (let t = 0; t < TURN; t += 0.5) for (const b of PATTERNS[p](t, 7, 1)) {
      expect(b.r).toBeGreaterThan(0.005); expect(b.r).toBeLessThan(0.08);
      expect(b.x).toBeGreaterThan(-0.2); expect(b.x).toBeLessThan(W + 0.2);
      expect(b.y).toBeGreaterThan(-0.2); expect(b.y).toBeLessThan(H + 0.2);
    }
  });
});

describe('a fight', () => {
  const start = (kind, seed = 3) => { const f = new Fight(kind, seed); f.skip(); expect(f.phase).toBe('menu'); return f; };
  for (const kind of KIND_IDS) {
    it(`${kind}: the right sass, three times, befriends it`, () => {
      const f = start(kind);
      for (let n = 0; n < 12 && f.phase !== 'won'; n++) {
        f.choose('sass');
        expect(f.lines).toHaveLength(3);
        expect(f.lines.filter((l) => l.good)).toHaveLength(1);
        f.sass(f.lines.findIndex((l) => l.good));
        if (f.phase === 'won') break;
        while (f.phase === 'react') f.step(0.5);
        playTurn(f, bot);
        while (f.phase === 'react') f.step(0.5);
      }
      expect(f.outcome).toBe('befriended');
      expect(f.meters.amused).toBe(NEED.amused);
    });
    it(`${kind}: pounce at the ${KINDS[kind].target} and it's bowled over`, () => {
      const f = start(kind);
      for (let n = 0; n < 10 && f.phase === 'menu'; n++) {
        f.choose('pounce');
        playTurn(f, (g, dt) => bot(g, dt, true));
        while (f.phase === 'react') f.step(0.5);
      }
      expect(f.outcome).toBe('bowled');
    });
    it(`${kind}: dodge cleanly and it tires itself out`, () => {
      const f = start(kind);
      for (let n = 0; n < 10 && f.phase === 'menu'; n++) {
        f.choose('dodge');
        playTurn(f, bot);
        while (f.phase === 'react') f.step(0.5);
      }
      expect(f.outcome).toBe('tired');
    });
    it(`${kind}: stand there long enough and the kitten bolts (and nobody gets hurt)`, () => {
      const f = start(kind);
      for (let n = 0; n < 30 && f.phase === 'menu'; n++) {
        f.choose(n % 2 ? 'pounce' : 'dodge');
        playTurn(f, () => [0, 0]);
        while (f.phase === 'react') f.step(0.5);
      }
      expect(f.outcome).toBe('fled');
      expect(f.nerve).toBe(0);
    });
  }
  it('is the same fight for the same seed', () => {
    const a = new Fight('kasa', 42), b = new Fight('kasa', 42);
    a.skip(); b.skip(); a.choose('sass'); b.choose('sass');
    expect(a.lines).toEqual(b.lines);
    expect(NERVE).toBe(5);
  });
});
