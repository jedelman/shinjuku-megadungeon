// The major arcana, drawn from the night's chart and laid out with the underworld procedure in His Majesty the Worm
// (Rise Up Comus, Appendix E, "Generate an Underworld Layout", shown on Bluesky 2026-09-02):
// - draw a major arcana card per dungeon;
// - the lowest holds the main entrance; cards I–V also open to the surface and lie beside it, each way up either
//   "traversable and known" or "sealed and secret";
// - the highest is the deepest level, and the rest lie between;
// - cards connect if they lie next to each other on the table, if their values are sequential, or if one value
//   divides the other.
// We take the procedure, with credit, and none of the book's text, seeds or art. Here the chart deals the cards
// (Golden Dawn attributions: each card belongs to a sign, a planet or an element), the station's real depth decides
// where each card lies, and the sky decides which ways up are known: above the horizon is known, below is secret.
// Connections between neighbours on the table are walked; the others are magic portals, cast with the kitten's wand
// (Jason, 2026-11-10: "Yep, magic portals are in").
import { SIGNS, PLANETS, PLANET_NAME, signName } from './sky.js';

export const MAJOR = [
  { n: 0, name: 'The Fool', of: { element: 'air' } },
  { n: 1, name: 'The Magician', of: { planet: 'mercury' } },
  { n: 2, name: 'The High Priestess', of: { planet: 'moon' } },
  { n: 3, name: 'The Empress', of: { planet: 'venus' } },
  { n: 4, name: 'The Emperor', of: { sign: 0 } },
  { n: 5, name: 'The Hierophant', of: { sign: 1 } },
  { n: 6, name: 'The Lovers', of: { sign: 2 } },
  { n: 7, name: 'The Chariot', of: { sign: 3 } },
  { n: 8, name: 'Strength', of: { sign: 4 } },
  { n: 9, name: 'The Hermit', of: { sign: 5 } },
  { n: 10, name: 'Wheel of Fortune', of: { planet: 'jupiter' } },
  { n: 11, name: 'Justice', of: { sign: 6 } },
  { n: 12, name: 'The Hanged Man', of: { element: 'water' } },
  { n: 13, name: 'Death', of: { sign: 7 } },
  { n: 14, name: 'Temperance', of: { sign: 8 } },
  { n: 15, name: 'The Devil', of: { sign: 9 } },
  { n: 16, name: 'The Tower', of: { planet: 'mars' } },
  { n: 17, name: 'The Star', of: { sign: 10 } },
  { n: 18, name: 'The Moon', of: { sign: 11 } },
  { n: 19, name: 'The Sun', of: { planet: 'sun' } },
  { n: 20, name: 'Judgement', of: { element: 'fire' } },
  { n: 21, name: 'The World', of: { planet: 'saturn', element: 'earth' } },
];

const R = [['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
export function roman(n) {
  if (n === 0) return '0';
  let s = '';
  for (const [k, v] of R) while (n >= v) { s += k; n -= v; }
  return s;
}
export const title = (c) => `${roman(c.n)} ${c.name}`;
const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

const bySign = (s) => MAJOR.find((c) => c.of.sign === s);
const byPlanet = (p) => MAJOR.find((c) => c.of.planet === p);
const byElement = (e) => MAJOR.find((c) => c.of.element === e);
const above = (house) => house >= 7;   // whole-sign houses 7–12 are above the horizon

// Draw n cards from the chart. Each says why it was drawn and whether its point in the sky was above the horizon.
// The order: the rising sign, the Sun's sign, the Moon's sign, the chart's ruler, the element the sky leans to, then
// the other planets' signs and the planets themselves, keeping the first n different cards.
export function draw(chart, n) {
  const p = chart.planets, asc = chart.asc;
  const ruler = SIGNS[asc.sign].ruler;
  const cand = [
    [bySign(asc.sign), `${signName(asc.sign)} rising`, true],   // on the horizon, coming into view
    [bySign(p.sun.sign), `the Sun in ${signName(p.sun.sign)}`, above(p.sun.house)],
    [bySign(p.moon.sign), `the Moon in ${signName(p.moon.sign)}`, above(p.moon.house)],
    [byPlanet(ruler), `${PLANET_NAME[ruler]}, ruler of the chart`, above(p[ruler].house)],
  ];
  const count = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const k of PLANETS) count[SIGNS[p[k].sign].element]++;
  count[SIGNS[asc.sign].element]++;
  const lean = Object.entries(count).sort((a, b) => b[1] - a[1]);
  if (lean[0][1] > lean[1][1]) {
    const el = lean[0][0];
    const of = PLANETS.filter((k) => SIGNS[p[k].sign].element === el);
    cand.push([byElement(el), `a sky leaning to ${el}`, of.filter((k) => above(p[k].house)).length * 2 > of.length]);
  }
  for (const k of ['saturn', 'jupiter', 'mars', 'venus', 'mercury']) cand.push([bySign(p[k].sign), `${PLANET_NAME[k]} in ${signName(p[k].sign)}`, above(p[k].house)]);
  for (const k of ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon']) cand.push([byPlanet(k), `${PLANET_NAME[k]} in the ${ordinal(p[k].house)} house`, above(p[k].house)]);
  const out = [];
  for (const [c, why, up] of cand) {
    if (out.length >= n) break;
    if (!out.some((o) => o.n === c.n)) out.push({ n: c.n, name: c.name, why, up });
  }
  return out;
}

const divides = (a, b) => (b !== 0 && a % b === 0) || (a !== 0 && b % a === 0);

// Lay the cards out and connect them. Returns the table (entrance, column down to the deepest, the cards beside the
// entrance), which cards open to the surface, and the connections with how each was made.
export function layout(cards) {
  const sorted = [...cards].sort((a, b) => a.n - b.n);
  const entrance = sorted[0], deepest = sorted[sorted.length - 1];
  const side = sorted.filter((c) => c !== entrance && c !== deepest && c.n >= 1 && c.n <= 5);
  const column = [entrance, ...sorted.filter((c) => c !== entrance && c !== deepest && !side.includes(c))];
  if (deepest !== entrance) column.push(deepest);
  const edges = new Map();
  const add = (a, b, how) => {
    const [x, y] = a.n < b.n ? [a, b] : [b, a];
    const k = `${x.n}-${y.n}`;
    if (!edges.has(k)) edges.set(k, { a: x.n, b: y.n, how: [] });
    if (!edges.get(k).how.includes(how)) edges.get(k).how.push(how);
  };
  for (let i = 1; i < column.length; i++) add(column[i - 1], column[i], 'adjacent');
  for (const s of side) add(entrance, s, 'adjacent');
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      if (Math.abs(a.n - b.n) === 1) add(a, b, 'sequential');
      if (divides(a.n, b.n)) add(a, b, 'divisible');
    }
  }
  return {
    entrance: entrance.n, deepest: deepest.n,
    column: column.map((c) => c.n), side: side.map((c) => c.n),
    surface: sorted.filter((c) => c === entrance || (c.n >= 1 && c.n <= 5)).map((c) => c.n),
    edges: [...edges.values()],
  };
}
