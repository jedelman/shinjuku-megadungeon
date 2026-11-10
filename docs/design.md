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
- **Lost property is useless in the dungeon.** Return it to the NPC who lost it and they'll give you
  something useful (Jason, 2026-11-10). So every find is a small quest: carry it (it takes up space and
  does nothing), find whose it is, get something you can actually use. Nothing is looted; things go back.
  The station's real lost-and-found office is in the TMG data (`StationOffice/LostandFoundoffice`, B3F),
  a natural hub for hints about who lost what. Still open: do owners wander, wait somewhere, or leave word
  at that office?
- **Standalone renderer** (Jason, 2026-11-10). This is its own game with its own renderer, not a realm
  inside Dream of the Earth.
- **Dream of the Earth links here.** A shrine in Dream links to this page. It needs a change in
  `jedelman/dream-of-the-earth` once this game has a public URL.

## The avatar (Jason, 2026-11-10)

A **30 cm kitten with a backpack and a magic wand.** Jason: "Gives us lots of room to scale, so we can
have big dramatic bossfights."

- At kitten height the station reads about **six times bigger**: a 3 m concourse is a cathedral, people are
  giants, and a ticket gate is a castle wall. The camera sits low and looks up.
- The **backpack** carries lost property, which is useless in the dungeon but goes back to its owners. The
  **wand** floats at the shoulder (paws don't hold wands); its star glows through the fog. It's the
  obvious seat for abilities later.
- A kitten fits where people don't: collision radius 0.12 m. Under gate flaps, between pillar and wall.
  That's a mechanic waiting to happen.
- Speeds: a 2.4 m/s trot, 6.5 m/s zoomies, and stairs taken at a bound.
- **Boss scale, proposals only:** the station's floor-scrubbing machine on its night round, a lost-umbrella
  colossus, and the shoulder-checking man, whom the kitten
  beats (see the content rules). There's also kira's joke, "first boss: an exit sign that leads back to the
  platform you just left". As a boss that lies, it works. As a looping corridor, it's The Exit 8's, so not that.

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

## Open data around Shinjuku: the inventory (checked 2026-11-10)

| source | id | licence | what it adds | in repo? |
|---|---|---|---|---|
| MLIT indoor map, Shinjuku (2020) | G-Spatial `mlit-indoor-shinjuku-r2` | 政府標準利用規約 2.0 | rooms, columns, exits, gates, network, B3–4F | yes, raw zip |
| MLIT walking networks (ほこナビ) | `station_oedo_tochomae`, `station_oedo_shinjuku`, `station_oedo_shinjukunishiguchi` | PDL 1.0 | **floor plans + networks** for three Oedo stations, down to **B6**; Tochomae is Astra's west end | yes (limited release, gone after 2027-03-12) |
| MLIT walking network (ほこナビ, 2021) | `nwd_shibuya_sendagaya_shinjuku` | PDL 1.0 | network only, wide; **underground links along the west passage toward Tochomae** | yes, gzipped |
| PLATEAU Shinjuku-ku FY2025 | G-Spatial `plateau-13104-shinjuku-ku-2025` (udx/ubld) | CC BY 4.0 (one of four) | underground-mall model, LOD4.1: walls, ceilings, 1,364 doors, **real elevations** (B1 ≈ 33 m, B2 ≈ 25 m, deep ≈ 15.5 m above sea level); central 0.04 km² only | fetched by `tools/fetch_sources.py` |
| Tokyo Metropolitan Government | catalog `t000008d0000000037`, G-Spatial `tmg-shinjuku-navigation` | CC BY | same footprint as MLIT; adds B4F/B5F circulation, mezzanines, 451 names on B1F, the lost-and-found office | fetched by `tools/fetch_sources.py` |
| MLIT indoor map, Tokyo Station area (2021) | G-Spatial `mlit-indoor-tokyo-r2` | 政府標準利用規約 2.0 | the second megadungeon | **needs Jason's G-Spatial login** |
| MLIT walking networks (ほこナビ) | `nwd_tokyo`, `nwd_chiyoda_chuo`, `nwd_ikebukuro`, `nwd_ueno_station`, and Oedo stations `station_oedo_*` (Aoyama-itchome, Akabanebashi, Daimon, Kokuritsu-kyogijo, Azabu-juban, Higashi-shinjuku, Roppongi, Ueno-okachimachi, Yoyogi) | PDL 1.0 | other stations, later | no login needed |

**Still in no official open dataset:** the Metro Promenade's east end, Shinjuku-sanchome station, and
Nishi-Shinjuku station (Marunouchi line), all street-level-only in the 2021 network. Platforms for JR, Odakyu,
Keio and Tokyo Metro are missing too. These come from OpenStreetMap (ODbL), which has the
メトロプロムナード, E9, and Nishi-Shinjuku's platforms down to door positions.

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
- **1.** Astra's route. West: the Tochomae floor plans (ほこナビ) plus the 2021 network's underground passage.
  East: OSM's Metro Promenade to Sanchome. Nishi-Shinjuku and E9 from OSM. Stitch onto the MLIT core, then
  verify kira's "A17 dead-ends" claim against the data. Use PLATEAU's elevations for true floor depths.
- **2.** Lost property and runs: finds, use or return, the lost-and-found counter, the daily seed.
- **3.** Tokyo Station area (MLIT data #2).
- **4.** The network: lines, trains, more stations from OSM.
- **Sound** throughout: original departure melodies, rooms with their own hum.

## Open

- Merge authority and a deploy target (Cloudflare Workers Builds like Dream? `wrangler.jsonc` is ready,
  assets only; build `npm run build`, deploy `npx wrangler deploy`). Which domain?
- Gamepad, touch and landscape are untested on real hardware.
