# Design

## The rule

"Walk from Shinjuku-sanchome to Nishi-Shinjuku only using underground passages: no trains, no going
outside" ([@astrra.space](https://bsky.app/profile/astrra.space/post/3mzws5xcevk2m), 2026-11-10, a cold day).
A real origin, a real destination, and the surface is off limits. Going up to the street is allowed and
counted: it's cold out there, and the street isn't part of the dungeon.

The dungeon framing is native, not imposed. People call these stations dungeons: 新宿ダンジョン,
渋谷ダンジョン, 梅田ダンジョン. Tokyu named a construction tour 「渋谷ダンジョン」. Otemachi's transfers are
famous for "the white bones piled beside the connecting passages" (a joke). The Bluesky archetypes, with
links, are in `claude-memory/conversations/2026-11-10-tokyo-megadungeon.md`.

## Decisions (Jason, 2026-11-10)

- **Roguelike.** Runs, loot, a dungeon that shifts.
- **Lost property is returned.** "Returned property? Absolutely. Loot for a roguelike." My reading, to
  confirm: what you find in the dungeon is lost property (忘れ物). During a run you can *use* it (that's the
  loot), or carry it to a lost-and-found counter (忘れ物取扱所) and *return* it. Returning is the permanent
  progress. Use it now or give it back: that's the run's core choice. It's also the commons move, and the
  inversion of SHINJUKU_CRAWLER (a TTRPG where you seize lost property).
- **Dream of the Earth links here.** A shrine in Dream links to this page. It needs a change in
  `jedelman/dream-of-the-earth` once this game has a public URL.

## The rest of the system: three tiers of fidelity

The whole Tokyo network can't come from one dataset, so fidelity follows the data:

1. **Real rooms** (MLIT indoor maps): floor outlines, rooms, columns, exits, gates and the walking network.
   There are exactly two in Tokyo: **Shinjuku** (done) and the **Tokyo Station area** (令和2年度更新版,
   Jan 2021, same format: dataset `mlit-indoor-tokyo-r2`; Jason downloads it, since G-Spatial needs a login).
   These are the ancient megadungeons.
2. **Real skeleton** (OpenStreetMap, ODbL): exits with their codes, underground walkway centrelines with
   levels, and platforms. Measured 2026-11-10 with the main API on station-sized boxes:
   - Otemachi: 40 exits, including `B7(閉鎖中)` (closed); 382 underground walkways (199 of them stairs),
     levels down to −4; 10 platforms.
   - Tochomae / Nishi-Shinjuku: 20 exits including **E9** and A18; 120 walkways; Nishi-Shinjuku's
     platforms mapped down to door positions. (This is Astra's west gap, and where kira's route can be checked.)
   - Shinjuku-sanchome: 36 exits, **メトロプロムナード** by name, 147 walkways. (Astra's east gap.)
   - Shibuya: 25 exits, 104 walkways, levels to −5.

   Corridors get generated walls, widths and tiles around the real centrelines. Platforms are real.
3. **The network** between stations: OSM subway lines (tunnel geometry), plus ODPT for station order,
   timetables and live Toei train positions (needs a free ODPT developer token). Mini Tokyo 3D (MIT)
   curates railway altitudes and might give line depths (unchecked). Trains are the fast travel between
   dungeons.

**Where data is thin, the generator fills it**, seeded per station and per day. The real spine stays
fixed; hoardings, closures and loot move with the daily seed. Real closures already exist in the data
(Shinjuku B12, Otemachi B7). "The Shibuya dungeon changes shape every time you enter. Memory is useless."
That is the roguelike, and it's true to the place. The MLIT map is itself a 2016–2020 snapshot of a
station that has since been torn up: the old map is literally out of date.

## Archetypes → mechanics (from Bluesky, 2026-11-10)

- **Depth as floors.** The Oedo line "runs on Brazil standard time". Nagatacho has 146 steps to the street.
  Lifts are "modern teleportation magic".
- **The map fills in as you get lost.** "Got lost, unlocked a ton of new map." Someone wished for a pinned
  destination and a minimap. Step 0 shows a route arrow and the distance; later, they're earned.
- **Ticket gates as locks.** Different operators, different gates. 「そんな改札はないですね」 ("there's no such ticket gate").
- **Finding the way by ear.** A distinct melody per station is a lifeline for blind riders. Ours are
  original. TX Akihabara pipes birdsong to a deep platform; TX Asakusa smells of grilled eel from a vent.
- **Crowds as terrain.** Rush hour is a current; at Tokyo Station "there's no flow" because everyone's
  half-lost, staring at signs.
- **The last train is the clock.**
- **Dream stations.** 架空新宿駅 ("imaginary Shinjuku Station") keeps recurring in people's dreams. That's
  the liminal layer, and the bridge to Dream of the Earth.
- **Comforts.** Standing soba, vending machines (an Evangelion cake in a can at Shinjuku-sanchome), and
  a gleaming Midtown wired into a passage that's leaked for decades.
- **The gap in the market.** "really difficult to find a vrchat map that captures… a train station… with
  ~30 different platforms." Everything else is one lonely platform. The opening is scale.

## Steps

- **0 (this PR).** Pipeline, PS1 renderer, walkable Shinjuku on all floors, stairs/escalators/lifts, the
  outside rule, keyboard/gamepad/touch, landscape, and level 0: Seibu B2 → 京王新線口, 1.1 km.
- **1.** Astra's route: stitch OSM's east (Sanchome, Metro Promenade) and west (Tochomae, E9, Nishi-Shinjuku)
  onto the MLIT core, then verify kira's "A17 dead-ends" claim against the data.
- **2.** Lost property and runs: finds, use or return, the lost-and-found counter, the daily seed.
- **3.** Tokyo Station area (MLIT data #2).
- **4.** The network: lines, trains, more stations from OSM.
- **Sound** throughout: original departure melodies, rooms with their own hum.

## Open

- Merge authority and a deploy target (Cloudflare Workers Builds like Dream? `wrangler.jsonc` is ready,
  assets only; build `npm run build`, deploy `npx wrangler deploy`). Which domain?
- Confirm the reading of "Returned property? Absolutely. Loot for a roguelike."
- Gamepad, touch and landscape are untested on real hardware.
