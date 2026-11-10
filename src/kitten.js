// The player: a kitten, 30 cm to the ear tips, with a backpack and a magic wand.
// At this size the station reads about six times bigger, which leaves room for big bosses.
// Low-poly, vertex-coloured, PS1 materials. The wand floats at the shoulder: paws don't hold wands.
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

// colour each vertex with fn(position) -> THREE.Color
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

export function makeKitten() {
  const root = new THREE.Group();          // sits on the floor, faces +z
  const body = new THREE.Group();          // bobs
  root.add(body);
  const m = mat(), glow = mat({ glow: 1 });
  const add = (parent, geo, x, y, z, material = m) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // torso: tabby stripes across the back, white chest and belly
  const torso = new THREE.SphereGeometry(1, 10, 8);
  torso.scale(0.085, 0.075, 0.14);
  paint(torso, (v) => {
    if (v.y < -0.03 || (v.z > 0.08 && v.y < 0.02)) return C.white;
    return Math.sin(v.z * 70) > 0.35 ? C.stripe : C.fur;
  });
  add(body, torso, 0, 0.13, 0);

  // head, muzzle, ears, eyes, nose
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.12);
  body.add(head);
  const skull = new THREE.SphereGeometry(0.07, 10, 8);
  paint(skull, (v) => (v.z > 0.035 && v.y < 0.0 ? C.white : v.y > 0.045 && Math.abs(v.x) < 0.02 ? C.stripe : C.fur));
  add(head, skull, 0, 0, 0);
  add(head, solid(new THREE.SphereGeometry(0.03, 6, 5), C.white), 0, -0.022, 0.055);
  add(head, solid(new THREE.SphereGeometry(0.008, 4, 3), C.pink), 0, -0.012, 0.083);
  for (const s of [-1, 1]) {
    const ear = add(head, paint(new THREE.ConeGeometry(0.03, 0.06, 4), (v) => (v.z > 0.005 ? C.pink : C.fur)), s * 0.038, 0.064, -0.005);
    ear.rotation.set(-0.15, Math.PI / 4, s * -0.32);
    const eye = add(head, solid(new THREE.SphereGeometry(0.0125, 5, 4), C.eye), s * 0.028, 0.008, 0.06);
    eye.scale.set(1, 1.35, 0.6);
    add(head, solid(new THREE.SphereGeometry(0.0035, 3, 2), C.white), s * 0.025, 0.014, 0.068);
  }

  // legs: pivot at the hip, white socks
  const legs = [];
  for (const [x, z] of [[-0.045, 0.085], [0.045, 0.085], [-0.045, -0.085], [0.045, -0.085]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.1, z);
    body.add(hip);
    const leg = new THREE.CylinderGeometry(0.017, 0.015, 0.1, 5);
    leg.translate(0, -0.05, 0);
    paint(leg, (v) => (v.y < -0.075 ? C.white : C.fur));
    add(hip, leg, 0, 0, 0);
    legs.push(hip);
  }

  // tail: four segments that curl up
  const tail = [];
  let parent = body, pos = [0, 0.15, -0.13];
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    seg.position.set(...pos);
    parent.add(seg);
    const g = new THREE.CylinderGeometry(0.014 - i * 0.002, 0.016 - i * 0.002, 0.06, 5);
    g.translate(0, 0.03, 0);
    paint(g, () => (i % 2 ? C.stripe : C.fur));
    add(seg, g, 0, 0, 0);
    tail.push(seg);
    parent = seg; pos = [0, 0.06, 0];
  }

  // backpack with a flap and straps
  const pack = new THREE.Group();
  pack.position.set(0, 0.2, -0.02);
  body.add(pack);
  add(pack, solid(new THREE.BoxGeometry(0.1, 0.07, 0.11), C.pack), 0, 0, 0);
  add(pack, solid(new THREE.BoxGeometry(0.104, 0.02, 0.07), C.flap), 0, 0.03, 0.025);
  for (const s of [-1, 1]) add(pack, solid(new THREE.BoxGeometry(0.012, 0.11, 0.012), C.strap), s * 0.04, -0.045, 0.06);

  // the wand floats at the right shoulder; its star glows through the fog
  const wand = new THREE.Group();
  root.add(wand);
  const stick = add(wand, solid(new THREE.CylinderGeometry(0.004, 0.005, 0.13, 5), C.wand), 0, 0, 0);
  void stick;
  const star = add(wand, solid(new THREE.OctahedronGeometry(0.022, 0), C.star), 0, 0.075, 0, glow);

  // blob shadow: scale reads better with one
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 10).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.position.y = 0.004;
  root.add(shadow);

  let t = 0;
  return {
    root,
    // stride: phase in radians; speed in m/s; dt seconds
    animate(dt, phase, speed) {
      t += dt;
      const moving = speed > 0.05;
      const amp = moving ? Math.min(0.75, 0.3 + speed * 0.08) : 0;
      // trot: diagonal pairs together
      legs[0].rotation.x = Math.sin(phase) * amp;
      legs[3].rotation.x = Math.sin(phase) * amp;
      legs[1].rotation.x = Math.sin(phase + Math.PI) * amp;
      legs[2].rotation.x = Math.sin(phase + Math.PI) * amp;
      body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.012 : Math.sin(t * 2) * 0.002;
      head.rotation.x = moving ? Math.sin(phase * 2) * 0.05 : Math.sin(t * 0.7) * 0.06;
      // tail: up and curling when calm, streaming back at speed
      // base tips back, the rest curls up like a question mark; at speed it streams out flatter
      const base = moving ? -1.1 - Math.min(0.35, speed * 0.05) : -0.95;
      const curl = moving ? Math.max(0.08, 0.3 - speed * 0.03) : 0.42;
      tail.forEach((s, i) => {
        s.rotation.x = i === 0 ? base : curl;
        s.rotation.z = Math.sin(t * (moving ? 6 : 1.6) + i * 0.7) * (0.12 + 0.07 * i);
      });
      wand.position.set(0.11, 0.27 + Math.sin(t * 2.3) * 0.015, 0.02 + Math.sin(t * 1.7) * 0.01);
      wand.rotation.set(0.25, 0, -0.35 + Math.sin(t * 1.3) * 0.08);
      star.rotation.y = t * 2;
    },
  };
}
