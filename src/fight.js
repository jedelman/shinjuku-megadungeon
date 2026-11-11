// Cute combat: Dodge, Pounce, Sass.
// Jason (2026-11-10): "some kind of yokai. We should also add some kind of cute combat a la Undertale - dodge, pounce,
// and sass are your main actions."
//
// The shape is borrowed (turns; between them you dodge in a small arena; nobody has to get hurt), nothing else: no
// names, art or interface from that game. The kitten's marker is a paw. There's no death: hits cost nerve, and with no
// nerve left she bolts, and can come back. Three ways to win, one per action:
// - Sass: say the right cheeky thing three times and the yokai laughs: befriended.
// - Pounce: catch the tassel (or tongue, or sleeve) three times: bowled over, giggling.
// - Dodge: two clean turns, not a hair touched: it tires itself out and lets you by.
//
// Everything here is pure: a fight is a function of its yokai, its seed and what you do, so tests can play it.
import { rng, hash } from './seed.js';

export const W = 1, H = 0.56;            // the arena, in arena units (its canvas keeps this aspect)
export const PAW = 0.022;                // the paw's radius
export const NERVE = 5;
export const TURN = 6;                   // seconds of dodging per turn
export const SPEED = 0.45;               // the paw, arena units per second (more on a Dodge turn)
export const NEED = { amused: 3, tumbled: 3, tired: 2 };
const SAFE = 1.1;                        // seconds you can't be hit again after a hit

// ---------------------------------------------------------------------------------------------- the yokai
// Lines are the game's own. Folklore facts, with sources, are in yokai.js.
export const KINDS = {
  kasa: {
    ja: '唐傘お化け', en: 'a kasa-obake',
    intro: ['An umbrella hops out of the fog on one leg.', 'It has one eye, and it is looking at you.'],
    sass: {
      good: ['Nice canopy. Very waterproof.', 'One leg, and you still hop better than me.', 'You must have seen a lot of rainy seasons.', 'Paper and bamboo. They don\'t make them like you any more.'],
      bad: ['Somebody left you on the train, huh?', 'An umbrella, open indoors? That\'s bad luck.', 'Can I borrow you? I\'ll bring you back. Probably.', 'Aren\'t you a bit old to be lost?'],
    },
    liked: ['The umbrella does a proud little spin.', 'It sticks its tongue out, delighted.', 'It hops, pleased with itself.'],
    huff: ['The umbrella snaps half shut, offended. It rains harder.', 'It glares with its one eye. Drip, drip, drip.'],
    caught: 'You catch its tassel! It wobbles on its one leg.', missed: 'The tassel swings out of reach.',
    clean: 'Not one drop on you. The umbrella is getting tired.', wet: 'You dodged, mostly. Your ears are damp.',
    won: {
      befriended: ['The umbrella laughs so hard it opens all the way.', 'It hops off into the fog, lighter. It only wanted someone to need it.'],
      bowled: ['Pounced! The umbrella topples, giggling, its leg kicking.', 'It rights itself and hops away, still laughing.'],
      tired: ['It hops, and hops, and sits down, puffed out.', 'It lets you by. Its eye follows you, a little impressed.'],
    },
    patterns: ['drizzle', 'hop', 'spin'], bullet: '#9cc8ec', target: 'tassel',
  },
  chochin: {
    ja: '提灯お化け', en: 'a chōchin-obake',
    intro: ['A paper lantern hangs in the fog where no lantern should be.', 'It splits open into a grin.'],
    sass: {
      good: ['You light up the whole corridor.', 'That tongue is magnificent.', 'Glowing in the fog like that? Very dramatic. Love it.', 'You\'re the warmest thing down here.'],
      bad: ['Is that an LED in you?', 'The station has fluorescent lights now, you know.', 'Could you dim it a bit?', 'Bit papery, aren\'t you?'],
    },
    liked: ['The lantern glows brighter, flattered.', 'Its tongue unrolls all the way, pleased.', 'It sways happily on nothing at all.'],
    huff: ['The lantern flares. Sparks everywhere.', 'It sputters, cross. The embers come thicker.'],
    caught: 'You bat its tongue! The lantern swings round and round.', missed: 'The tongue flicks away, rude.',
    clean: 'Not a whisker singed. The lantern flickers, tired.', wet: 'You dodged, mostly. You smell faintly of smoke.',
    won: {
      befriended: ['The lantern laughs, and the fog goes gold for a moment.', 'It bobs away down the corridor, lighting someone else\'s way.'],
      bowled: ['Pounced! The lantern spins on its string, giggling.', 'It goes dim with laughing, and drifts off.'],
      tired: ['The lantern gutters and droops, worn out.', 'It glows a small, sleepy glow and lets you pass.'],
    },
    patterns: ['sparks', 'tongue', 'rings'], bullet: '#f0a050', target: 'tongue',
  },
  noppera: {
    ja: 'のっぺらぼう', en: 'a noppera-bō',
    intro: ['Someone stands in the fog with their back to you.', 'They turn round. They have no face.'],
    sass: {
      good: ['I like your face. Very restful.', 'Smooth as a boiled egg.', 'No face, no need for a mask. Efficient.', 'Are you, by any chance, a mujina?'],
      bad: ['Have you tried smiling?', 'You\'ve got something on your face. Oh, wait.', 'I\'ve seen scarier faces on the Yamanote line.', 'Boo yourself.'],
    },
    liked: ['It touches its smooth face, bashful.', 'It nods. Somehow you can tell it\'s pleased.', 'It wiggles. Under there, something is grinning.'],
    huff: ['It goes very still. The fog gets colder.', 'It wipes its blank face, slowly, at you.'],
    caught: 'You catch its sleeve! It flails, surprised.', missed: 'The sleeve slips away like smoke.',
    clean: 'It reached for you every time and missed. It\'s winded.', wet: 'You dodged, mostly. You shiver.',
    won: {
      befriended: ['It laughs, and wipes its face with its sleeve.', 'Under the smooth face is a mujina\'s grin: an animal in disguise all along. It scampers off.'],
      bowled: ['Pounced! It falls over, and a mujina tumbles out of the coat.', 'It shakes itself and trots away, giggling.'],
      tired: ['It sits down on the floor, faceless and puffed.', 'It waves you past with a tired sleeve.'],
    },
    patterns: ['eggs', 'wipe', 'faces'], bullet: '#f2efe6', target: 'sleeve',
  },
};
export const KIND_IDS = Object.keys(KINDS);

// ---------------------------------------------------------------------------------------------- patterns
// Each pattern is a pure function of time: (t, seed, k) → [{x, y, r, warn?}]. k scales the density (a liked sass makes
// the next turn gentler, a bad one harsher). `warn` marks a telegraph that can't hurt you.
const schedule = (seed, every, k, f) => {
  const r = rng(seed), out = [];
  for (let ti = 0.15, i = 0; ti < TURN; ti += every / k, i++) out.push(f(ti, i, r));
  return out;
};
const lanes = [0.08, 0.18, 0.28, 0.38, 0.48];

export const PATTERNS = {
  // raindrops, but never in the dry spot under the umbrella, which drifts slowly
  drizzle(t, seed, k) {
    const ph = (seed % 628) / 100;
    const dry = (tt) => 0.5 + 0.28 * Math.sin(tt * 0.55 + ph);
    return schedule(seed, 0.09, k, (ti, i, r) => ({ ti, x: r() })).filter((d) => Math.abs(d.x - dry(d.ti + 0.9)) > 0.13)
      .map((d) => ({ x: d.x, y: (t - d.ti) * 0.42 - 0.02, r: 0.012 })).filter((b) => b.y > -0.03 && b.y < H + 0.03);
  },
  // the umbrella itself, bounding across the floor; a few drops
  hop(t, seed, k) {
    const out = [];
    for (let j = 0; j < 3; j++) {
      const t0 = j * 2.2, dir = (j + seed) % 2 ? 1 : -1, u = (t - t0) * 0.3;
      if (u < 0 || u > 1.2) continue;
      const x = dir > 0 ? -0.1 + u : 1.1 - u;
      out.push({ x, y: H - 0.06 - 0.3 * Math.abs(Math.sin(u * Math.PI * 2.5)), r: 0.06 });
    }
    return out.concat(PATTERNS.drizzle(t, seed + 1, 0.3 * k));
  },
  // it spins, flinging drops out in rotating arms
  spin(t, seed, k) {
    const out = [], every = 0.3 / k;
    for (let ti = 0.1; ti < t; ti += every) {
      for (let arm = 0; arm < 3; arm++) {
        const a = ti * 1.3 + arm * (2 * Math.PI / 3) + seed;
        const dy = Math.sin(a);
        if (dy < 0.25) continue;                       // only the downward-facing arms throw
        const d = (t - ti) * 0.3;
        if (d > 0.75) continue;
        out.push({ x: 0.5 + Math.cos(a) * d, y: -0.02 + dy * d, r: 0.014 });
      }
    }
    return out;
  },
  // embers rising, drifting, never in the cool column
  sparks(t, seed, k) {
    const ph = (seed % 628) / 100;
    const cool = (tt) => 0.5 + 0.27 * Math.sin(tt * 0.5 + ph);
    return schedule(seed, 0.1, k, (ti, i, r) => ({ ti, i, x: r() })).filter((d) => Math.abs(d.x - cool(d.ti + 0.9)) > 0.14)
      .map((d) => ({ x: d.x + 0.03 * Math.sin((t - d.ti) * 3 + d.i), y: H + 0.02 - (t - d.ti) * 0.38, r: 0.013 }))
      .filter((b) => b.y > -0.03 && b.y < H + 0.03);
  },
  // its tongue lashes across one lane at a time, after a flicker of warning
  tongue(t, seed, k) {
    const out = [];
    const every = 1.5 / k;
    for (let n = 0, t0 = 0.2; t0 < TURN; n++, t0 += every) {
      const u = t - t0;
      if (u < 0 || u > 1.6) continue;
      const lane = lanes[hash(`${seed}|${n}`) % lanes.length], left = (seed + n) % 2 === 0;
      const reach = u < 0.7 ? 0 : u < 1.05 ? (u - 0.7) / 0.35 : u < 1.3 ? 1 : Math.max(0, 1 - (u - 1.3) / 0.3);
      for (let x = 0; x <= 1.0001; x += 0.05) {
        const px = left ? x : 1 - x;
        if (u < 0.7) { if (Math.floor(u * 10) % 2 === 0) out.push({ x: px, y: lane, r: 0.03, warn: true }); continue; }
        if (x <= reach) out.push({ x: px, y: lane, r: 0.03 });
      }
    }
    return out.concat(PATTERNS.sparks(t, seed + 3, 0.15 * k));
  },
  // rings of embers swelling out from the lantern, each with a gap
  rings(t, seed, k) {
    const out = [], every = 1.4 / k, n = 26;
    for (let m = 0, t0 = 0.1; t0 < t; m++, t0 += every) {
      const R = (t - t0) * 0.24;
      if (R > 0.9) continue;
      const h = hash(`${seed}|ring|${m}`);
      const gap = Math.PI * (0.1 + 0.8 * ((h % 1000) / 1000));       // the gap faces somewhere down into the arena
      const turn = ((h >>> 10) % 1000) / 1000 * (Math.PI * 2 / n);    // each ring sits a little rotated
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + turn;
        const da = Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (da < 0.55) continue;                       // the gap
        out.push({ x: 0.5 + Math.cos(a) * R, y: -0.04 + Math.sin(a) * R, r: 0.015 });
      }
    }
    return out.filter((b) => b.y > -0.05 && b.y < H + 0.05 && b.x > -0.05 && b.x < W + 0.05);
  },
  // smooth eggs rolling in along the rows
  eggs(t, seed, k) {
    return schedule(seed, 0.55, k, (ti, i, r) => ({ ti, lane: lanes[Math.floor(r() * lanes.length)], left: r() < 0.5 }))
      .map((e) => { const u = (t - e.ti) * 0.32; return { x: e.left ? -0.04 + u : 1.04 - u, y: e.lane, r: 0.03 }; })
      .filter((b) => b.x > -0.05 && b.x < W + 0.05);
  },
  // a sleeve wipes across the arena with one gap in it
  wipe(t, seed, k) {
    const out = [], every = 2.4 / k;
    for (let m = 0, t0 = 0.1; t0 < TURN; m++, t0 += every) {
      const x = -0.05 + (t - t0) * 0.42;
      if (x < -0.05 || x > W + 0.05) continue;
      const gap = 0.1 + ((hash(`${seed}|wipe|${m}`) % 1000) / 1000) * (H - 0.2);
      for (let y = 0.02; y < H; y += 0.045) if (Math.abs(y - gap) > 0.085) out.push({ x, y, r: 0.02 });
    }
    return out;
  },
  // blank faces surface, look at you, and pop
  faces(t, seed, k) {
    return schedule(seed, 0.3, k, (ti, i, r) => ({ ti, x: 0.08 + r() * 0.84, y: 0.08 + r() * (H - 0.16) }))
      .filter((f) => t >= f.ti && t < f.ti + 1.15)
      .map((f) => ({ x: f.x, y: f.y, r: 0.05, warn: t < f.ti + 0.7 }));
  },
};

// the tassel (or tongue, or sleeve) you pounce at: it wanders the arena
export function target(t, seed) {
  const a = (seed % 100) / 16, b = (seed % 37) / 6;
  return { x: 0.5 + 0.36 * Math.sin(t * 0.7 + a), y: 0.28 + 0.2 * Math.sin(t * 1.1 + b), r: 0.032 };
}

// ---------------------------------------------------------------------------------------------- a fight
// Phases: intro → menu → (sass → react) → turn → react → menu … → won | fled.
export class Fight {
  constructor(kind, seed) {
    this.kind = kind; this.K = KINDS[kind]; this.seed = seed >>> 0;
    this.r = rng(this.seed);
    this.nerve = NERVE;
    this.meters = { amused: 0, tumbled: 0, tired: 0 };
    this.turnN = 0;
    this.paw = { x: 0.5, y: H * 0.72 };
    this.phase = 'intro'; this.t = 0;
    this.text = this.K.intro;
    this.outcome = null;
    this.usedGood = new Set();
    this.events = [];          // what happened this step, for sound and screen: 'hit', 'caught', 'clean', 'won', 'fled'
  }

  // what you can do now
  get actions() { return this.phase === 'menu' ? ['dodge', 'pounce', 'sass'] : this.phase === 'sass' ? this.lines.map((l) => l.text) : []; }

  choose(action) {
    if (this.phase !== 'menu') return;
    this.action = action;
    if (action === 'sass') {
      // one line it'll like, two it won't, in a seeded order
      const goods = this.K.sass.good.filter((g) => !this.usedGood.has(g));
      const good = (goods.length ? goods : this.K.sass.good)[Math.floor(this.r() * (goods.length || this.K.sass.good.length))];
      const bads = [...this.K.sass.bad].sort(() => this.r() - 0.5).slice(0, 2);
      this.lines = [{ text: good, good: true }, ...bads.map((b) => ({ text: b, good: false }))].sort(() => this.r() - 0.5);
      this.phase = 'sass'; this.text = ['What do you say?'];
      return;
    }
    this.k = 1;
    this.text = action === 'pounce' ? ['You crouch. Your back end wiggles.'] : ['You get light on your paws.'];
    this.startTurn();
  }

  sass(i) {
    if (this.phase !== 'sass') return;
    const line = this.lines[i];
    if (!line) return;
    this.said = line;
    if (line.good) { this.usedGood.add(line.text); this.meters.amused++; this.k = 0.7; } else this.k = 1.3;
    const pool = line.good ? this.K.liked : this.K.huff;
    this.text = [`“${line.text}”`, pool[Math.floor(this.r() * pool.length)]];
    if (this.meters.amused >= NEED.amused) return this.win('befriended');
    this.phase = 'react'; this.t = 0; this.then = 'turn';
  }

  startTurn() {
    this.phase = 'turn'; this.t = 0; this.hits = 0; this.caught = false;
    this.pattern = this.K.patterns[(this.turnN + this.seed) % this.K.patterns.length];
    this.pseed = hash(`${this.seed}|${this.turnN}`);
    this.safe = 0;
  }

  // the arena now: bullets, and the target on a pounce turn
  bullets() { return this.phase === 'turn' ? PATTERNS[this.pattern](this.t, this.pseed, this.k * (this.action === 'pounce' ? 0.8 : 1)) : []; }
  target() { return this.phase === 'turn' && this.action === 'pounce' && !this.caught ? target(this.t, this.pseed) : null; }

  // the act button: move past a line of text
  skip() {
    if (this.phase === 'intro' || (this.phase === 'react' && this.t > 0.25)) this.advance();
  }

  advance() {
    if (this.phase === 'intro') { this.phase = 'menu'; this.text = ['What will you do?']; this.t = 0; return; }
    if (this.phase === 'react') {
      if (this.then === 'turn') { this.startTurn(); return; }
      this.phase = 'menu'; this.text = ['What will you do?']; this.t = 0;
    }
  }

  win(how) {
    this.outcome = how; this.phase = 'won'; this.t = 0;
    this.text = this.K.won[how];
    this.events.push('won');
  }

  // move: [-1..1, -1..1] (x right, y up, as the input gives it)
  step(dt, move = [0, 0]) {
    this.events = [];
    this.t += dt;
    if (this.phase === 'intro' && this.t > 3.2) this.advance();
    if (this.phase === 'react' && this.t > 2.2) this.advance();
    if (this.phase !== 'turn') return this.events;
    const sp = SPEED * (this.action === 'dodge' ? 1.4 : 1);
    this.paw.x = Math.max(PAW, Math.min(W - PAW, this.paw.x + move[0] * sp * dt));
    this.paw.y = Math.max(PAW, Math.min(H - PAW, this.paw.y - move[1] * sp * dt));
    this.safe = Math.max(0, this.safe - dt);
    if (this.safe === 0) {
      for (const b of this.bullets()) {
        if (b.warn) continue;
        if (Math.hypot(b.x - this.paw.x, b.y - this.paw.y) < b.r + PAW * 0.8) {
          this.hits++; this.nerve--; this.safe = SAFE; this.events.push('hit');
          if (this.nerve <= 0) {
            this.outcome = 'fled'; this.phase = 'fled'; this.t = 0;
            this.text = ['Too spooky. You bolt!'];
            this.events.push('fled');
            return this.events;
          }
          break;
        }
      }
    }
    const tg = this.target();
    if (tg && Math.hypot(tg.x - this.paw.x, tg.y - this.paw.y) < tg.r + PAW) {
      this.caught = true; this.meters.tumbled++; this.events.push('caught');
    }
    if (this.t >= TURN) this.endTurn();
    return this.events;
  }

  endTurn() {
    this.turnN++;
    const K = this.K;
    let line;
    if (this.action === 'pounce') line = this.caught ? K.caught : K.missed;
    else if (this.action === 'dodge') {
      if (this.hits === 0) { this.meters.tired++; this.events.push('clean'); line = K.clean; } else line = K.wet;
    } else line = this.hits === 0 ? 'Not a scratch.' : `Ouch. Nerve: ${this.nerve} of ${NERVE}.`;
    if (this.meters.tumbled >= NEED.tumbled) return this.win('bowled');
    if (this.meters.tired >= NEED.tired) return this.win('tired');
    this.text = [line];
    this.phase = 'react'; this.t = 0; this.then = 'menu';
  }
}
