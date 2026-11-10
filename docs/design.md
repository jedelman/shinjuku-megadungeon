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
- **Lost property is useless in the dungeon.** Return it and the owner gives you something useful (Jason,
  2026-11-10). **Owners leave word at the lost-and-found counter** ("consistency of return"), so every find goes
  back to the same place. Shinjuku's counter is the real one: the Tokyo Metropolitan Government's terminal data
  marks `StationOffice/LostandFoundoffice` at the Marunouchi line's B2 station office, and MLIT's office polygon is
  1.7 m away. Where no data names one (Tokyo), the game puts the counter at a real MLIT station office near the
  middle of the level and says so when you visit. **Built (v1):** four things a day per level (seeded by date), seven
  kinds, each with an owner and the word they left. **Rewards v1, my proposal for Jason to steer:** first a lantern
  charm (the fog lifts farther), then a folded station map (a minimap of your floor), then tiny boots (faster
  zoomies), then stamps for your book.
- **Lost wanderers** (Jason, 2026-11-10): "lost and wandering NPCs that you can assist if you've been to the place
  they're trying to get to." Each one asks for a named gate or exit in the same station, reachable without
  surfacing. Places count as visited once you pass within 8 m of them, remembered per station. If you've been
  there, you lead them and they walk off toward it; if not, they're still asking. Three a day per level.
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
- Speeds: a 2.4 m/s trot, 6.5 m/s zoomies, and stairs taken at a bound. Gaits blend by real ground speed:
  walk (4-beat) below ~1 m/s, trot, then a half-bound gallop with a flexing spine. On escalators and in lifts
  the kitten sits, and it sits down by itself after a few idle seconds. Animation is three's AnimationMixer
  (see CLAUDE.md), not R3F.
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

## Patches: the dungeon as a quilt (after Rise Up Comus, 2026-11-10)

Jason (2026-11-10): "Joshy Mcroo is an incredible resource on megadungeons. Let's take some of his advice." The advice
is his challenge, ["The Elemental Level of Megadungeon Construction"](https://riseupcomus.blogspot.com/2026/09/the-elemental-level-of-megadungeon.html)
(Rise Up Comus, 2026-09-03; [on Bluesky](https://bsky.app/profile/riseupcomus.bsky.social/post/3mumgdofhl22k)):
write megadungeons in 4–5 room "elemental building blocks", or patches.
- Start with a kernel: a reason to explore, to talk, to run away.
- Build 2–3 rooms around it.
- Connect an intentionally blank room for the assembler to fill.
- Put a gate that connects to another level.
- Give it an evocative name.
- Trade patches with friends: "Make your megadungeons like a quilt."

**How it maps onto a real station.** We can't draw rooms: the geometry is MLIT's, and it's fixed. So:
- A **room** is a real named place: a ticket gate, an exit, a station office.
- A **patch** is a cluster of them within a 75 m walk on one floor.
- Its **gate** is a real stair, escalator or lift to another underground floor. Floors are the dungeon's levels.

The station already has the structure the post quotes from Gus's Jaquaysing article (nodes, choke points, alternate ways down). Patches only key it.

**Patches are portable.** A patch is written against *kinds* of place (`at`: gate / exit / office / any), never
coordinates, so the same file sews into Shinjuku, Tokyo or Astra's route. `sew()` places up to four a day per level,
seeded like the people:
- Hearts are at least 60 m apart.
- No place belongs to two patches.
- Every room is walkable and reachable without surfacing.
- A patch that doesn't fit today is left out.

As one commenter on the post (ratkingrpg) pointed out, these are keyed spaces, not five-room adventures: rooms have
no required order.

**The kernels are engine code; the patches are data** (`patches/*.json`, one file each, `patches/README.md`):
- `explore`: find every room, then the heart gives up its find.
- `talk`: a person at the heart who also tells you where today's nearest lost thing is. This ties patches to the
  lost-property loop the way his Meatgrinder ties a level together.
- `run`: a clock from the heart to the gate.

Finds are station stamps for now. The **blank** is filled with a stitch, a chalked arrow naming the next patch in the
day's quilt and its walking distance. A lone patch's stitch points at the lost-and-found.

**Friends' patches are untrusted input.** A friend's patch is a pull request with one JSON file:
- It's checked against hard caps (`checkPatch`: 4–5 rooms, exactly one heart and one blank, a gate, lines ≤ 160
  characters).
- Its text is escaped.
- The content rules still hold.

Publishing patches as atproto records, the way Dream publishes artifacts, would be the Bluesky-native version of
"post your patches on your blog". That's Jason's call (it's shared state), and it isn't built.

**The first month** (his "a patch a week for a month"):
- *The Last Shutter* (run)
- *Three Chalk Cats* (explore)
- *The Man Who Still Commutes* (talk)
- *The Vending Machine Choir* (explore)

**Not yet:**
- His other blank fillers: a lever that opens a door elsewhere, or an idol that wants gems from another level. These
  need locks and an inventory beyond the lost-property bag.
- A Meatgrinder: an overloaded encounter table per level (the rush-hour surge, the cleaning machine, the
  announcement).
- Props beyond vending machines, benches and carts.

## The underworld: tonight's sky deals the spread (2026-11-10)

Rise Up Comus posted the other half on 2026-09-02 ([Bluesky](https://bsky.app/profile/riseupcomus.bsky.social/post/3mujyw6hwx22d)):
*His Majesty the Worm*'s Appendix E, "Generate an Underworld Layout".
- Draw a major arcana card per dungeon.
- The lowest card holds the main entrance.
- Cards I–V also open to the surface, each way up "traversable and known" or "sealed and secret".
- The highest card is the deepest level, and the rest lie between.
- Cards connect if they lie next to each other on the table, if their values are sequential, or if one value divides
  the other.
- Farther from the entrances is harder and richer.

**Jason's calls:**
- "Yep, magic portals are in."
- "Let's use astrology for seeds: horoscopes cast on a random date (location is always Tokyo midnight)."

We take the procedure, with credit; never the book's text, dungeon seeds, art or the Worm.

**The sky** (`src/sky.js`):
- **The date.** Each real day draws one random date between 1900 and 2099, the same for everyone. `?chart=YYYY-MM-DD`
  chooses one.
- **The chart.** It's cast for 00:00 JST over Shinjuku Station (the game's origin): the Sun, Moon and five classical
  planets, the Ascendant, tropical zodiac, whole-sign houses.
- **The ephemeris** is our own, Paul Schlyter's low-precision method, so there's no runtime dependency.
  `tests/sky.test.js` checks it against **astronomy-engine** (MIT, a pinned dev dependency, never shipped) over 150
  dates: every body within 0.1°, the Ascendant on the eastern horizon.
- **Simplifications:** JST all year (Japan's 1948–51 summer time is ignored), and no Uranus, Neptune or Pluto. The Golden
  Dawn attributions don't need them.
- **The chart is the seed:** its positions, hashed with the level, seed `plan()` (people) and `sew()` (patches).

**The spread** (`src/arcana.js`):
- **Attributions.** The 22 major arcana with the Golden Dawn attributions: twelve signs, seven planets, and three
  elements (the Fool is air, the Hanged Man water, Judgement fire; the World is Saturn and earth).
- **The draw.** Cards come in this order, keeping the first ones that differ, one per patch:
  1. the rising sign;
  2. the Sun's sign;
  3. the Moon's sign;
  4. the chart's ruler;
  5. the element the sky leans to;
  6. then the other planets.

  Each card remembers why it was drawn and whether its point was above the horizon.
- **The table, read off the real station:**
  - **Depth.** A patch's depth is the mean, over its rooms, of walking distance to the nearest open exit plus that
    exit's climb to the street. MLIT puts many exits at the foot of their stairs; the climb uses the game's 5 m a floor.
    Shinjuku is riddled with exits, so patches are often equally deep. Ties go to the lower floor, then the deepest
    room, then the name.
  - **Dealing.** The lowest card goes to the shallowest patch (the way in), the highest to the deepest.
- **Connections:**
  - Neighbours on the table are walked: the blank's chalk stitch.
  - The others (sequential or divisible values) are **portals** in the blanks, cast with the kitten's wand. They're
    honest because they're plainly magic. Portals appear on about 60% of nights.
- **Ways up.** The entrance and cards I–V get the patch's nearest open exit as their way up to the street. It's known if
  the card's point was above the horizon (houses 7–12). If it was below, it's sealed and secret, found by walking to it.
- **Depth pays.** The deepest patch pays twice. The deepest place is also where bosses belong, when there are bosses.

## A chart makes the patch: addresses and the time warp (2026-11-10)

Jason: "A chart makes the patch! That way dungeons are addressable and replayable and testable. Plus we get a cool time
warp in game explanation. A little house of leaves y. But cute!"

**Addresses** (`placePatch` in `src/patches.js`):
- **One night, one place.** Each patch is placed by its own chart, cast for Tokyo at midnight on its own date, and
  nothing else. So `the-last-shutter@1927-12-30` always names the same patch in a station, whatever else is sewn that
  night.
- **Tonight's picks.** Tonight's sky draws a date for each patch, and draws again (up to 16 times) until the patch lies
  clear of the others. A few seeded attempts keep the fullest quilt.
- **Replay.** `?patches=id@YYYY-MM-DD,...` replays exact patches. The finish card links tonight's.
- **What tonight's sky still does:** it deals the cards (by depth) and so the portals. Same patches under the same sky
  give the same spread.
- **Tests replay addresses.** The smoke test runs four pinned addresses under the 1988-08-08 sky.

**The time warp:**
- **Inside a patch you're in its night.** Within 9 m of any of its rooms:
  - the HUD shows its date;
  - the fog takes its season's light, brighter under a full moon;
  - its season drifts through the corridor.
- **What drifts, by month:** cherry petals in spring, fireflies in summer, osmanthus in September–October (after the
  picture Jason sent), ginkgo in November, snow in winter.
- **The arrival line:** "You step into the night of 28 January 2077. It's snowing indoors, a little."
- **The idea:** it's the House of Leaves idea, a place bigger inside than out, made cute. The corridor is real; the
  night inside it isn't.
- **Nights we never step into** (`SOMBRE`): they're never drawn and can't be chosen.
  - 20 March 1995: the sarin attack on these very lines. It's never content.
  - The 1923 Great Kantō earthquake.
  - The war years (Jason: "let's exclude the war years"): 18 September 1931, the Mukden Incident, to 2 September 1945,
    the surrender. That's the span called the Fifteen Years' War (十五年戦争), chosen as the broader reading.
  - The air raids on Tokyo, from 24 November 1944 to the surrender (inside the war years; kept, since dates are never
    removed).
  - 11 March 2011.
  A day either side of each. The occupation years after 1945 stay in.
- **Rewards:** the deepest patch's talker pays too (two stamps for listening), since the deepest patch in Shinjuku is
  often the commuter.

## The kitten's proportions (2026-11-10)

Jason sent a mofusand picture: "can we alter Kitty proportions to be more like mofusand". We took only the
proportions; the coat, the yellow pack and the wand are hers, and she's not a mofusand character.
- A big round head, wider than the body.
- Big dark eyes, set wide and low.
- Fluffy cheeks and a small white muzzle.
- A short round body on stubby legs (7.8 cm against 10.7 before).
- A fluffier tail.

Strides shrank with the legs (walk 0.15 m, trot 0.26 m, gallop 0.57 m), so her paws still plant, and she scurries.

## Critters: the station's small animals (2026-11-10)

Jason: "Let's start to populate the megadungeon. What other critters are cute and inhabit subways?" The first five are
real urban animals in Japan.
- **Where they live** is a game ecology read off the real station (depth = walk to an exit plus its climb). It isn't
  survey data.
- **Field notes.** Each species' facts carry their sources in code (`SOURCES` in `src/critters.js`), and a test fails
  if a species has none. The game shows them as field notes the first time you meet each animal.
- **Placement.** `census()` is pure, seeded by tonight's chart. Animals live within 28 m of the level's route, where
  you'll meet them.

| Species | Where | How you meet it | Field note facts (sources in code) |
|---|---|---|---|
| ドバト feral pigeon | flocks of 3–5 within 12 m of the street | zoom at them and the flock goes up and lands a way off; a slow kitten can walk right up | feral rock doves: cliff-crevice birds kept by people (homing pigeons among them) that went wild worldwide. Suntory bird encyclopedia, Bird Research News |
| クマネズミ black rat | the deep end of the level (≥ 12 m, the deepest 40%) | runs from a running kitten; sit still and one comes right up | wary, good at heights, nests in ceilings and walls. Minato City |
| ニホンヤモリ Japanese gecko | on a wall 1.5–2.6 m up, within 30 m of the street | darts along the wall if you come too close | "house guard", lives near people, hunts insects at lights at night. Ministry of the Environment (Kōkyo Gaien); came from China about 3,000 years ago and spread east with people. Tohoku University, 2022 |
| オカダンゴムシ pill bug | at the foot of a wall, ≥ 8 m deep | bump it and it rolls into a ball and goes rolling | rolls into an almost perfect sphere to protect itself (Kanagawa Prefectural Museum); arrived in Japan probably after the Meiji era (Nagoya City) |
| ツバメ swallow | a nest over the heart of each patch whose night falls April–August | a parent circles, three chicks open their beaks, a droppings board below | nests in stations because the crowds keep predators away; railways (Keio) put boards under nests spring to summer. Traffic News, Tetsudo Channel |

- **Drawn bigger than life:** geckos, pill bugs and swallows, so a 240-line screen shows them.
- **Not yet:**
  - Tanuki: they live in the 23 wards and use railway tracks as trails at night.
  - The huntsman spider (アシダカグモ, "Sergeant"): a harmless cockroach hunter, but not everyone's idea of cute.
  - A train-riding animal for the network step. That idea comes from Moscow's metro dogs (outside Tokyo; the research
    is dated).
- **Left out on purpose:**
  - Cockroaches.
  - The London Underground mosquito. Not cute, and a 2025 *Science* study found it didn't evolve in the Tube after all.

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
- **1. Done 2026-11-10 as level 2 (1,785 m never surfacing; kira's A17 dead-end is consistent with the data).** Astra's route. West: the Tochomae floor plans (ほこナビ) plus the 2021 network's underground passage.
  East: OSM's Metro Promenade to Sanchome. Nishi-Shinjuku and E9 from OSM. Stitch onto the MLIT core, then
  verify kira's "A17 dead-ends" claim against the data. Use PLATEAU's elevations for true floor depths.
- **2.** Lost property and runs: finds, use or return, the lost-and-found counter, the daily seed.
- **3.** Tokyo Station area (MLIT data #2). **Done 2026-11-10 as level 1:** Higashi-Ginza → Otemachi, 2.7 km.
- **3b. Done 2026-11-10:** patches (above): four of them, sewn daily onto every level.
- **3c. Done 2026-11-10:** the underworld: tonight's horoscope deals a tarot spread onto the patches by real depth; wand portals.
- **3d. Done 2026-11-10:** a chart makes the patch (addresses, replay, the time warp); the kitten's new proportions.
- **3e. Done 2026-11-10:** critters: pigeons, black rats, geckos, pill bugs, swallows (field notes with sources).
- **4.** The network: lines, trains, more stations from OSM.
- **Sound** throughout: original departure melodies, rooms with their own hum.

## Open

- Merge authority and a deploy target (Cloudflare Workers Builds like Dream? `wrangler.jsonc` is ready,
  assets only; build `npm run build`, deploy `npx wrangler deploy`). Which domain?
- Gamepad, touch and landscape are untested on real hardware.
