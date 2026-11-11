// Merged, vertex-coloured blocks: many little boxes and balls drawn as one mesh, so crowds, trains and tanuki cost a
// handful of draw calls instead of hundreds. Colours are baked into vertices; the PS1 shader multiplies them in.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './ps1.js';

const mats = new Map();
// one shared material; `fade` turns it to screen-door when it's between the camera and the kitten, like walls;
// `glow` carries further through the fog, like a lit sign
export function blockMaterial(fade = false, glow = 0) {
  const key = `${fade}|${glow}`;
  if (!mats.has(key)) {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    t.needsUpdate = true;
    mats.set(key, makeMaterial(t, { fade, glow }));
  }
  return mats.get(key);
}

function coloured(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return geo.index ? geo.toNonIndexed() : geo;
}
// a box w × h × d centred at (x, y, z)
export const B = (w, h, d, hex, x = 0, y = 0, z = 0) => coloured(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
// a ball of radius r at (x, y, z), squashed by (sx, sy, sz)
export const S = (r, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => coloured(new THREE.SphereGeometry(r, 7, 5).scale(sx, sy, sz).translate(x, y, z), hex);
// a cone of radius r and height h, its base at (x, y, z), pointing up (or down, with h < 0)
export const C = (r, h, hex, x = 0, y = 0, z = 0, seg = 8) =>
  coloured(new THREE.ConeGeometry(r, Math.abs(h), seg, 1, false).rotateX(h < 0 ? Math.PI : 0).translate(x, y + h / 2, z), hex);
// many pieces, one mesh
export const merged = (parts, fade = false, glow = 0) => new THREE.Mesh(mergeGeometries(parts), blockMaterial(fade, glow));
