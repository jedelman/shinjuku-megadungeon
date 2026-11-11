// Yokai in the fog, and meeting them.
// Jason (2026-11-10): "so the encounters feel creepy - fog and no people, and some kind of yokai. We should also add
// some kind of cute combat a la Undertale - dodge, pounce, and sass are your main actions."
//
// One yokai waits in each fog pocket, its kind drawn from tonight's chart: a kasa-obake (an old umbrella come alive), a
// chōchin-obake (an old paper lantern) or a noppera-bō (the faceless one, after Lafcadio Hearn's "Mujina", set on a slope
// in Akasaka). All three are public-domain folklore; the looks here are blocky and the game's own, not any modern
// franchise's design. Walk up and it comes to meet you; the fight itself is in fight.js. Win any way and the fog lifts,
// the crowd comes back, and you get a field note. Lose your nerve and you bolt back out of the fog, and can try again.
//
// Every field-note fact has a source URL (tests/yokai.test.js enforces it). Checked 2026-11-10.
import * as THREE from 'three';
import { FH } from './world.js';
import { B, S, C, merged } from './blocks.js';
import { rng, hash } from './seed.js';
import { skySeed } from './sky.js';
import { Fight, KINDS, KIND_IDS, W, H, PAW, NERVE, NEED } from './fight.js';
import { CORE, EDGE } from './fog.js';

const TSUKUMOGAMI = 'https://rmda.kulib.kyoto-u.ac.jp/en/item/rb00013599/explanation/otogi_05';
export const YOKAI = {
  kasa: {
    ja: '唐傘お化け', en: 'the kasa-obake',
    facts: [
      'An old oiled-paper umbrella come alive: one big eye, a long tongue, and one or two legs it hops about on. Not very fearsome, as yokai go.',
      'It\'s a tsukumogami. In an old tale, tools more than a hundred years old get souls of their own.',
      'Its look comes from Edo-period prints and toys more than from any one legend.',
    ],
    sources: ['https://yokai.com/karakasakozou/', TSUKUMOGAMI, 'https://yokai.jp/en/yokai/karakasa-kozou'],
  },
  chochin: {
    ja: '提灯お化け', en: 'the chōchin-obake',
    facts: [
      'A paper lantern that grows very old may become one: its paper splits along a rib into a gaping mouth, tongue lolling.',
      'One of Japan\'s best-known tsukumogami, and not one that threatens anybody\'s life.',
      'In the old tale of the tsukumogami, tools thrown out at the year-end soot-sweeping get souls, and at midnight they march east down Ichijō-dōri in Kyoto.',
    ],
    sources: ['https://yokai.com/chouchinobake/', 'https://yokai.jp/en/yokai/chochin-obake', TSUKUMOGAMI],
  },
  noppera: {
    ja: 'のっぺらぼう', en: 'the noppera-bō',
    facts: [
      'In Lafcadio Hearn\'s "Mujina" (Kwaidan, 1904), people with no faces haunt Kii-no-kuni-zaka, a slope on the Akasaka Road in Tokyo. Hearn blames a mujina that used to walk there.',
      'The story\'s last fright is a soba seller, who strokes his own face until it becomes "like unto an Egg".',
      'A blank face is a favourite disguise of mischievous animals: foxes, tanuki, and especially mujina.',
      'The slope is still there, climbing from Akasaka-mitsuke toward Yotsuya. Akasaka\'s name is said to come from it.',
    ],
    sources: ['https://www.gutenberg.org/cache/epub/1210/pg1210.txt', 'https://yokai.com/nopperabou/',
      'https://www.city.minato.tokyo.jp/kouhou/kuse/gaiyo/chimerekishi/index-akasaka.html'],
  },
};

// which yokai waits in which fog pocket tonight: each kind once before any repeats
export function haunt(pockets, sky, levelId) {
  const r = rng(skySeed(sky, `${levelId}|yokai`));
  const kinds = [...KIND_IDS];
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  return pockets.map((p, i) => ({ pocket: p, kind: kinds[i % kinds.length] }));
}

// ---------------------------------------------------------------------------------------------- the models
function model(kind) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const out = { g, body };
  if (kind === 'kasa') {
    body.add(merged([
      C(0.24, 0.58, 0x8a3a5a, 0, 0.36, 0, 10),                          // the canopy, oiled paper, half folded
      C(0.245, 0.06, 0xe8d8b0, 0, 0.36, 0, 10),                         // a pale band round its hem
      S(0.03, 0x3a2a20, 0, 0.95, 0),                                    // the top
      S(0.07, 0xf4f0e8, 0, 0.6, 0.135, 1, 1, 0.7),                      // one big eye
      S(0.034, 0x141414, 0, 0.6, 0.18),
      B(0.055, 0.14, 0.022, 0xd04050, 0, 0.44, 0.19), S(0.03, 0xd04050, 0, 0.37, 0.19, 1, 0.7, 0.5),   // the tongue
      B(0.04, 0.36, 0.04, 0x6a4a2a, 0, 0.18, 0),                        // one leg (the handle)
      B(0.09, 0.03, 0.16, 0x9a7a4a, 0, 0.015, 0.02),                    // one geta
    ], true));
  } else if (kind === 'chochin') {
    const P = [S(0.2, 0xf2e2c0, 0, 0, 0, 1, 1.25, 1)];
    for (const y of [-0.17, -0.09, 0, 0.09, 0.17]) P.push(S(0.205 * Math.sqrt(1 - (y / 0.25) ** 2), 0x6a5040, 0, y, 0, 1, 0.05, 1));   // ribs
    P.push(B(0.17, 0.05, 0.17, 0x1a1a1a, 0, 0.26, 0), B(0.17, 0.05, 0.17, 0x1a1a1a, 0, -0.26, 0));   // the caps
    P.push(B(0.3, 0.045, 0.05, 0x2a1010, 0, -0.06, 0.18));                                           // split open: the mouth
    P.push(B(0.07, 0.2, 0.022, 0xd04050, 0, -0.17, 0.205), S(0.036, 0xd04050, 0, -0.27, 0.205, 1, 0.7, 0.5));   // the tongue
    P.push(S(0.036, 0x141414, -0.07, 0.07, 0.19), S(0.036, 0x141414, 0.07, 0.07, 0.19));             // eyes
    P.push(B(0.012, 0.9, 0.012, 0x2a2420, 0, 0.73, 0));                                              // its string, up into the fog
    const m = merged(P, true, 0.7);   // it glows through the fog like a lit sign
    m.position.y = 1.0;
    body.add(m);
  } else {
    const coat = 0x3a3a40, skin = 0xf0d0b8;
    const who = merged([
      B(0.48, 0.7, 0.3, coat, 0, 1.15, 0),                              // a coat, like anyone's
      B(0.15, 0.8, 0.15, 0x22252c, -0.11, 0.4, 0), B(0.15, 0.8, 0.15, 0x22252c, 0.11, 0.4, 0),
      B(0.11, 0.6, 0.11, coat, -0.3, 1.18, 0), B(0.11, 0.6, 0.11, coat, 0.3, 1.18, 0),
      S(0.05, skin, -0.3, 0.86, 0), S(0.05, skin, 0.3, 0.86, 0),
      S(0.17, skin, 0, 1.68, 0.01),                                     // the head: no eyes, no nose, no mouth
      S(0.176, 0x1a1612, 0, 1.74, -0.035, 1, 0.66, 1),                  // hair, so from behind it's anyone
    ], true);
    body.add(who);
    // what was under the coat: a mujina
    const muj = merged([
      S(0.13, 0x7a6a58, 0, 0.15, 0, 0.9, 0.8, 1.3), S(0.085, 0x8a7a68, 0, 0.22, 0.17),
      B(0.03, 0.02, 0.1, 0xf0ece0, 0, 0.3, 0.17), B(0.15, 0.04, 0.05, 0x2a2420, 0, 0.23, 0.23),
      S(0.022, 0x2a2420, 0, 0.2, 0.26), S(0.05, 0x5a4a3c, 0, 0.14, -0.2, 0.8, 0.8, 1.3),
      B(0.04, 0.08, 0.04, 0x241e1a, -0.07, 0.04, 0.1), B(0.04, 0.08, 0.04, 0x241e1a, 0.07, 0.04, 0.1),
      B(0.04, 0.08, 0.04, 0x241e1a, -0.07, 0.04, -0.1), B(0.04, 0.08, 0.04, 0x241e1a, 0.07, 0.04, -0.1),
    ], true);
    muj.visible = false;
    g.add(muj);
    Object.assign(out, { who, muj });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- the arena
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LABEL = { dodge: 'Dodge', pounce: 'Pounce', sass: 'Sass' };
const ACTIONS = ['dodge', 'pounce', 'sass'];

export class Encounters {
  constructor(scene, fog, sky, level, store, sound, nav) {
    this.scene = scene; this.store = store; this.sound = sound; this.nav = nav; this.sky = sky; this.level = level;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.list = haunt(fog, sky, level.id).map(({ pocket, kind }) => {
      const key = `${sky.date}|${level.id}|fog|${pocket.id}`;
      if (store.found(key)) pocket.cleared = true;
      const m = model(kind);
      m.g.position.set(pocket.x, pocket.o * FH, pocket.z);
      m.g.visible = false;
      this.root.add(m.g);
      return { pocket, kind, key, m, x: pocket.x, z: pocket.z, o: pocket.o, tries: 0, gone: !!pocket.cleared, face: 0 };
    });
    this.fight = null; this.cur = null; this.cool = null;
    this.met = 0; this.top = 0.55;
    this.sel = 0; this.pick = null; this.prev = { x: 0, y: 0 };
    const $ = (id) => document.getElementById(id);
    this.dom = { box: $('meet'), name: $('meet-name'), stat: $('meet-stat'), text: $('meet-text'), arena: $('arena'), menu: $('meet-menu') };
    this.drag = null;
    if (this.dom.arena) {
      this.g2 = this.dom.arena.getContext('2d');
      const at = (e) => { const b = this.dom.arena.getBoundingClientRect(); return { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H }; };
      this.onDown = (e) => { e.preventDefault(); e.stopPropagation(); const p = at(e); this.drag = { x0: p.x, y0: p.y, px: this.fight?.paw.x ?? 0, py: this.fight?.paw.y ?? 0, x: p.x, y: p.y }; };
      this.onMove = (e) => { if (!this.drag) return; const p = at(e); this.drag.x = p.x; this.drag.y = p.y; };
      this.onUp = () => { this.drag = null; };
      this.dom.arena.addEventListener('pointerdown', this.onDown);
      addEventListener('pointermove', this.onMove);
      addEventListener('pointerup', this.onUp);
      this.onMenu = (e) => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); e.stopPropagation(); this.pick = Number(b.dataset.i); };
      this.dom.menu.addEventListener('pointerdown', this.onMenu);
      this.onBox = (e) => { if (e.target.closest('button') || e.target === this.dom.arena) return; e.preventDefault(); e.stopPropagation(); this.tapped = true; };
      this.dom.box.addEventListener('pointerdown', this.onBox);
    }
  }

  get active() { return !!this.fight; }

  dispose() {
    this.scene.remove(this.root);
    this.close();
    if (this.dom.arena) {
      this.dom.arena.removeEventListener('pointerdown', this.onDown);
      removeEventListener('pointermove', this.onMove);
      removeEventListener('pointerup', this.onUp);
      this.dom.menu.removeEventListener('pointerdown', this.onMenu);
      this.dom.box.removeEventListener('pointerdown', this.onBox);
    }
  }

  // game logic, each frame (not while riding). Returns lines to say, and where to bolt to after losing your nerve.
  update(dt, S, input) {
    if (this.fight) return this.play(dt, S, input);
    for (const y of this.list) {
      if (y.gone || y.o !== S.o) continue;
      const d = Math.hypot(y.x - S.x, y.z - S.z);
      if (d < CORE + EDGE && !y.entry) y.entry = { x: S.x, z: S.z };
      if (d > CORE + EDGE + 2) { y.entry = null; if (this.cool === y) this.cool = null; }
      if (this.cool === y || d >= CORE) continue;
      // only if it can see you: never through a wall
      if (this.nav(y.o).ray(y.x, y.z, (S.x - y.x) / d, (S.z - y.z) / d, d) < d - 0.1) continue;
      // it comes to meet you, a little way from where it waits
      if (d > 2.4 && y.kind !== 'noppera') {   // (the noppera-bō waits, its back to you)
        const step = Math.min(0.55 * dt, d - 2.4), nx = y.x + ((S.x - y.x) / d) * step, nz = y.z + ((S.z - y.z) / d) * step;
        if (Math.hypot(nx - y.pocket.x, nz - y.pocket.z) < 4 && this.nav(y.o).inside(nx, nz)) { y.x = nx; y.z = nz; }
      }
      if (d < 2.6) { this.begin(y, S); return { lines: [] }; }
    }
    return { lines: [] };
  }

  begin(y, S) {
    y.tries++;
    this.cur = y;
    this.fight = new Fight(y.kind, hash(`${this.sky.date}|${this.level.id}|${y.pocket.id}|${y.tries}`));
    S.yaw = Math.atan2(-(y.x - S.x), -(y.z - S.z));
    S.head = Math.atan2(y.x - S.x, y.z - S.z);
    this.sel = 0; this.pick = null; this.tapped = false;
    this.dom.box.hidden = false;
    this.sound?.sting('meet');
    this.shown = null;
  }

  // choices: from the menu's buttons, the number keys, or a stick and the act button
  choice(input, n, vertical) {
    let got = input.digit >= 1 && input.digit <= n ? input.digit - 1 : null;
    const [mx, my] = input.move, v = vertical ? -my : mx;
    const was = vertical ? this.prev.y : this.prev.x;
    if (Math.abs(v) > 0.5 && Math.abs(was) <= 0.5) { this.sel = (this.sel + Math.sign(v) + n) % n; this.sound?.sting('select'); }
    if (input.act) got = this.sel;
    if (this.pick !== null) { got = this.pick; this.pick = null; }
    return got;
  }

  play(dt, S, input) {
    const f = this.fight, out = { lines: [] };
    const tap = this.tapped; this.tapped = false;
    if (f.phase === 'menu') {
      const i = this.choice(input, 3, false);
      if (i !== null) { f.choose(ACTIONS[i]); this.sel = 0; this.sound?.sting('select'); if (this.drag) this.drag = null; }
    } else if (f.phase === 'sass') {
      const i = this.choice(input, f.lines.length, true);
      if (i !== null) f.sass(i);
    } else if (f.phase === 'intro' || f.phase === 'react') {
      if (input.act || tap) f.skip();
    } else if ((f.phase === 'won' || f.phase === 'fled') && (input.act || tap || f.t > 4.5) && f.t > 0.6) {
      return this.end(S);
    }
    let move = input.move;
    if (f.phase === 'turn' && this.drag) {
      // drag on the arena: the paw follows your finger
      const tx = this.drag.px + (this.drag.x - this.drag.x0), ty = this.drag.py + (this.drag.y - this.drag.y0);
      const dx = tx - f.paw.x, dy = ty - f.paw.y, d = Math.hypot(dx, dy);
      move = d < 0.004 ? [0, 0] : [dx / d * Math.min(1, d / 0.03), -dy / d * Math.min(1, d / 0.03)];
    }
    for (const e of f.step(dt, move)) this.sound?.sting(e);
    if (f.phase === 'turn' && f.t < dt * 1.5) this.drag = null;
    this.prev = { x: input.move[0], y: -input.move[1] };
    return out;
  }

  end(S) {
    const f = this.fight, y = this.cur, out = { lines: [] };
    if (f.outcome === 'fled') {
      this.cool = y;
      out.flee = y.entry || { x: S.x + Math.sin(S.yaw) * 6, z: S.z + Math.cos(S.yaw) * 6 };
      out.lines = ['You don\'t stop till you\'re out of the fog.', 'It\'s still in there. Your nerve will come back.'];
      y.x = y.pocket.x; y.z = y.pocket.z;
    } else {
      this.met++;
      y.gone = true; y.pocket.cleared = true; y.leaving = { t: 0, how: f.outcome };
      this.store.yokai(y.kind, f.outcome, y.key);
      const Y = YOKAI[y.kind];
      out.lines = ['The fog lifts. Somewhere, people are talking again.'];
      if (this.store.note(`yokai:${y.kind}`)) out.lines.push(`New in your field notes: ${Y.ja}, ${Y.en}.`, ...Y.facts);
    }
    this.close();
    return out;
  }

  close() {
    this.fight = null; this.cur = null; this.drag = null;
    if (this.dom.box) this.dom.box.hidden = true;
  }

  // where the camera goes in a fight: behind the kitten, aimed so the yokai sits in the space above the arena panel
  // (top: where the panel starts, as a fraction of the screen's height; fov: the camera's vertical field of view)
  frame(S, baseY, top = 0.55, fov = 68) {
    const y = this.cur;
    const dx = S.x - y.x, dz = S.z - y.z, d = Math.hypot(dx, dz) || 1;
    this.top += ((Math.max(0.25, Math.min(0.9, top)) - (this.top ?? top)) || 0) * 0.15;
    const pos = [S.x + (dx / d) * 1.6, baseY + 0.6, S.z + (dz / d) * 1.6];
    const far = d + 1.6, mid = baseY + (y.kind === 'noppera' ? 0.9 : 0.5);
    const want = Math.atan((1 - this.top) * Math.tan((fov * Math.PI) / 360));   // halfway between the top and the panel
    const view = Math.atan2(mid - pos[1], far) - want;
    return { pos, look: [y.x, pos[1] + Math.tan(view) * far, y.z] };
  }

  // every frame: the yokai's idle life, the way they leave, and the arena
  draw(dt, S, time) {
    for (const y of this.list) {
      const m = y.m;
      const near = y.o === S.o && Math.hypot(y.x - S.x, y.z - S.z) < 24;
      if (y.gone && !y.leaving) { m.g.visible = false; continue; }
      m.g.visible = near;
      if (!near) continue;
      m.g.position.set(y.x, y.o * FH, y.z);
      // face the kitten once she's close (the noppera-bō keeps its back to you until the last moment)
      const want = Math.atan2(S.x - y.x, S.z - y.z);
      const d = Math.hypot(S.x - y.x, S.z - y.z);
      if (y.kind !== 'noppera' || d < 3.2 || this.cur === y) y.face += (((want - y.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * (y.kind === 'noppera' ? 2.5 : 4));
      else y.face = want + Math.PI;
      m.g.rotation.y = y.face;
      const hit = this.cur === y && this.fight?.safe > 0.8 ? Math.sin(time * 40) * 0.15 : 0;
      if (y.kind === 'kasa') { m.body.position.y = Math.abs(Math.sin(time * 4.5)) * 0.12; m.body.rotation.z = hit; }
      else if (y.kind === 'chochin') { m.body.rotation.z = Math.sin(time * 1.3) * 0.15 + hit; m.body.position.y = Math.sin(time * 0.9) * 0.05; }
      else { m.body.rotation.z = hit; m.body.position.y = 0; }
      if (y.leaving) {
        const L = y.leaving;
        L.t += dt;
        if (y.kind === 'noppera') {
          // the coat drops away; a mujina trots off
          m.who.visible = false; m.muj.visible = true;
          m.muj.position.z = L.t * 1.6;
          m.muj.position.y = Math.abs(Math.sin(L.t * 14)) * 0.04;
        } else if (L.how === 'bowled') m.body.rotation.z = Math.min(1.5, L.t * 3);
        else if (y.kind === 'kasa' && L.how === 'befriended') { const o = Math.min(1, L.t * 2); m.body.scale.set(1 + 0.7 * o, 1 - 0.35 * o, 1 + 0.7 * o); }   // it opens all the way
        const k = Math.max(0, 1 - Math.max(0, L.t - 1.2) / 1.2);
        m.g.scale.setScalar(Math.max(0.001, k));
        if (L.t > 2.4) { y.leaving = null; m.g.visible = false; }
      }
    }
    if (this.fight) this.drawArena(time);
  }

  drawArena(time) {
    const f = this.fight, D = this.dom;
    // the words, the meters and the choices (only rebuilt when they change)
    const opts = f.phase === 'menu' ? ACTIONS.map((a, i) => `${i + 1} ${LABEL[a]}`) : f.phase === 'sass' ? f.lines.map((l, i) => `${i + 1} ${l.text}`) : [];
    const nv = Math.max(0, Math.min(NERVE, f.nerve));
    const meters = `nerve ${'●'.repeat(nv)}${'○'.repeat(NERVE - nv)} · amused ${f.meters.amused}/${NEED.amused} · tumbled ${f.meters.tumbled}/${NEED.tumbled} · tired ${f.meters.tired}/${NEED.tired}`;
    const sig = JSON.stringify([f.text, opts, this.sel, meters, f.phase]);
    if (sig !== this.shown) {
      this.shown = sig;
      D.name.textContent = `${KINDS[f.kind].ja} · ${KINDS[f.kind].en}`;
      D.stat.textContent = meters;
      D.text.innerHTML = f.text.map(esc).join('<br>');
      D.menu.className = f.phase === 'sass' ? 'lines' : '';
      D.menu.innerHTML = opts.map((o, i) => `<button data-i="${i}" class="${i === this.sel ? 'on' : ''}">${esc(o)}</button>`).join('');
      D.arena.style.display = f.phase === 'turn' ? 'block' : 'none';
    }
    if (f.phase !== 'turn') return;
    const g = this.g2, cw = D.arena.width, ch = D.arena.height, s = cw / W;
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(8, 10, 12, 0.88)';
    g.fillRect(0, 0, cw, ch);
    const col = KINDS[f.kind].bullet;
    for (const b of f.bullets()) {
      g.beginPath();
      if (f.kind === 'noppera' && b.r < 0.04) g.ellipse(b.x * s, b.y * s, b.r * s * 0.85, b.r * s * 1.1, 0, 0, Math.PI * 2);   // eggs
      else g.arc(b.x * s, b.y * s, Math.max(1, b.r * s), 0, Math.PI * 2);
      if (b.warn) { g.strokeStyle = col; g.globalAlpha = 0.5; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; continue; }
      g.fillStyle = col; g.fill();
      if (f.kind === 'kasa' && b.r < 0.03) { g.beginPath(); g.moveTo(b.x * s - b.r * s * 0.7, b.y * s); g.lineTo(b.x * s, b.y * s - b.r * s * 2.2); g.lineTo(b.x * s + b.r * s * 0.7, b.y * s); g.fill(); }
    }
    const tg = f.target();
    if (tg) {
      g.fillStyle = f.kind === 'chochin' ? '#e04858' : f.kind === 'kasa' ? '#f2c81c' : '#8a8a94';
      g.beginPath(); g.arc(tg.x * s, tg.y * s, tg.r * s, 0, Math.PI * 2); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(tg.x * s + i * 2, tg.y * s); g.lineTo(tg.x * s + i * 3, tg.y * s + tg.r * s * 2.2 + Math.sin(time * 6 + i) * 1.5); g.stroke(); }
    }
    // the paw: one pad, four beans; it flickers after a bump
    if (!(f.safe > 0 && Math.floor(time * 12) % 2)) {
      const px = f.paw.x * s, py = f.paw.y * s, r = PAW * s;
      g.fillStyle = '#f4ead8';
      g.beginPath(); g.ellipse(px, py + r * 0.35, r * 0.75, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      for (const [ox, oy] of [[-0.75, -0.35], [-0.27, -0.75], [0.27, -0.75], [0.75, -0.35]]) { g.beginPath(); g.arc(px + ox * r, py + oy * r, r * 0.27, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = '#8d887b'; g.font = `${Math.round(ch * 0.075)}px monospace`;
    g.fillText(f.action === 'pounce' ? `catch the ${KINDS[f.kind].target}` : f.action === 'dodge' ? 'not a hair touched' : 'dodge', 4, ch - 4);
  }
}
