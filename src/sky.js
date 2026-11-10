// The night's sky: a horoscope cast for Tokyo at midnight on a date drawn at random. It seeds the day's dungeon.
// Jason (2026-11-10): "Let's use astrology for seeds: horoscopes cast on a random date (location is always Tokyo
// midnight)."
//
// The positions are real, at low precision: Paul Schlyter's method ("How to compute planetary positions"), mean
// orbital elements of date with the main lunar and Jupiter–Saturn perturbations, good to a few arcminutes over the
// 1900–2099 range we draw from. tests/sky.test.js checks them against astronomy-engine. Tropical zodiac, whole-sign
// houses, the seven classical planets (the Golden Dawn tarot attributions need no more). Midnight is 00:00 JST
// (UTC+9) all year: Japan's summer time of 1948–51 is ignored.
import { rng, hash } from './seed.js';

export const TOKYO = { name: 'Tokyo', lat: 35.6910, lon: 139.7000 };   // Shinjuku Station, the game's origin

export const SIGNS = [
  { en: 'Aries', ja: '牡羊座', element: 'fire', ruler: 'mars' },
  { en: 'Taurus', ja: '牡牛座', element: 'earth', ruler: 'venus' },
  { en: 'Gemini', ja: '双子座', element: 'air', ruler: 'mercury' },
  { en: 'Cancer', ja: '蟹座', element: 'water', ruler: 'moon' },
  { en: 'Leo', ja: '獅子座', element: 'fire', ruler: 'sun' },
  { en: 'Virgo', ja: '乙女座', element: 'earth', ruler: 'mercury' },
  { en: 'Libra', ja: '天秤座', element: 'air', ruler: 'venus' },
  { en: 'Scorpio', ja: '蠍座', element: 'water', ruler: 'mars' },
  { en: 'Sagittarius', ja: '射手座', element: 'fire', ruler: 'jupiter' },
  { en: 'Capricorn', ja: '山羊座', element: 'earth', ruler: 'saturn' },
  { en: 'Aquarius', ja: '水瓶座', element: 'air', ruler: 'saturn' },
  { en: 'Pisces', ja: '魚座', element: 'water', ruler: 'jupiter' },
];
export const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
export const PLANET_NAME = { sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const RAD = Math.PI / 180;
const rev = (x) => ((x % 360) + 360) % 360;
const sind = (x) => Math.sin(x * RAD), cosd = (x) => Math.cos(x * RAD), tand = (x) => Math.tan(x * RAD);
const atan2d = (y, x) => Math.atan2(y, x) / RAD;

// 00:00 in Tokyo on a calendar date, as a Julian Day (UT)
export function midnightJD(date) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  t.setUTCHours(0, 0, 0, 0);
  return (t.getTime() - 9 * 3600e3) / 86400e3 + 2440587.5;
}

// mean orbital elements of date (degrees; a in AU, the Moon's in Earth radii), d = days from 2000 Jan 0.0 UT
function elements(d) {
  return {
    sun: { N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.047 + 0.9856002585 * d },
    moon: { N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.0549, M: 115.3654 + 13.0649929509 * d },
    mercury: { N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d },
    venus: { N: 76.6799 + 2.4659e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.891 + 1.38374e-5 * d, a: 0.72333, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d },
    mars: { N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d },
    jupiter: { N: 100.4542 + 2.76854e-5 * d, i: 1.303 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.895 + 0.0830853001 * d },
    saturn: { N: 113.6634 + 2.3898e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.967 + 0.0334442282 * d },
  };
}

function kepler(M, e) {
  let E = M + (e / RAD) * sind(M) * (1 + e * cosd(M));
  for (let k = 0; k < 10; k++) {
    const dE = (E - (e / RAD) * sind(E) - M) / (1 - e * cosd(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }
  return E;
}

// ecliptic longitude, latitude and distance in the orbit's frame (heliocentric; geocentric for the Sun and Moon)
function orbit({ N, i, w, a, e, M }) {
  const E = kepler(rev(M), e);
  const xv = a * (cosd(E) - e), yv = a * Math.sqrt(1 - e * e) * sind(E);
  const v = atan2d(yv, xv), r = Math.hypot(xv, yv);
  const x = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
  const y = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
  const z = r * sind(v + w) * sind(i);
  return { lon: rev(atan2d(y, x)), lat: atan2d(z, Math.hypot(x, y)), r };
}

// geocentric ecliptic longitudes of date, in degrees
export function longitudes(jd) {
  const d = jd - 2451543.5;
  const el = elements(d);
  const sun = orbit(el.sun);
  const xs = sun.r * cosd(sun.lon), ys = sun.r * sind(sun.lon);
  const out = { sun: sun.lon };

  // the Moon, with its largest perturbations
  const m = orbit(el.moon);
  const Ms = rev(el.sun.M), Mm = rev(el.moon.M);
  const Ls = rev(el.sun.M + el.sun.w), Lm = rev(el.moon.M + el.moon.w + el.moon.N);
  const D = Lm - Ls, F = Lm - el.moon.N;
  out.moon = rev(m.lon
    - 1.274 * sind(Mm - 2 * D) + 0.658 * sind(2 * D) - 0.186 * sind(Ms)
    - 0.059 * sind(2 * Mm - 2 * D) - 0.057 * sind(Mm - 2 * D + Ms) + 0.053 * sind(Mm + 2 * D)
    + 0.046 * sind(2 * D - Ms) + 0.041 * sind(Mm - Ms) - 0.035 * sind(D)
    - 0.031 * sind(Mm + Ms) - 0.015 * sind(2 * F - 2 * D) + 0.011 * sind(Mm - 4 * D));

  // the planets: heliocentric, perturbed (Jupiter and Saturn pull on each other), then seen from Earth
  const Mj = rev(el.jupiter.M), Msa = rev(el.saturn.M);
  for (const p of ['mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
    const h = orbit(el[p]);
    let lon = h.lon, lat = h.lat;
    if (p === 'jupiter') {
      lon += -0.332 * sind(2 * Mj - 5 * Msa - 67.6) - 0.056 * sind(2 * Mj - 2 * Msa + 21) + 0.042 * sind(3 * Mj - 5 * Msa + 21)
        - 0.036 * sind(Mj - 2 * Msa) + 0.022 * cosd(Mj - Msa) + 0.023 * sind(2 * Mj - 3 * Msa + 52) - 0.016 * sind(Mj - 5 * Msa - 69);
    } else if (p === 'saturn') {
      lon += 0.812 * sind(2 * Mj - 5 * Msa - 67.6) - 0.229 * cosd(2 * Mj - 4 * Msa - 2) + 0.119 * sind(Mj - 2 * Msa - 3)
        + 0.046 * sind(2 * Mj - 6 * Msa - 69) + 0.014 * sind(Mj - 3 * Msa + 32);
      lat += -0.02 * cosd(2 * Mj - 4 * Msa - 2) + 0.018 * sind(2 * Mj - 6 * Msa - 49);
    }
    const xh = h.r * cosd(lon) * cosd(lat), yh = h.r * sind(lon) * cosd(lat);
    out[p] = rev(atan2d(yh + ys, xh + xs));
  }
  return out;
}

export const obliquity = (jd) => 23.4393 - 3.563e-7 * (jd - 2451543.5);

// local sidereal time in degrees (IAU 1982 mean sidereal time plus the longitude)
export function siderealTime(jd, lon) {
  const T = (jd - 2451545) / 36525;
  return rev(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - (T * T * T) / 38710000 + lon);
}

// the Ascendant: the degree of the ecliptic rising on the eastern horizon
export function ascendant(jd, at = TOKYO) {
  const th = siderealTime(jd, at.lon), e = obliquity(jd);
  return rev(atan2d(cosd(th), -(sind(th) * cosd(e) + tand(at.lat) * sind(e))));
}

// the horoscope for 00:00 JST on a date (YYYY-MM-DD)
export function cast(date, at = TOKYO) {
  const jd = midnightJD(date);
  const lon = longitudes(jd);
  const asc = ascendant(jd, at);
  const ascSign = Math.floor(asc / 30);
  const point = (l) => { const s = Math.floor(rev(l) / 30) % 12; return { lon: rev(l), sign: s, deg: rev(l) - s * 30, house: ((s - ascSign + 12) % 12) + 1 }; };
  return {
    date, jd, at,
    planets: Object.fromEntries(PLANETS.map((p) => [p, point(lon[p])])),
    asc: point(asc),
    phase: rev(lon.moon - lon.sun),   // 0 new, 180 full
  };
}

// a valid calendar date in the range the ephemeris is good for
export function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (y < 1800 || y > 2199) return false;
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

// Tonight's chart: a random date between 1900 and 2099, one per real day and the same for everyone; or a date you
// choose (?chart=YYYY-MM-DD).
export function tonight(day, chosen = null) {
  if (validDate(chosen)) return cast(chosen);
  return cast(randomDate(rng(hash(`sky|${day}`))));
}

// a date between 1900 and 2099, from a seeded generator
export function randomDate(r) {
  const from = Date.UTC(2000, 0, 1) - 100 * 365.2425 * 864e5;   // ~1900-01-01
  const span = 200 * 365.2425;
  const t = new Date(Math.round(from / 864e5 + Math.floor(r() * span)) * 864e5);
  const y = Math.max(1900, Math.min(2099, t.getUTCFullYear()));
  const date = `${String(y).padStart(4, '0')}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  return validDate(date) ? date : '1927-12-30';
}

// the season a date falls in, as Tokyo has it
export function season(date) {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
}

// the chart is the seed: every position, to a hundredth of a degree, plus what it's seeding
export function skySeed(chart, salt = '') {
  return hash(`${PLANETS.map((p) => chart.planets[p].lon.toFixed(2)).join(',')},${chart.asc.lon.toFixed(2)}|${salt}`);
}

export const signName = (s) => SIGNS[s].en;
export function longDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function moonWord(phase) {
  if (phase < 22.5 || phase >= 337.5) return 'a new moon';
  if (phase < 157.5) return 'a waxing moon';
  if (phase < 202.5) return 'a full moon';
  return 'a waning moon';
}
// the night in two lines
export function describe(chart) {
  const p = chart.planets;
  return [
    `Tonight's sky, cast for Tokyo at midnight on ${longDate(chart.date)}:`,
    `Sun in ${signName(p.sun.sign)}, Moon in ${signName(p.moon.sign)}, ${signName(chart.asc.sign)} rising, ${moonWord(chart.phase)}.`,
  ];
}
