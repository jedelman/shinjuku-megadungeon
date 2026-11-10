// Meshes from the world JSON, one group per floor, built on demand.
import * as THREE from 'three';
import { makeMaterial } from './ps1.js';
import { floorTex, wallTex, glassTex, ceilTex, stepTex, signAtlas } from './textures.js';
import { floorKey, pointInRing } from './nav.js';

export const FH = 5;    // metres between floor levels (ordinals)
export const CH = 3.1;  // ceiling height

const KIND = {
  edge: 0xb3afa4, room: 0xd9d1bd, staff: 0xc6bea8, ticket: 0x9cc79e, wc: 0x98bedc, public: 0xd8caa6,
  info: 0xd8caa6, wait: 0xd8caa6, nursing: 0xe2c0c8, aid: 0xe6b3b3, void: 0x62625c, smoke: 0x9e9e8e,
  office: 0xcdc4ae, parking: 0x86867f,
};

class Builder {
  constructor() { this.pos = []; this.uv = []; this.col = []; }
  tri(a, b, c, ua, ub, uc, ca, cb = ca, cc = ca) {
    this.pos.push(...a, ...b, ...c);
    this.uv.push(...ua, ...ub, ...uc);
    this.col.push(...ca, ...cb, ...cc);
  }
  quad(a, b, c, d, ua, ub, uc, ud, ca, cb = ca, cc = ca, cd = ca) {
    this.tri(a, b, c, ua, ub, uc, ca, cb, cc);
    this.tri(a, c, d, ua, uc, ud, ca, cc, cd);
  }
  mesh(mat) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
}

const rgb = (hex, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };

// earcut, then split long triangles: affine texturing needs small polygons (the PS1 did this too)
function triangles(poly, maxEdge = 3) {
  const contour = poly[0].map(([x, z]) => new THREE.Vector2(x, z));
  const holes = poly.slice(1).map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
  const pts = contour.concat(...holes);
  const out = [];
  const split = (a, b, c, depth) => {
    const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a);
    const m = Math.max(ab, bc, ca);
    if (m <= maxEdge || depth > 12) { out.push([a, b, c]); return; }
    if (m === ab) { const p = a.clone().lerp(b, 0.5); split(a, p, c, depth + 1); split(p, b, c, depth + 1); }
    else if (m === bc) { const p = b.clone().lerp(c, 0.5); split(a, b, p, depth + 1); split(a, p, c, depth + 1); }
    else { const p = c.clone().lerp(a, 0.5); split(a, b, p, depth + 1); split(p, b, c, depth + 1); }
  };
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, holes)) split(pts[i], pts[j], pts[k], 0);
  return out;
}

export class World {
  constructor(data) {
    this.data = data;
    this.groups = new Map();
    this.mats = {
      floor: makeMaterial(floorTex(), { side: THREE.DoubleSide }),
      wall: makeMaterial(wallTex(), { side: THREE.DoubleSide }),
      glass: makeMaterial(glassTex(), { side: THREE.DoubleSide, glow: 1 }),
      ceil: makeMaterial(ceilTex(), { side: THREE.DoubleSide, glow: 0.6 }),
      step: makeMaterial(stepTex(), { side: THREE.DoubleSide }),
    };
    const labels = [];
    data.exits.forEach((e, i) => labels.push({ key: 'x' + i, text: e.n, closed: e.closed }));
    data.gates.forEach((g, i) => { if (g.n) labels.push({ key: 'g' + i, text: g.n.length > 6 ? g.n.slice(0, 6) : g.n, gate: true }); });
    this.atlas = signAtlas(labels);
    this.mats.sign = makeMaterial(this.atlas.tex, { side: THREE.DoubleSide, glow: 1 });
  }

  floor(o) {
    const key = floorKey(o);
    if (this.groups.has(key)) return this.groups.get(key);
    const f = this.data.floors[key];
    const group = new THREE.Group();
    group.name = 'floor ' + key;
    this.groups.set(key, group);
    if (!f) return group;
    const y = Number(key) * FH;
    const outdoor = (f.outdoor || []).map((p) => p[0]);

    const fl = new Builder(), ce = new Builder();
    const white = [1, 1, 1];
    for (const poly of f.walk) {
      for (const [a, b, c] of triangles(poly)) {
        const P = (v, h) => [v.x, h, v.y];
        const U = (v, s) => [v.x / s, v.y / s];
        fl.tri(P(a, y), P(b, y), P(c, y), U(a, 1.2), U(b, 1.2), U(c, 1.2), white);
        const cx = (a.x + b.x + c.x) / 3, cz = (a.y + b.y + c.y) / 3;
        if (!outdoor.some((r) => pointInRing(cx, cz, r))) {
          ce.tri(P(a, y + CH), P(c, y + CH), P(b, y + CH), U(a, 3.6), U(c, 3.6), U(b, 3.6), white);
        }
      }
    }

    const wl = new Builder(), gl = new Builder();
    for (const [x1, z1, x2, z2, kind] of f.walls) {
      if (kind === 'col') continue;
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.ceil(len / 2));
      const shop = kind === 'shop';
      const b = shop ? gl : wl;
      const tint = shop ? [1, 1, 1] : rgb(KIND[kind] ?? KIND.edge);
      const rows = [0, CH * 0.5, CH];
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const ax = x1 + (x2 - x1) * t0, az = z1 + (z2 - z1) * t0;
        const bx = x1 + (x2 - x1) * t1, bz = z1 + (z2 - z1) * t1;
        for (let r = 0; r < 2; r++) {
          const h0 = rows[r], h1 = rows[r + 1];
          const s = shop ? 3 : 1.2;
          const ao0 = 0.7 + 0.3 * (h0 / CH), ao1 = 0.7 + 0.3 * (h1 / CH);
          const c0 = tint.map((v) => v * ao0), c1 = tint.map((v) => v * ao1);
          b.quad([ax, y + h0, az], [bx, y + h0, bz], [bx, y + h1, bz], [ax, y + h1, az],
            [(t0 * len) / s, h0 / s], [(t1 * len) / s, h0 / s], [(t1 * len) / s, h1 / s], [(t0 * len) / s, h1 / s],
            c0, c0, c1, c1);
        }
      }
    }

    // columns: the pillar forest
    const colTint = rgb(0xe3dfd2);
    for (const ring of f.cols) {
      let u = 0;
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
        const len = Math.hypot(bx - ax, bz - az);
        wl.quad([ax, y, az], [bx, y, bz], [bx, y + CH, bz], [ax, y + CH, az],
          [u / 1.2, 0], [(u + len) / 1.2, 0], [(u + len) / 1.2, CH / 1.2], [u / 1.2, CH / 1.2],
          colTint.map((v) => v * 0.72), colTint.map((v) => v * 0.72), colTint, colTint);
        u += len;
      }
    }

    // stairs, escalators and lifts that start or end on this floor
    const st = new Builder();
    const nodes = this.data.nodes;
    for (const c of this.data.conns) {
      const oa = nodes[c.a][2], ob = nodes[c.b][2];
      if (oa !== Number(key) && ob !== Number(key)) continue;
      if (oa > ob ? ob !== Number(key) : oa !== Number(key)) continue; // build each connector once, from its lower floor
      const w = c.t === 5 ? 0.6 : 0.9;
      let v = 0;
      for (let i = 0; i + 1 < c.p.length; i++) {
        const [ax, az, ao] = c.p[i], [bx, bz, bo] = c.p[i + 1];
        const len = Math.hypot(bx - ax, bz - az, (bo - ao) * FH);
        const hl = Math.hypot(bx - ax, bz - az);
        if (len < 1e-3 || hl < 1e-3) continue; // lifts go straight up: drawn as shafts below
        const dx = (bx - ax) / hl, dz = (bz - az) / hl;
        const px = -dz * w, pz = dx * w;
        const tint = c.t === 4 ? rgb(0x8f98a0) : [1, 1, 1];
        st.quad([ax + px, ao * FH, az + pz], [ax - px, ao * FH, az - pz], [bx - px, bo * FH, bz - pz], [bx + px, bo * FH, bz + pz],
          [0, v / 0.6], [1, v / 0.6], [1, (v + len) / 0.6], [0, (v + len) / 0.6], tint);
        v += len;
      }
    }
    // lift doors at each end on this floor: a steel box you step into
    const steel = rgb(0x9aa3ab);
    for (const c of this.data.conns) {
      if (c.t !== 4) continue;
      for (const end of [c.a, c.b]) {
        const [x, z, o] = nodes[end];
        if (floorKey(o) !== key) continue;
        const s = 0.8;
        const cs = [[x - s, z - s], [x + s, z - s], [x + s, z + s], [x - s, z + s]];
        for (let i = 0; i < 4; i++) {
          const [ax, az] = cs[i], [bx, bz] = cs[(i + 1) % 4];
          st.quad([ax, y, az], [bx, y, bz], [bx, y + 2.3, bz], [ax, y + 2.3, az], [0, 0], [1, 0], [1, 4], [0, 4], steel);
        }
      }
    }

    // signs: exit codes (yellow) and named gates (green), hung below the ceiling
    const sg = new Builder();
    const hang = (x, z, key2, wdt, face) => {
      const r = this.atlas.uv.get(key2);
      if (!r) return;
      const [u0, v0, u1, v1] = r;
      const hx = Math.cos(face) * wdt / 2, hz = Math.sin(face) * wdt / 2;
      const yb = y + CH - 0.75, yt = y + CH - 0.35;
      sg.quad([x - hx, yb, z - hz], [x + hx, yb, z + hz], [x + hx, yt, z + hz], [x - hx, yt, z - hz],
        [u0, v0], [u1, v0], [u1, v1], [u0, v1], [1, 1, 1]);
    };
    this.data.exits.forEach((e, i) => {
      if (floorKey(e.o) !== key) return;
      hang(e.x, e.z, 'x' + i, 1.6, faceAt(this.data, e.x, e.z, e.o));
    });
    this.data.gates.forEach((g, i) => {
      if (!g.n || floorKey(g.o) !== key) return;
      const mx = (g.a[0] + g.b[0]) / 2, mz = (g.a[1] + g.b[1]) / 2;
      hang(mx, mz, 'g' + i, 2.2, Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]));
    });

    for (const [b, m] of [[fl, 'floor'], [ce, 'ceil'], [wl, 'wall'], [gl, 'glass'], [st, 'step'], [sg, 'sign']]) {
      const mesh = b.mesh(this.mats[m]);
      if (mesh) group.add(mesh);
    }
    return group;
  }
}

// face a sign across the nearest network link, so you read it walking by
function faceAt(data, x, z, o) {
  let best = null, bd = 15;
  for (const [a, b] of data.links) {
    const A = data.nodes[a], B = data.nodes[b];
    if (A[2] !== o || B[2] !== o) continue;
    const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
    const d = Math.hypot(mx - x, mz - z);
    if (d < bd) { bd = d; best = Math.atan2(B[1] - A[1], B[0] - A[0]) + Math.PI / 2; }
  }
  return best ?? 0;
}
