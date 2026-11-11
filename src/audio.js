// Sound, all synthesised in the browser (Web Audio): no recordings, and every note is original.
// Jason (2026-11-10): "extremely chill ambient music. Soft bells and plucked strings, and train sounds - rumbles with
// doppler, dings for doors opening and closing."
//
// The music is generative: sparse plucks and soft bells on a major pentatonic, over a quiet drone, in a long station
// reverb. Tonight's chart sets the key (the Sun's sign). Inside a patch (another night) the bells take over, like a music
// box; in a fog pocket the music falls away to the drone and the wind. Trains rumble with real Doppler shift (computed
// from the train's velocity toward you), clack over the rail joints, and chime when their doors open and close. Tanuki
// patter instead, on little belly drums. The browser only allows sound after a tap or key, so it starts on the first one.

export const SCALE = [0, 2, 4, 7, 9];            // major pentatonic, in semitones
const CHORDS = [0, 5, 9, 7];                       // I, IV, vi, V: four slow bars each
const LOUD = 1.4;                                  // the master level
const DRONE = 0.016;                               // the drone under it all: felt more than heard
export const C_SPEED = 343;                        // metres per second

// the key from tonight's chart: the Sun's sign picks the root, between A2 and G#3
export const rootOf = (chart) => 110 * 2 ** ((chart?.planets?.sun?.sign ?? 0) / 12);
// Doppler: a source closing at v m/s sounds higher by c / (c - v)
export const doppler = (v) => C_SPEED / (C_SPEED - Math.max(-120, Math.min(120, v)));

function noiseBuffer(ctx, seconds, brown = false) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
function impulse(ctx, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
  }
  return b;
}

export class Sound {
  constructor(muted = false) {
    this.ctx = null;
    this.muted = muted;
    this.mood = { hush: 0, patch: false, crowd: 0, encounter: false };
    this.voices = new Map();
    this.root = 110;
    this.dings = 0;
  }

  // call from a tap or key handler
  start(chart) {
    if (chart) this.root = rootOf(chart);
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    // everything goes through a gentle limiter, so a train and a chime together never clip
    this.out = ctx.createDynamicsCompressor();
    this.out.threshold.value = -12; this.out.knee.value = 8; this.out.ratio.value = 4; this.out.attack.value = 0.01; this.out.release.value = 0.3;
    this.out.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : LOUD; this.master.connect(this.out);
    this.meter = ctx.createAnalyser(); this.meter.fftSize = 2048; this.out.connect(this.meter);   // for tests: how loud it is
    this.verb = ctx.createConvolver(); this.verb.buffer = impulse(ctx, 3.4);
    const wet = ctx.createGain(); wet.gain.value = 0.55; this.verb.connect(wet).connect(this.master);
    const bus = (g, send) => { const b = ctx.createGain(); b.gain.value = g; b.connect(this.master); const s = ctx.createGain(); s.gain.value = send; b.connect(s).connect(this.verb); return b; };
    this.music = bus(0.32, 0.8);
    this.sfx = bus(0.75, 0.35);
    this.noise = noiseBuffer(ctx, 2);
    this.brown = noiseBuffer(ctx, 3, true);
    // a quiet drone under everything: the root and its fifth, breathing slowly
    this.drone = ctx.createGain(); this.drone.gain.value = DRONE; this.drone.connect(this.music);
    this.droneOsc = [];
    for (const [m, g] of [[1, 1], [1.5, 0.45]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = this.root * m;
      this.droneOsc.push([o, m]);
      const og = ctx.createGain(); og.gain.value = g; o.connect(og).connect(this.drone); o.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + m * 0.03; const lg = ctx.createGain(); lg.gain.value = 0.35 * g;
      lfo.connect(lg).connect(og.gain); lfo.start();
    }
    // the crowd's murmur, and the wind in a fog pocket: filtered noise, scaled by the mood
    const loop = (filterType, f, q) => {
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(this.sfx); s.start();
      return g;
    };
    this.murmur = loop('bandpass', 650, 0.6);
    this.wind = loop('lowpass', 380, 0.4);
    // the generative score: look ahead and schedule notes a little early
    this.step = 0;
    this.next = ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  // how loud the mix is right now (RMS), for tests and recordings
  level() {
    if (!this.meter) return 0;
    const a = new Float32Array(this.meter.fftSize);
    this.meter.getFloatTimeDomainData(a);
    return Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
  }

  // a recording of the mix (tests/listen.mjs)
  tap() { const d = this.ctx.createMediaStreamDestination(); this.out.connect(d); return d.stream; }

  // tonight's key: the drone glides to it
  key(chart) {
    this.root = rootOf(chart);
    if (this.ctx) for (const [o, m] of this.droneOsc) o.frequency.setTargetAtTime(this.root * m, this.ctx.currentTime, 2);
  }

  // a hidden tab goes quiet; it comes back when you do
  pause(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend(); else this.ctx.resume();
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : LOUD, this.ctx.currentTime, 0.1);
    return !this.muted;
  }

  setMood(m) {
    Object.assign(this.mood, m);
    if (!this.ctx) return;
    const t = this.ctx.currentTime, h = this.mood.hush;
    if (t - (this.moodAt ?? -1) < 0.2) return;    // a few times a second is plenty
    this.moodAt = t;
    this.music.gain.setTargetAtTime(this.mood.encounter ? 0.3 : 0.32 * (1 - 0.9 * h), t, 0.8);
    this.drone.gain.setTargetAtTime(DRONE * (1 + 1.2 * h), t, 1.2);
    this.wind.gain.setTargetAtTime(0.09 * h, t, 1);
    this.murmur.gain.setTargetAtTime(0.05 * Math.min(1, this.mood.crowd / 28) * (1 - h), t, 0.6);
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const beat = 0.6;
    while (this.next < ctx.currentTime + 0.15) {
      const t = this.next, step = this.step++;
      this.next += beat;
      if (this.mood.encounter) { this.fightTune(t, step, beat); continue; }
      if (this.mood.hush > 0.6) continue;    // the fog swallows the tune
      const chord = CHORDS[Math.floor(step / 32) % CHORDS.length];
      const note = (deg, oct) => this.root * 2 ** ((chord + SCALE[deg % 5] + 12 * (oct + Math.floor(deg / 5))) / 12);
      const patch = this.mood.patch;
      const r = Math.random();
      if (r < (patch ? 0.1 : 0.3)) this.pluck(t, note(Math.floor(Math.random() * 7), 1), 0.16 + Math.random() * 0.08, Math.random() * 1.2 - 0.6);
      if (Math.random() < (patch ? 0.32 : 0.11)) this.bell(t + (Math.random() < 0.5 ? 0 : beat / 2), note(Math.floor(Math.random() * 6), 2), 0.08, Math.random() * 1.4 - 0.7);
      if (step % 16 === 0 && Math.random() < 0.5) for (let i = 0; i < 3; i++) this.pluck(t + i * 0.18, note(i * 2, 1), 0.12, -0.3 + i * 0.3);
    }
  }

  // a meeting with a yokai has its own little tune: a bouncing pentatonic bass, a bell now and then
  fightTune(t, step, beat) {
    const walk = [0, 7, 9, 7, 4, 7, 2, 7];
    for (const half of [0, 1]) {
      const n = step * 2 + half;
      this.pluck(t + half * beat / 2, this.root * 2 ** ((walk[n % 8] + (Math.floor(n / 16) % 2 ? 5 : 0)) / 12), 0.12, (half - 0.5) * 0.4);
      if (n % 8 === 4) this.bell(t + half * beat / 2, this.root * 4 * 2 ** (SCALE[(n >> 3) % 5] / 12), 0.05, 0.3);
    }
  }

  // short sounds for the yokai and the arena
  sting(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = this.root, o = this.sfx;
    if (kind === 'meet') { this.bell(t, f * 2, 0.14, -0.2, o); this.bell(t + 0.4, f * 2 * Math.SQRT2, 0.12, 0.2, o); }   // a tritone: something's off
    else if (kind === 'select') this.tick(2400, 0.05, 0);
    else if (kind === 'hit') { this.thump(140, 0.4, 0, 0.14); this.tick(700, 0.08, 0); }
    else if (kind === 'caught') [1, 1.5, 2].forEach((m, i) => this.pluck(t + i * 0.06, f * 2 * m, 0.16, 0, o));
    else if (kind === 'clean') [1, 1.25].forEach((m, i) => this.bell(t + i * 0.15, f * 4 * m, 0.08, 0, o));
    else if (kind === 'won') [1, 1.25, 1.5, 2].forEach((m, i) => this.bell(t + i * 0.16, f * 2 * m, 0.11, (i - 1.5) * 0.3, o));
    else if (kind === 'fled') [1.5, 1.25, 1, 0.75].forEach((m, i) => this.pluck(t + i * 0.07, f * 2 * m, 0.14, 0, o));
  }

  pan(p) { const n = this.ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); return n; }

  // a soft bell: inharmonic partials, each fading at its own rate
  bell(t, f, v, p = 0, out = this.music) {
    const ctx = this.ctx, pn = this.pan(p); pn.connect(out);
    for (const [m, a, d] of [[1, 1, 3.4], [2.76, 0.42, 2], [5.4, 0.2, 1.1], [8.93, 0.08, 0.6]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(pn); o.start(t); o.stop(t + d + 0.05);
    }
  }

  // a plucked string: a bright triangle that darkens as it dies away
  pluck(t, f, v, p = 0, out = this.music) {
    const ctx = this.ctx, pn = this.pan(p); pn.connect(out);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(3800, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    lp.connect(g).connect(pn);
    for (const det of [0, 4]) { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + 2); }
  }

  // a short thump: a rail joint under a wheel, or a tanuki's belly drum
  thump(f, v, p, decay = 0.12, out = this.sfx) {
    const ctx = this.ctx, t = ctx.currentTime, pn = this.pan(p); pn.connect(out);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + decay);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(pn); o.start(t); o.stop(t + decay + 0.02);
  }

  // a rail joint under the wheels: two knocks, one per bogie, each a thump and a metal tick
  clack(rate, near, pan, gap) {
    for (const [i, dt] of [[0, 0], [1, Math.min(0.25, gap)]]) {
      setTimeout(() => {
        if (!this.ctx) return;
        this.thump((i ? 62 : 74) * rate, 0.45 * near, pan, 0.08);
        this.tick(2400 * rate, 0.08 * near, pan);
      }, dt * 1000);
    }
  }

  // a short filtered click of noise
  tick(f, v, p) {
    const ctx = this.ctx, t = ctx.currentTime, pn = this.pan(p); pn.connect(this.sfx);
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(bp).connect(g).connect(pn); s.start(t, Math.random()); s.stop(t + 0.05);
  }

  // where a sound sits for the listener: distance and left-right
  place(L, x, z) {
    const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz) || 0.001;
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);           // the camera's right
    return { d, dx, dz, pan: (dx * rx + dz * rz) / d };
  }

  // door chimes, original: two notes up as the doors open, three down as they close
  ding(kind, L, x, z) {
    if (!this.ctx) return;
    const { d, pan } = this.place(L, x, z);
    const v = 0.12 / (1 + d / 10), t = this.ctx.currentTime;
    const notes = kind === 'open' ? [880, 1174.7] : [1318.5, 1046.5, 784];
    notes.forEach((f, i) => this.bell(t + i * 0.22, f, v, pan, this.sfx));
    this.dings++;
  }

  // every frame: each train's rumble (or the tanuki's drums) from where it is and how fast it's coming
  trains(L, list, dt) {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const live = new Set();
    for (const tr of list) {
      live.add(tr.id);
      let v = this.voices.get(tr.id);
      if (!v) {
        const s = ctx.createBufferSource(); s.buffer = this.brown; s.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
        const g = ctx.createGain(); g.gain.value = 0;
        const pn = this.pan(0);
        s.connect(lp).connect(g).connect(pn).connect(this.sfx); s.start();
        v = { s, lp, g, pn, clack: 0, drum: 0 };
        this.voices.set(tr.id, v);
      }
      const { d, dx, dz, pan } = this.place(L, tr.x, tr.z);
      const speed = Math.hypot(tr.vx, tr.vz);
      const closing = -(tr.vx * dx + tr.vz * dz) / d;            // m/s toward the listener
      const near = tr.visible && tr.o === L.o ? 1 / (1 + d / 9) : 0;
      const loud = tr.tanuki ? 0 : near * (0.07 + 0.93 * Math.min(1, speed / 14));   // a stopped train still hums
      v.g.gain.setTargetAtTime(1.1 * loud, now, 0.15);
      v.s.playbackRate.setTargetAtTime(doppler(closing * 2.5), now, 0.1);   // a touch exaggerated, so you hear it pass
      v.lp.frequency.setTargetAtTime(160 + 22 * speed, now, 0.2);
      v.pn.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.1);
      if (!near) continue;
      if (!tr.tanuki && speed > 2.5) {
        v.clack += dt;
        if (v.clack > 18 / speed) { v.clack = 0; this.clack(doppler(closing * 2.5), near, pan, 2.2 / speed); }
      }
      if (tr.tanuki && tr.moving) {
        // pon, poko: tanuki drumming on their bellies as they go
        v.drum += dt;
        if (v.drum > 0.24) {
          v.drum = 0; v.beat = (v.beat || 0) + 1;
          const pon = v.beat % 4 === 0;           // pon, poko poko poko
          this.thump(pon ? 120 : 190, (pon ? 0.45 : 0.3) * near, pan, pon ? 0.22 : 0.13);
          this.tick(pon ? 900 : 1300, 0.05 * near, pan);
        }
      }
    }
    for (const [id, v] of this.voices) if (!live.has(id)) v.g.gain.setTargetAtTime(0, now, 0.3);
  }
}
