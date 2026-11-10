import * as THREE from 'three';
import { PS1Renderer, makeMaterial, shared } from './ps1.js';
import { World, FH, CH } from './world.js';
import { FloorNav, floorKey, distancesTo, nearestNode } from './nav.js';
import { Input } from './input.js';
import { LEVELS } from './levels.js';
import { makeKitten } from './kitten.js';
import { People, Store, places } from './people.js';
import { Quilt, parseAddress } from './patches.js';
import { tonight, describe, longDate } from './sky.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const floorName = (o) => (o < 0 ? `B${-o}F` : o === 0 ? 'Street' : `${o}F`);
const RADIUS = 0.12; // a kitten fits through gaps people don't
const KIND_NAME = { 4: 'Lift', 5: 'Escalator', 6: 'Stairs', 7: 'Slope' };
const COLD = { fog: new THREE.Color(0x1b2430), range: new THREE.Vector2(1, 14) };
const WARM = { fog: shared.uFog.value.clone(), range: shared.uFogRange.value.clone() };

// goal marker: a soft column of light at the gate
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.5, 0.5, CH, 6, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x9fe3c8, transparent: true, opacity: 0.35, depthWrite: false }),
);

// ---- the level: its station's data, the goal gate, the route there, the floor connectors
let data, world, level, goal, route;
const ends = new Map();
const navs = new Map();
const cache = new Map();
const nav = (o) => {
  const k = floorKey(o);
  if (!navs.has(k)) navs.set(k, new FloorNav(data.floors[k] || { walls: [], outdoor: [] }));
  return navs.get(k);
};

async function loadLevel(i) {
  const L = LEVELS[i];
  if (!cache.has(L.station)) cache.set(L.station, fetch(`data/${L.station}.json`).then((r) => r.json()));
  const d = await cache.get(L.station);
  if (world) for (const g of world.groups.values()) if (g.parent) g.parent.remove(g);
  if (!world || data !== d) { data = d; world = new World(d); navs.clear(); }
  level = L;
  if (L.goal.at) goal = { x: L.goal.at.x, z: L.goal.at.z, o: L.goal.o };   // a place, not a named gate
  else {
    const gs = data.gates.filter((g) => g.n === L.goal.gate && g.o === L.goal.o);
    goal = {
      x: gs.reduce((s, g) => s + (g.a[0] + g.b[0]) / 2, 0) / gs.length,
      z: gs.reduce((s, g) => s + (g.a[1] + g.b[1]) / 2, 0) / gs.length,
      o: L.goal.o,
    };
  }
  goal.name = L.goal.name || L.goal.gate;
  route = distancesTo(data, nearestNode(data, goal.x, goal.z, goal.o), { underground: true });
  ends.clear();
  data.conns.forEach((c, ci) => {
    for (const [here, there, fwd] of [[c.a, c.b, true], [c.b, c.a, false]]) {
      const [x, z, o] = data.nodes[here];
      const k = floorKey(o);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push({ x, z, o, to: data.nodes[there][2], conn: ci, fwd, t: c.t });
    }
  });
  beacon.position.set(goal.x, goal.o * FH + CH / 2, goal.z);
}

let levelIndex = Math.max(0, Math.min(LEVELS.length - 1, Number(params.get('level') ?? 0)));
await loadLevel(levelIndex);

// ---- scene
const canvas = $('c');
const ps1 = new PS1Renderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.03, 80);

const kitten = makeKitten();
scene.add(kitten.root);

scene.add(beacon);

// ---- state
const input = new Input(canvas);
const store = new Store((() => { try { return localStorage; } catch { return null; } })());
const today = new Date().toISOString().slice(0, 10);   // lost things and lost people change daily
let people = null, quilt = null, sky = null, visited = null, placeList = [], lastPlaceCheck = 0, sayUntil = 0;
const S = {
  state: 'title', x: 0, z: 0, o: -2, yaw: 0, pitch: 0.3, head: 0, phase: 0,
  ride: null, outside: false, surfaced: 0, walked: 0, t0: null, t: 0, done: false, fps: 0, speed: 0,
};

function spawn() {
  const sp = {
    x: Number(params.get('x') ?? level.start.x), z: Number(params.get('z') ?? level.start.z),
    o: Number(params.get('o') ?? level.start.o), yaw: Number(params.get('yaw') ?? level.start.yaw),
  };
  if (!params.has('yaw')) sp.yaw = routeYaw(sp.x, sp.z, sp.o) ?? sp.yaw;
  Object.assign(S, { x: sp.x, z: sp.z, o: sp.o, yaw: sp.yaw, head: sp.yaw + Math.PI, ride: null, outside: false,
    surfaced: 0, walked: 0, t0: null, t: 0, done: false });
  $('done').hidden = true;
  people?.dispose();
  // tonight's sky seeds everything: a horoscope cast for Tokyo at midnight on a random date (or ?chart=YYYY-MM-DD)
  sky = tonight(params.get('day') || today, params.get('chart'));
  people = new People(scene, data, level, route, sky, store);
  quilt?.dispose();
  // ?patches=id@YYYY-MM-DD,... replays exact patches: a chart makes the patch
  const pick = params.get('patches') ? params.get('patches').split(',').filter((a) => parseAddress(a)) : null;
  quilt = new Quilt(scene, data, level, route, sky, store, people, nav, pick && pick.length ? pick : null);
  visited = store.visited(level.region || level.station);
  placeList = places(data);
  applyRewards();
  showFloors();
  say([...describe(sky), ...quilt.spread()]);
}

// a portal cast with the wand: step out somewhere else, maybe on another floor
function teleport(j) {
  Object.assign(S, { x: j.x, z: j.z, o: j.o, ride: null, outside: false });
  if (j.yaw !== undefined) { S.yaw = j.yaw + Math.PI; S.head = j.yaw; }
  showFloors();
}

// what owners gave back changes how you play
function applyRewards() {
  const lantern = store.has('lantern');
  WARM.range.set(lantern ? 5 : 3, lantern ? 62 : 38);
  $('map').hidden = !store.has('map');
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function say(lines) {
  if (!lines.length) return;
  $('say').innerHTML = lines.map(esc).join('<br>');
  $('say').hidden = false;
  sayUntil = performance.now() + 2600 + 1700 * lines.length;
}

// face the way the route goes, a few nodes ahead
function routeYaw(x, z, o) {
  let k = nearestNode(data, x, z, o, 40);
  if (k < 0) return null;
  for (let i = 0; i < 6 && route.next[k] >= 0 && data.nodes[route.next[k]][2] === o; i++) k = route.next[k];
  const dx = data.nodes[k][0] - x, dz = data.nodes[k][1] - z;
  if (Math.hypot(dx, dz) < 0.5) return null;
  return Math.atan2(-dx, -dz);
}

function showFloors() {
  const want = new Set([floorKey(S.o)]);
  if (S.ride) want.add(floorKey(S.ride.to));
  for (const k of Object.keys(data.floors)) {
    const g = world.floor(Number(k));
    if (want.has(k)) { if (!g.parent) scene.add(g); } else if (g.parent) scene.remove(g);
  }
}

function nearestEnd() {
  const list = ends.get(floorKey(S.o)) || [];
  let best = null, bd = 1.7;
  for (const e of list) {
    const d = Math.hypot(e.x - S.x, e.z - S.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function startRide(e) {
  const c = data.conns[e.conn];
  const pts = e.fwd ? c.p : [...c.p].reverse();
  const P = pts.map(([x, z, o]) => new THREE.Vector3(x, o * FH, z));
  let len = 0;
  const cum = [0];
  for (let i = 1; i < P.length; i++) { len += P[i].distanceTo(P[i - 1]); cum.push(len); }
  const speed = c.t === 5 ? 1.8 : c.t === 4 ? 0 : 3; // kittens bound up stairs
  S.ride = { P, cum, len, t: 0, dur: c.t === 4 ? 3.2 : Math.max(1.2, len / speed), to: e.to, kind: c.t, from: S.o };
  showFloors();
}

function endRide() {
  const r = S.ride;
  const last = r.P[r.P.length - 1];
  S.x = last.x; S.z = last.z; S.o = r.to;
  S.ride = null;
  const n = nav(S.o);
  const out = S.o >= 0 && (!n.inside(S.x, S.z) || n.isOutdoor(S.x, S.z));
  if (out && !S.outside) S.surfaced++;
  S.outside = out;
  showFloors();
}

// ---- loop
let last = performance.now(), acc = 0, frames = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frames++; acc += dt;
  if (acc > 0.5) { S.fps = Math.round(frames / acc); frames = 0; acc = 0; }
  input.poll();

  if (S.state === 'title') {
    if ((input.any || input.act) && !titleKeyUsed) start();
    titleKeyUsed = false;
  } else {
    if (input.restart) spawn();
    S.yaw -= input.look[0];
    S.pitch = Math.max(0.05, Math.min(1.0, S.pitch + input.look[1]));
    update(dt);
  }
  draw(now / 1000, dt);
  input.endFrame();
  requestAnimationFrame(frame);
}

function update(dt) {
  if (S.done) { if (input.act) spawn(); return; }
  if (S.ride) {
    const r = S.ride;
    r.t += dt;
    const f = Math.min(1, r.t / r.dur);
    if (r.kind === 4) {
      const a = r.P[0], b = r.P[r.P.length - 1];
      const p = a.clone().lerp(b, f);
      S.x = p.x; S.z = p.z; S.rideY = p.y;
    } else {
      const d = f * r.len;
      let i = 1;
      while (i < r.cum.length - 1 && r.cum[i] < d) i++;
      const k = (d - r.cum[i - 1]) / Math.max(1e-6, r.cum[i] - r.cum[i - 1]);
      const p = r.P[i - 1].clone().lerp(r.P[i], k);
      if (Math.hypot(r.P[i].x - r.P[i - 1].x, r.P[i].z - r.P[i - 1].z) > 0.05)
        S.head = Math.atan2(r.P[i].x - r.P[i - 1].x, r.P[i].z - r.P[i - 1].z);
      S.x = p.x; S.z = p.z; S.rideY = p.y;
      S.phase += dt * (r.kind === 6 ? 9 : 0);
    }
    if (f >= 1) endRide();
    return;
  }

  const [mx, my] = input.move;
  const fx = -Math.sin(S.yaw), fz = -Math.cos(S.yaw);
  const vx = (-fz * mx + fx * my), vz = (fx * mx + fz * my);
  const speed = input.run ? (store.has('boots') ? 8 : 6.5) : 2.4;   // a trot, and zoomies (faster in boots)
  if (Math.hypot(vx, vz) > 0.05) {
    if (S.t0 === null) S.t0 = performance.now();
    const n = nav(S.o);
    let nx, nz;
    if (S.outside) { nx = S.x + vx * speed * dt * 0.35; nz = S.z + vz * speed * dt * 0.35; } // cold, slow, nowhere to go
    else [nx, nz] = n.move(S.x, S.z, vx * speed * dt, vz * speed * dt, RADIUS);
    const moved = Math.hypot(nx - S.x, nz - S.z);
    S.walked += moved;
    S.speed += (moved / Math.max(dt, 1e-3) - S.speed) * Math.min(1, dt * 12); // real ground speed: legs stop at walls
    S.x = nx; S.z = nz;
    S.head = Math.atan2(vx, vz);
  } else S.speed += (0 - S.speed) * Math.min(1, dt * 12);
  if (S.outside) {
    // you can only go back the way you came: the street isn't part of the dungeon
    const e = nearestEnd();
    if (!e || Math.hypot(e.x - S.x, e.z - S.z) > 4) {
      const all = ends.get(floorKey(S.o)) || [];
      const back = all.reduce((b, q) => (!b || Math.hypot(q.x - S.x, q.z - S.z) < Math.hypot(b.x - S.x, b.z - S.z) ? q : b), null);
      if (back) { S.x += (back.x - S.x) * 0.08; S.z += (back.z - S.z) * 0.08; }
    }
  }
  if (input.act) {
    const pn = people?.nearest(S) || quilt?.nearest(S);
    if (pn) {
      say(pn.from === 'quilt' ? quilt.act(pn, S) : people.act(pn, visited.set));
      if (quilt.jump) { teleport(quilt.jump); quilt.jump = null; }
      applyRewards();
    }
    else { const e = nearestEnd(); if (e) startRide(e); }
  }
  // places you've been: a lost person can only be helped to somewhere you know
  if (performance.now() - lastPlaceCheck > 250) {
    lastPlaceCheck = performance.now();
    // the quilt's patches: rooms you walk into, and the run kernel's clock
    const ql = quilt ? quilt.tick(S) : [];
    if (ql.length) say(ql);
    for (const p of placeList) {
      if (p.o === S.o && Math.hypot(p.x - S.x, p.z - S.z) < 8 && visited.add(p.key) && performance.now() > sayUntil) say([`New place: ${p.name}`]);
    }
  }
  if (S.t0 !== null) S.t = (performance.now() - S.t0) / 1000;
  if (S.o === goal.o && Math.hypot(S.x - goal.x, S.z - goal.z) < level.goal.radius) finish();
}

function finish() {
  S.done = true;
  const n = data.nodes;
  const startNode = nearestNode(data, level.start.x, level.start.z, level.start.o);
  const mapDist = Math.round(route.dist[startNode]);
  const mm = Math.floor(S.t / 60), ss = String(Math.floor(S.t % 60)).padStart(2, '0');
  $('done').hidden = false;
  $('done-text').innerHTML =
    `Arrived at <b>${goal.name}</b>.<br>` +
    `The map says ${mapDist.toLocaleString()} m without surfacing. You walked ${Math.round(S.walked).toLocaleString()} m in ${mm}:${ss}.<br>` +
    (S.surfaced ? `You went outside ${S.surfaced} time${S.surfaced > 1 ? 's' : ''}. It was cold.` : 'You never went outside.') +
    (people.returned ? `<br>You returned ${people.returned} thing${people.returned > 1 ? 's' : ''} to ${people.returned > 1 ? 'their owners' : 'its owner'}.` : '') +
    (people.helped ? `<br>You helped ${people.helped} ${people.helped > 1 ? 'people' : 'person'} find their way.` : '') +
    (quilt.walked.length ? `<br>You walked the whole of ${quilt.walked.map(esc).join(', ')}.` : '') +
    `<br>Tonight's sky was cast for ${esc(longDate(sky.date))}.` +
    (quilt.patches.length ? `<br><a href="?level=${levelIndex}&amp;play&amp;patches=${encodeURIComponent(quilt.addresses().join(','))}">Replay tonight's patches</a>: ${quilt.addresses().map(esc).join(' · ')}` : '');
  void n;
}

function draw(time, dt) {
  const baseY = S.ride ? S.rideY : S.o * FH;
  kitten.root.position.set(S.x, baseY, S.z);
  kitten.root.rotation.y = S.head;
  kitten.animate(dt, S.ride ? 0 : S.speed, S.ride ? { 4: 'lift', 5: 'escalator', 6: 'stairs' }[S.ride.kind] : null);
  beacon.material.opacity = 0.25 + 0.12 * Math.sin(time * 2.2);

  // camera: behind and above, pulled in by walls, kept under the ceiling
  // camera: low and close, so the station towers; aim a little above the kitten so the world fills the frame
  const target = new THREE.Vector3(S.x, baseY + 0.22, S.z);
  const d0 = 1.5;
  const dx = Math.sin(S.yaw), dz = Math.cos(S.yaw);
  // the camera keeps its distance and walls in the way turn see-through (ps1.js), so corners stay playable
  const dh = Math.cos(S.pitch) * d0;
  let cy = target.y + Math.sin(S.pitch) * d0;
  if (!S.outside) cy = Math.min(cy, (S.ride ? Math.max(S.o, S.ride.to) : S.o) * FH + CH - 0.2);
  const cx = S.x + dx * dh, cz = S.z + dz * dh;
  camera.position.set(cx, cy, cz);
  camera.lookAt(target.x - dx * 0.6, target.y + 0.32, target.z - dz * 0.6);
  shared.uCam.value.copy(camera.position);
  shared.uFocus.value.set(S.x, baseY + 0.16, S.z);

  // draw only chunks the fog hasn't swallowed
  const reach = shared.uFogRange.value.y + 26;
  for (const g of world.groups.values()) {
    if (!g.parent) continue;
    for (const m of g.children) {
      const b = m.userData.cull;
      if (b) m.visible = camera.position.distanceTo(b.center) - b.radius < reach;
    }
  }

  // fog: fluorescent haze below ground, cold dark outside
  // inside a patch you're in its night: its season's light
  const env = S.outside ? COLD : quilt?.zone ? { fog: quilt.zone.warp.fog, range: WARM.range } : WARM;
  shared.uFog.value.lerp(env.fog, 0.08);
  shared.uFogRange.value.lerp(env.range, 0.08);

  people?.update(dt, S, time);
  quilt?.update(dt, S, time);
  ps1.render(scene, camera);
  hud();
}

// the folded station map (a reward): walls within 45 m, turned so that ahead is up
let mapT = 0;
function drawMap() {
  const c = $('map'), g = c.getContext('2d'), W = c.width, R = 45, k = W / (2 * R);
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  const P = (x, z) => { const dx = x - S.x, dz = z - S.z; return [W / 2 + (dx * cy - dz * sy) * k, W / 2 + (dx * sy + dz * cy) * k]; };
  g.clearRect(0, 0, W, W);
  g.fillStyle = 'rgba(10,12,14,0.72)'; g.fillRect(0, 0, W, W);
  const n = nav(S.o);
  g.strokeStyle = '#cfc8b4'; g.lineWidth = 1; g.beginPath();
  for (const i of n.near(S.x, S.z, R)) {
    const [x1, z1, x2, z2, kind] = n.walls[i];
    if (kind === 'col') continue;
    const [a, b] = P(x1, z1), [c2, d] = P(x2, z2);
    g.moveTo(a, b); g.lineTo(c2, d);
  }
  g.stroke();
  const dot = (x, z, col, r) => { let [a, b] = P(x, z); a = Math.max(r, Math.min(W - r, a)); b = Math.max(r, Math.min(W - r, b)); g.fillStyle = col; g.fillRect(a - r, b - r, 2 * r, 2 * r); };
  if (people?.counter && people.counter.o === S.o) dot(people.counter.x, people.counter.z, '#5aa0e0', 3);
  for (const q of quilt?.patches || []) {
    if (q.heart.o === S.o) dot(q.heart.x, q.heart.z, '#f0ece0', 2);
    if (q.portal && q.portal.o === S.o) dot(q.portal.x, q.portal.z, '#c8a8ff', 2);
  }
  if (quilt?.timer && quilt.timer.gate.o === S.o) dot(quilt.timer.gate.x, quilt.timer.gate.z, '#f2c81c', 3);
  if (goal.o === S.o) dot(goal.x, goal.z, '#9fe3c8', 3);
  g.fillStyle = '#f2c81c'; g.beginPath(); g.moveTo(W / 2, W / 2 - 5); g.lineTo(W / 2 - 4, W / 2 + 4); g.lineTo(W / 2 + 4, W / 2 + 4); g.fill();
}

function hud() {
  if (S.state !== 'play') return;
  const pn = !S.ride && !S.done && (people?.nearest(S) || quilt?.nearest(S));
  const e = !S.ride && !pn && nearestEnd();
  let prompt = '';
  if (S.done) prompt = '';
  else if (S.ride) prompt = `${KIND_NAME[S.ride.kind]} to ${floorName(S.ride.to)}…`;
  else if (pn) prompt = `◆ ${pn.prompt}`;
  else if (e) prompt = `${e.to > S.o ? '▲' : '▼'} ${KIND_NAME[e.t]} to ${floorName(e.to)}`;
  else if (quilt?.timer) prompt = quilt.clock(S);
  $('prompt').textContent = prompt;
  $('act').hidden = !((e || pn) && input.mode === 'touch');
  $('act').textContent = pn ? '◆' : '▲▼';
  $('bag').textContent = people?.bag.length ? `bag × ${people.bag.length}` : '';
  if (!$('say').hidden && performance.now() > sayUntil) $('say').hidden = true;
  if (!$('map').hidden && performance.now() - mapT > 120) { mapT = performance.now(); drawMap(); }

  // where am I: floor + nearest named exit's facility
  let fac = '';
  let bd = 70;
  for (const x of data.exits) if (x.o === S.o) { const d = Math.hypot(x.x - S.x, x.z - S.z); if (d < bd) { bd = d; fac = x.fac; } }
  $('where').textContent = `${floorName(S.o)}${fac ? ' · ' + fac : ''}${S.outside ? ' · outside' : ''}${quilt?.zone ? ' · ' + longDate(quilt.zone.date) : ''}`;
  $('cold').hidden = !S.outside;

  // how far: along the network, never surfacing
  const ni = nearestNode(data, S.x, S.z, S.o, 40);
  let dist = '—', arrow = null;
  if (ni >= 0 && Number.isFinite(route.dist[ni])) {
    dist = Math.round(route.dist[ni] + Math.hypot(data.nodes[ni][0] - S.x, data.nodes[ni][1] - S.z)).toLocaleString() + ' m';
    // look a few nodes ahead for a steady heading
    let k = ni;
    for (let i = 0; i < 4 && route.next[k] >= 0 && data.nodes[route.next[k]][2] === S.o; i++) k = route.next[k];
    if (k !== ni) arrow = Math.atan2(data.nodes[k][0] - S.x, data.nodes[k][1] - S.z);
  }
  const mm = Math.floor(S.t / 60), ss = String(Math.floor(S.t % 60)).padStart(2, '0');
  $('goal').textContent = `${goal.name} · ${dist} · ${mm}:${ss}`;
  const ar = $('arrow');
  ar.hidden = arrow === null;
  if (arrow !== null) ar.style.transform = `rotate(${(-(arrow - S.yaw) + Math.PI) % (Math.PI * 2)}rad)`;
  if (params.has('fps')) $('fps').textContent = `${S.fps} fps · ${shared.uRes.value.x}×${shared.uRes.value.y}`;
}

let starting = false;
async function start(i = levelIndex) {
  if (S.state === 'play' || starting) return;
  starting = true;
  levelIndex = i;
  if (LEVELS[i] !== level) {
    $('loading').hidden = false;
    $('loading').textContent = `${LEVELS[i].place} · loading the dungeon…`;
    await loadLevel(i);
    $('loading').hidden = true;
  }
  S.state = 'play';
  starting = false;
  $('title').hidden = true;
  $('hud').hidden = false;
  spawn();
  updateFsButton();
}

// level cards on the title
function renderLevels() {
  $('levels').innerHTML = LEVELS.map((L, i) =>
    `<button class="level${i === levelIndex ? ' on' : ''}" data-i="${i}"><b>Level ${i} · ${L.place}</b><span>${L.title}</span><em>${L.length}</em></button>`).join('');
}
renderLevels();
let titleKeyUsed = false;
addEventListener('keydown', (e) => {
  if (S.state !== 'title') return;
  const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  const digit = /^Digit\d$/.test(e.code) ? Number(e.code.slice(5)) : NaN;
  if (step || LEVELS[digit]) {
    levelIndex = step ? (levelIndex + step + LEVELS.length) % LEVELS.length : digit;
    renderLevels();
    titleKeyUsed = true;
  }
});

// Fullscreen has to be asked for inside a user gesture (a tap or click handler), never from the render loop.
function goFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
    .catch(() => {});
}
function updateFsButton() {
  const can = !!document.documentElement.requestFullscreen;
  $('fs').hidden = !(can && input.mode === 'touch' && !document.fullscreenElement && S.state === 'play');
}
document.addEventListener('fullscreenchange', updateFsButton);

// The title card sits on top of the canvas, so it takes the tap itself (the canvas never sees it).
$('title').addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') { input.mode = 'touch'; goFullscreen(); }
  const card = e.target.closest('.level');
  start(card ? Number(card.dataset.i) : levelIndex);
});
$('fs').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); goFullscreen(); });
$('act').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); input.pressAct(); });
$('done').addEventListener('click', (e) => { if (!e.target.closest('a')) spawn(); });   // the replay link is a link

function resize() { ps1.resize(innerWidth, innerHeight, camera); }
addEventListener('resize', resize);
resize();
if (params.has('nosnap')) shared.uSnap.value = 0;
if (params.has('play')) start();
$('loading').hidden = true;
requestAnimationFrame(frame);

// for tests and curious people
window.__game = { S, get people() { return people; }, get quilt() { return quilt; }, get sky() { return sky; }, store, get visited() { return visited; }, get data() { return data; }, get goal() { return goal; }, get route() { return route; }, get level() { return level; }, start, spawn, camera, shared, nav };
