// Navigation without three.js, so tests can run it in Node.
// World units: metres, x east, z south. Floors are keyed by ordinal ("-2", "-1", ...).

const CELL = 4; // metres per collision cell

export function floorKey(o) {
  return String(Number(o).toFixed(1));
}

// Per-floor collision: wall segments bucketed into a grid, plus row buckets for point-in-area tests.
export class FloorNav {
  constructor(floor) {
    this.walls = floor.walls; // [x1, z1, x2, z2, kind]
    this.grid = new Map();
    this.rows = new Map();
    this.walls.forEach((w, i) => {
      const [x1, z1, x2, z2] = w;
      const cx0 = Math.floor(Math.min(x1, x2) / CELL), cx1 = Math.floor(Math.max(x1, x2) / CELL);
      const cz0 = Math.floor(Math.min(z1, z2) / CELL), cz1 = Math.floor(Math.max(z1, z2) / CELL);
      for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
        const k = cx + ',' + cz;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(i);
      }
      for (let cz = cz0; cz <= cz1; cz++) {
        if (!this.rows.has(cz)) this.rows.set(cz, []);
        this.rows.get(cz).push(i);
      }
    });
    this.outdoor = (floor.outdoor || []).map((p) => p[0]);
  }

  near(x, z, r) {
    const out = new Set();
    const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
    const cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
      const b = this.grid.get(cx + ',' + cz);
      if (b) for (const i of b) out.add(i);
    }
    return out;
  }

  // even-odd ray cast towards +x across wall segments in this row; walls are exactly the walkable boundary
  inside(x, z) {
    const row = this.rows.get(Math.floor(z / CELL));
    if (!row) return false;
    let n = 0;
    for (const i of row) {
      const [x1, z1, x2, z2] = this.walls[i];
      if ((z1 > z) !== (z2 > z)) {
        const xi = x1 + ((z - z1) / (z2 - z1)) * (x2 - x1);
        if (xi > x) n++;
      }
    }
    return (n & 1) === 1;
  }

  isOutdoor(x, z) {
    return this.outdoor.some((ring) => pointInRing(x, z, ring));
  }

  // move a circle of radius r from (x, z) by (dx, dz), sliding along walls
  move(x, z, dx, dz, r = 0.3) {
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (r * 0.8)));
    let px = x, pz = z;
    for (let s = 0; s < steps; s++) {
      let nx = px + dx / steps, nz = pz + dz / steps;
      for (let it = 0; it < 3; it++) {
        let pushed = false;
        for (const i of this.near(nx, nz, r + 0.1)) {
          const [x1, z1, x2, z2] = this.walls[i];
          const [cx, cz] = closest(nx, nz, x1, z1, x2, z2);
          const d = Math.hypot(nx - cx, nz - cz);
          if (d < r && d > 1e-6) {
            nx = cx + ((nx - cx) / d) * r;
            nz = cz + ((nz - cz) / d) * r;
            pushed = true;
          }
        }
        if (!pushed) break;
      }
      if (!this.inside(nx, nz)) break; // never tunnel out of the walkable area
      px = nx; pz = nz;
    }
    return [px, pz];
  }

  // push a circle of radius r off any walls it overlaps, without moving it otherwise (for the camera)
  clear(x, z, r) {
    for (let it = 0; it < 4; it++) {
      let pushed = false;
      for (const i of this.near(x, z, r + 0.1)) {
        const [x1, z1, x2, z2] = this.walls[i];
        const [cx, cz] = closest(x, z, x1, z1, x2, z2);
        const d = Math.hypot(x - cx, z - cz);
        if (d < r && d > 1e-6) { x = cx + ((x - cx) / d) * r; z = cz + ((z - cz) / d) * r; pushed = true; }
      }
      if (!pushed) break;
    }
    return [x, z];
  }

  // distance along a ray before hitting a wall (for the camera)
  ray(x, z, dx, dz, maxd) {
    let best = maxd;
    const ex = x + dx * maxd, ez = z + dz * maxd;
    const cand = this.near((x + ex) / 2, (z + ez) / 2, maxd / 2 + 1);
    for (const i of cand) {
      const [x1, z1, x2, z2] = this.walls[i];
      const t = segHit(x, z, ex, ez, x1, z1, x2, z2);
      if (t !== null && t * maxd < best) best = t * maxd;
    }
    return best;
  }
}

export function closest(px, pz, x1, z1, x2, z2) {
  const vx = x2 - x1, vz = z2 - z1;
  const L = vx * vx + vz * vz;
  let t = L > 0 ? ((px - x1) * vx + (pz - z1) * vz) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return [x1 + t * vx, z1 + t * vz];
}

function segHit(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den;
  const u = ((cx - ax) * rz - (cz - az) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

export function pointInRing(x, z, ring) {
  let n = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) n = !n;
  }
  return n;
}

// Shortest walking distance from every node to a goal node, along the network.
// underground: only nodes below street level (Astra's rule: don't go outside).
export function distancesTo(world, goal, { underground = true } = {}) {
  const n = world.nodes.length;
  const adj = Array.from({ length: n }, () => []);
  for (const [a, b, t, d] of world.links) {
    const w = t === 4 ? 8 : d; // lifts carry no length in the data
    adj[a].push([b, w]);
    adj[b].push([a, w]);
  }
  const dist = new Float64Array(n).fill(Infinity);
  const next = new Int32Array(n).fill(-1);
  dist[goal] = 0;
  const heap = new MinHeap();
  heap.push(0, goal);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > dist[u]) continue;
    for (const [v, w] of adj[u]) {
      if (underground && world.nodes[v][2] >= 0) continue;
      if (d + w < dist[v]) {
        dist[v] = d + w;
        next[v] = u;
        heap.push(dist[v], v);
      }
    }
  }
  return { dist, next };
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.k, v = this.v;
    const top = [k[0], v[0]];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      k[0] = lk; v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

export function nearestNode(world, x, z, o, maxd = Infinity) {
  let best = -1, bd = maxd;
  world.nodes.forEach(([nx, nz, no], i) => {
    if (no !== o) return;
    const d = Math.hypot(nx - x, nz - z);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
