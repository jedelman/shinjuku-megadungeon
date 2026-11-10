// The player: a kitten, 30 cm to the ear tips, with a backpack and a magic wand.
// Proportions after mofusand's cats (Jason, 2026-11-10, with a reference picture): a big round head wider than the
// body, big dark eyes set wide and low, a short chubby body on stubby legs. Only the proportions: the coat, the pack
// and the wand are hers.
//
// Built the way PS1 characters were (MegaMan Legends included): rigid segments on a joint hierarchy,
// no skin. Animation is three.js's own AnimationMixer playing keyframed clips authored here in code:
// idle, sit, walk (4-beat), trot (diagonal pairs), gallop (zoomies, with a flexing spine) and a hop for
// stairs. Gaits are blended by speed and phase-locked, and the cycle advances by distance travelled over
// stride length, so paws plant instead of skating. R3F would wrap exactly this mixer; it adds no animation.
import * as THREE from 'three';
import { makeMaterial } from './ps1.js';

const C = {
  fur: new THREE.Color(0x9b968e), stripe: new THREE.Color(0x67625b), white: new THREE.Color(0xf0eadf),
  pink: new THREE.Color(0xe7a4a4), eye: new THREE.Color(0x22301f), pack: new THREE.Color(0xe9c43b),
  flap: new THREE.Color(0xc89b22), strap: new THREE.Color(0x7a5a1c), wand: new THREE.Color(0x5b3a5e),
  star: new THREE.Color(0xfff1a6),
};

let whiteTex;
function mat(opts = {}) {
  if (!whiteTex) {
    whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    whiteTex.needsUpdate = true;
  }
  return makeMaterial(whiteTex, opts);
}

function paint(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = fn(v);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const solid = (geo, c) => paint(geo, () => c);

// ---------------------------------------------------------------- the model (joints are named for the clips)

const LEGS = {
  // name: [x, z, front?]  hip/shoulder positions relative to their half of the body
  legFL: [-0.046, 0.03, true], legFR: [0.046, 0.03, true],
  legHL: [-0.048, -0.03, false], legHR: [0.048, -0.03, false],
};
const UPPER = 0.04, LOWER = 0.038;
export const BODY_Y = 0.1;   // the body's centre, standing: a round body low on stubby legs

export function makeKitten() {
  const m = mat(), glow = mat({ glow: 1 });
  const node = (name, parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.name = name; g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const add = (parent, geo, x = 0, y = 0, z = 0, material = m) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const root = new THREE.Group();                 // placed by the game; faces +z
  const body = node('body', root, 0, BODY_Y, 0);  // bob and pitch
  const hips = node('hips', body, 0, 0, -0.03);
  const chest = node('chest', body, 0, 0.004, 0.03);

  // a short, round body: two fat halves, white underneath and down the front
  const half = (rz, front) => {
    const g = new THREE.SphereGeometry(1, 12, 9);
    g.scale(0.09, 0.082, 0.072);
    return paint(g, (v) => {
      if (v.y < -0.034 || (front && v.z > 0.03 && v.y < 0.03)) return C.white;
      return Math.sin((v.z + rz) * 70) > 0.4 ? C.stripe : C.fur;
    });
  };
  add(hips, half(-0.03, false));
  add(chest, half(0.03, true));

  // a big round head, wider than the body, sitting right on it
  const neck = node('neck', chest, 0, 0.05, 0.035);
  const head = node('head', neck, 0, 0.035, 0.03);
  const skull = new THREE.SphereGeometry(0.09, 14, 11);
  skull.scale(1.08, 0.94, 0.96);
  paint(skull, (v) => {
    if (v.z > 0.03 && v.y < -0.014) return C.white;                                      // a white lower face
    if (v.y > 0.045 && (Math.abs(v.x) < 0.01 || Math.abs(Math.abs(v.x) - 0.03) < 0.007)) return C.stripe;   // tabby brow
    return C.fur;
  });
  add(head, skull);
  // fluffy cheeks and a small white muzzle, with a tiny nose
  for (const s of [-1, 1]) add(head, paint(new THREE.SphereGeometry(0.042, 8, 6), (v) => (v.y < 0.006 ? C.white : C.fur)), s * 0.058, -0.032, 0.032).scale.set(1, 0.85, 0.9);
  add(head, solid(new THREE.SphereGeometry(0.03, 8, 6), C.white), 0, -0.036, 0.07).scale.set(1.25, 0.8, 0.75);
  add(head, solid(new THREE.SphereGeometry(0.0075, 4, 3), C.pink), 0, -0.022, 0.092);
  for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
    // small ears, set wide
    const ear = node('ear' + side, head, s * 0.052, 0.064, -0.012);
    const eg = paint(new THREE.ConeGeometry(0.032, 0.06, 4), (v) => (v.z > 0.004 ? C.pink : C.fur));
    eg.translate(0, 0.024, 0);
    add(ear, eg).rotation.set(-0.12, Math.PI / 4, s * -0.36);
    // big dark eyes, wide apart and low on the face, each with a highlight
    const eye = node('eye' + side, head, s * 0.042, -0.006, 0.073);
    add(eye, solid(new THREE.SphereGeometry(0.0195, 8, 6), C.eye)).scale.set(1, 1.15, 0.5);
    add(eye, solid(new THREE.SphereGeometry(0.0058, 4, 3), C.white), -s * 0.005, 0.008, 0.008);
  }

  // stubby legs: upper and lower segments, white socks on the lower
  for (const [name, [x, z, front]] of Object.entries(LEGS)) {
    const top = node(name, front ? chest : hips, x, -0.02, z);
    const ug = new THREE.CylinderGeometry(0.023, 0.021, UPPER, 6);
    ug.translate(0, -UPPER / 2, 0);
    add(top, solid(ug, C.fur));
    const low = node(name + 'Low', top, 0, -UPPER, 0);
    const lg = new THREE.CylinderGeometry(0.02, 0.019, LOWER, 6);
    lg.translate(0, -LOWER / 2, 0);
    add(low, paint(lg, (v) => (v.y < -LOWER * 0.45 ? C.white : C.fur)));
    add(low, solid(new THREE.SphereGeometry(0.021, 6, 4), C.white), 0, -LOWER, 0.004).scale.set(1, 0.6, 1.25);
  }

  // a fluffy tail: four segments from the hips
  let parent = hips;
  for (let i = 0; i < 4; i++) {
    const seg = node('tail' + i, parent, 0, i ? 0.048 : 0.03, i ? 0 : -0.064);
    const g = new THREE.CylinderGeometry(0.018 - i * 0.002, 0.02 - i * 0.002, 0.05, 6);
    g.translate(0, 0.025, 0);
    add(seg, paint(g, () => (i % 2 ? C.stripe : C.fur)));
    parent = seg;
  }

  // backpack, riding on the round back
  const pack = node('pack', chest, 0, 0.085, -0.035);
  add(pack, solid(new THREE.BoxGeometry(0.1, 0.065, 0.095), C.pack));
  add(pack, solid(new THREE.BoxGeometry(0.104, 0.02, 0.06), C.flap), 0, 0.028, 0.02);
  for (const s of [-1, 1]) add(pack, solid(new THREE.BoxGeometry(0.012, 0.09, 0.012), C.strap), s * 0.042, -0.045, 0.05);

  // the wand floats at the right shoulder (magic, so it's driven in code, not by clips)
  const wand = new THREE.Group();
  root.add(wand);
  add(wand, solid(new THREE.CylinderGeometry(0.004, 0.005, 0.13, 5), C.wand));
  const star = add(wand, solid(new THREE.OctahedronGeometry(0.022, 0), C.star), 0, 0.075, 0, glow);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 10).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.position.y = 0.004;
  root.add(shadow);

  // ------------------------------------------------------------ clips and the mixer
  const clips = makeClips();
  const mixer = new THREE.AnimationMixer(root);
  const act = {};
  for (const [k, clip] of Object.entries(clips)) {
    act[k] = mixer.clipAction(clip);
    act[k].play();
    act[k].setEffectiveWeight(0);
  }
  const GAITS = ['walk', 'trot', 'gallop', 'hop'];
  const weights = Object.fromEntries(Object.keys(act).map((k) => [k, 0]));
  let phase = 0, idleT = 0, t = 0;

  return {
    root,
    mixer,
    clips,
    // speed in m/s along the ground; mode: null | 'stairs' | 'escalator' | 'lift'
    animate(dt, speed, mode = null) {
      t += dt;
      const target = Object.fromEntries(Object.keys(act).map((k) => [k, 0]));
      if (mode === 'stairs') {
        target.hop = 1; speed = Math.max(speed, 1.6);
      } else if (mode === 'escalator' || mode === 'lift') {
        target.sit = 1;                                     // let the machine do the work
      } else if (speed < 0.05) {
        idleT += dt;
        const s = THREE.MathUtils.smoothstep(idleT, 4, 5);   // after a few seconds, sit down
        target.idle = 1 - s; target.sit = s;
      } else {
        idleT = 0;
        // gait by speed: walk under ~1 m/s, trot up to ~4, gallop above
        const w = 1 - THREE.MathUtils.smoothstep(speed, 0.6, 1.3);
        const g = THREE.MathUtils.smoothstep(speed, 3.2, 4.5);
        target.walk = w; target.gallop = g; target.trot = Math.max(0, 1 - w - g);
      }
      // ease weights so gait changes don't pop
      const k = 1 - Math.exp(-dt * 10);
      for (const n of Object.keys(act)) weights[n] += (target[n] - weights[n]) * k;
      // stride: cycles advance by distance over stride length, blended across gaits
      const stride = { walk: 0.15, trot: 0.26, gallop: 0.57, hop: 0.37 };   // short legs, short strides
      let L = 0, W = 0;
      for (const n of GAITS) { L += weights[n] * stride[n]; W += weights[n]; }
      if (W > 1e-3) phase = (phase + (speed * dt) / (L / W)) % 1;
      for (const n of Object.keys(act)) {
        act[n].setEffectiveWeight(weights[n]);
        act[n].time = GAITS.includes(n) ? phase * act[n].getClip().duration : (t % act[n].getClip().duration);
      }
      mixer.update(0);

      wand.position.set(0.125, 0.25 + Math.sin(t * 2.3) * 0.015, 0.04 + Math.sin(t * 1.7) * 0.01);
      wand.rotation.set(0.25, 0, -0.35 + Math.sin(t * 1.3) * 0.08);
      star.rotation.y = t * 2;
    },
  };
}

// ---------------------------------------------------------------- clip authoring

const N = 24; // samples per cycle

// build a looping clip of duration `dur` from functions of normalised time p in [0, 1)
function clip(name, dur, spec) {
  const tracks = [];
  const times = Array.from({ length: N + 1 }, (_, i) => (i / N) * dur);
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [target, fn] of Object.entries(spec)) {
    const [nodeName, prop] = target.split('.');
    const vals = [];
    for (let i = 0; i <= N; i++) {
      const v = fn((i % N) / N);
      if (prop === 'rot') { q.setFromEuler(e.set(v[0], v[1] || 0, v[2] || 0)); vals.push(q.x, q.y, q.z, q.w); }
      else vals.push(...v);
    }
    if (prop === 'rot') tracks.push(new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, vals));
    else if (prop === 'pos') tracks.push(new THREE.VectorKeyframeTrack(`${nodeName}.position`, times, vals));
    else if (prop === 'scale') tracks.push(new THREE.VectorKeyframeTrack(`${nodeName}.scale`, times, vals));
  }
  return new THREE.AnimationClip(name, dur, tracks);
}

const TAU = Math.PI * 2;
const S = (p) => Math.sin(p * TAU);

// one leg through a stride: stance sweeps the paw back along the ground, swing lifts it and brings it forward.
// rotation.x > 0 swings a leg back (the kitten faces +z). Lower segments bend opposite ways front and back.
function leg(p, { duty, A, K, front, offset = 0, lean = 0 }) {
  const x = ((p - offset) % 1 + 1) % 1;
  let up, bend;
  if (x < duty) {
    const s = x / duty;                       // stance: forward -> back, nearly straight
    up = -A + 2 * A * s;
    bend = 0.12 * Math.sin(Math.PI * s);
  } else {
    const s = (x - duty) / (1 - duty);        // swing: back -> forward, knee/elbow folds to lift the paw
    up = A - 2 * A * (0.5 - 0.5 * Math.cos(Math.PI * s));
    bend = K * Math.sin(Math.PI * s);
  }
  return { up: up + lean, low: front ? bend : -bend };
}

function gaitSpec({ offsets, duty, A, K, bob, pitch, spine = 0, tailLift, tailSway, headBob, lift = 0 }) {
  const spec = {};
  for (const [name, off] of Object.entries(offsets)) {
    const front = name.startsWith('legF');
    spec[`${name}.rot`] = (p) => [leg(p, { duty, A, K, front, offset: off }).up, 0, 0];
    spec[`${name}Low.rot`] = (p) => [leg(p, { duty, A, K, front, offset: off }).low, 0, 0];
  }
  spec['body.pos'] = (p) => [0, BODY_Y + bob(p) + lift * Math.max(0, S(p - 0.1)), 0];
  spec['body.rot'] = (p) => [pitch(p), 0, 0];
  spec['hips.rot'] = (p) => [-spine * S(p), 0, 0];          // the spine curls and stretches at a gallop
  spec['chest.rot'] = (p) => [spine * S(p), 0, 0];
  spec['neck.rot'] = (p) => [-0.15 + headBob(p), 0, 0];
  spec['head.rot'] = (p) => [-pitch(p) * 0.8 - headBob(p) * 0.6, 0, 0]; // head stays steady, as cats' do
  for (let i = 0; i < 4; i++) {
    spec[`tail${i}.rot`] = (p) => [i === 0 ? -tailLift : 0.18 + i * 0.04, 0, tailSway * S(p + i * 0.12)];
  }
  return spec;
}

function makeClips() {
  const walk = clip('walk', 1, gaitSpec({
    offsets: { legHL: 0, legFL: 0.25, legHR: 0.5, legFR: 0.75 },   // 4-beat lateral sequence
    duty: 0.66, A: 0.42, K: 0.7,
    bob: (p) => 0.004 * Math.cos(p * TAU * 2), pitch: () => 0, headBob: (p) => 0.04 * S(p * 2),
    tailLift: 1.0, tailSway: 0.2,
  }));
  const trot = clip('trot', 1, gaitSpec({
    offsets: { legFL: 0, legHR: 0, legFR: 0.5, legHL: 0.5 },        // diagonal pairs
    duty: 0.5, A: 0.6, K: 0.95,
    bob: (p) => 0.009 * Math.abs(Math.cos(p * TAU)), pitch: (p) => 0.03 * S(p * 2), headBob: (p) => 0.05 * S(p * 2),
    tailLift: 1.15, tailSway: 0.14,
  }));
  const gallop = clip('gallop', 1, gaitSpec({
    offsets: { legHL: 0, legHR: 0.07, legFL: 0.5, legFR: 0.57 },    // half-bound: hinds then fores
    duty: 0.34, A: 0.95, K: 1.2,
    bob: (p) => 0.004 * S(p), pitch: (p) => 0.16 * S(p + 0.25), headBob: (p) => 0.06 * S(p),
    spine: 0.16, lift: 0.02, tailLift: 1.4, tailSway: 0.08,
  }));
  const hop = clip('hop', 1, gaitSpec({
    offsets: { legHL: 0, legHR: 0.03, legFL: 0.18, legFR: 0.21 },   // bounding up the steps
    duty: 0.4, A: 0.75, K: 1.1,
    bob: () => 0, pitch: (p) => -0.22 + 0.12 * S(p), headBob: () => 0,
    spine: 0.15, lift: 0.04, tailLift: 1.2, tailSway: 0.05,
  }));

  // idle: breathing, a slow look around, a blink and an ear flick, tail swaying
  const idleSpec = {
    'chest.scale': (p) => [1, 1 + 0.03 * S(p * 3), 1],
    'head.rot': (p) => [0.05 * S(p), 0.35 * S(p) * S(p * 0.5 + 0.25), 0],
    'eyeL.scale': (p) => [1, Math.abs(p - 0.62) < 0.02 ? 0.12 : 1, 1],
    'eyeR.scale': (p) => [1, Math.abs(p - 0.62) < 0.02 ? 0.12 : 1, 1],
    'earL.rot': (p) => [0, 0, Math.abs(p - 0.3) < 0.03 ? -0.5 : 0],
  };
  for (let i = 0; i < 4; i++) idleSpec[`tail${i}.rot`] = (p) => [i === 0 ? -0.95 : 0.4, 0, (0.14 + 0.07 * i) * S(p * 2 + i * 0.1)];
  const idle = clip('idle', 4, idleSpec);

  // sit: hinds folded under, chest up, front legs straight, tail wrapped round the paws
  const sitSpec = {
    'body.pos': () => [0, BODY_Y - 0.022, -0.015],
    'body.rot': () => [-0.45, 0, 0],
    'hips.rot': () => [0.2, 0, 0],
    'chest.rot': () => [0.0, 0, 0],
    'chest.scale': (p) => [1, 1 + 0.025 * S(p * 2), 1],
    'legHL.rot': () => [-1.0, 0, 0], 'legHR.rot': () => [-1.0, 0, 0],
    'legHLLow.rot': () => [-1.9, 0, 0], 'legHRLow.rot': () => [-1.9, 0, 0],
    'legFL.rot': () => [0.45, 0, 0], 'legFR.rot': () => [0.45, 0, 0],
    'legFLLow.rot': () => [0, 0, 0], 'legFRLow.rot': () => [0, 0, 0],
    'neck.rot': () => [0.35, 0, 0],
    'head.rot': (p) => [0.1, 0.25 * S(p), 0],
    'eyeL.scale': (p) => [1, Math.abs(p - 0.5) < 0.025 ? 0.12 : 1, 1],
    'eyeR.scale': (p) => [1, Math.abs(p - 0.5) < 0.025 ? 0.12 : 1, 1],
  };
  for (let i = 0; i < 4; i++) sitSpec[`tail${i}.rot`] = (p) => [i === 0 ? 0.9 : 0.15, i === 0 ? 0.9 : 0.45, 0.05 * S(p + i * 0.1)];
  const sit = clip('sit', 3, sitSpec);

  return { idle, sit, walk, trot, gallop, hop };
}
