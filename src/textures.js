// Small hand-made textures, drawn at boot. 64 px, nearest filtering, PS1-sized.
import * as THREE from 'three';

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// floor: 30 cm terrazzo tiles; one texture repeat = 1.2 m
export const floorTex = () => canvas(64, 64, (g, w, h) => {
  const r = rng(7);
  g.fillStyle = '#b9b29f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const v = 150 + r() * 70;
    g.fillStyle = `rgb(${v},${v - 6},${v - 18})`;
    g.fillRect(r() * w, r() * h, 1, 1);
  }
  g.fillStyle = '#8d8676';
  for (let k = 0; k < 4; k++) { g.fillRect(k * 16, 0, 1, h); g.fillRect(0, k * 16, w, 1); }
});

// walls: small square tiles; tinted per kind by vertex colour
export const wallTex = () => canvas(64, 64, (g, w, h) => {
  const r = rng(11);
  g.fillStyle = '#e7e3d8'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = 218 + r() * 22;
    g.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
    g.fillRect(x * 8 + 1, y * 8 + 1, 7, 7);
  }
});

// shopfront: lit glass with mullions
export const glassTex = () => canvas(64, 64, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#fff3cf'); grd.addColorStop(1, '#e0b46c');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4a4033';
  g.fillRect(0, 0, 3, h); g.fillRect(31, 0, 2, h); g.fillRect(0, 44, w, 3); g.fillRect(0, 0, w, 2);
  const r = rng(3);
  for (let i = 0; i < 9; i++) {           // shelves, goods, someone's umbrella
    g.fillStyle = ['#c0603f', '#3f6fa0', '#8a9a4a', '#d8d0c0'][i % 4];
    g.fillRect(4 + r() * 52, 48 + r() * 12, 3 + r() * 6, 2 + r() * 4);
  }
});

// ceiling: 60 cm panels with a fluorescent bar; one repeat = 3.6 m
export const ceilTex = () => canvas(64, 64, (g, w, h) => {
  g.fillStyle = '#d7d5cc'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b3b0a5';
  for (let k = 0; k < 6; k++) { g.fillRect(Math.round(k * 64 / 6), 0, 1, h); g.fillRect(0, Math.round(k * 64 / 6), w, 1); }
  g.fillStyle = '#fbfff4'; g.fillRect(8, 29, 48, 6);
  g.fillStyle = '#ffffff'; g.fillRect(9, 31, 46, 2);
});

// stairs and escalators: treads
export const stepTex = () => canvas(64, 64, (g, w, h) => {
  g.fillStyle = '#7c7a73'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) {
    g.fillStyle = '#9b988e'; g.fillRect(0, y * 8, w, 5);
    g.fillStyle = '#d9c64a'; g.fillRect(0, y * 8, w, 1);   // yellow nosing
  }
});

// exit signs: one atlas, 8 x 32 cells of 128 x 32 px
export function signAtlas(labels) {
  const cols = 8, cw = 128, ch = 32;
  const rows = Math.ceil(labels.length / cols);
  const H = 2 ** Math.ceil(Math.log2(Math.max(rows * ch, 32)));
  const uv = new Map();
  const tex = canvas(cols * cw, H, (g) => {
    labels.forEach((label, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      const closed = label.closed;
      g.fillStyle = closed ? '#5a5a5a' : '#f2c81c';
      g.fillRect(x, y, cw, ch);
      g.fillStyle = '#141414';
      g.fillRect(x + 2, y + 2, 26, 28);
      g.fillStyle = closed ? '#5a5a5a' : '#f2c81c';
      g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('出', x + 15, y + 17);
      g.fillStyle = '#141414';
      g.font = 'bold 22px monospace';
      g.fillText(label.text, x + 78, y + 17);
      if (closed) { g.strokeStyle = '#d33'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 32, y + 4); g.lineTo(x + cw - 4, y + ch - 4); g.stroke(); }
      uv.set(label.key, [x / (cols * cw), 1 - (y + ch) / H, (x + cw) / (cols * cw), 1 - y / H]);
    });
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  return { tex, uv };
}
