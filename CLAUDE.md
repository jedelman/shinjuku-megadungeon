# CLAUDE.md: shinjuku-megadungeon

Shinjuku Station as a PS1-style megadungeon in the browser, built from Japan's open indoor map of
the real station. three.js + Vite, no framework. The design and the plan for the rest of the
Tokyo network are in `docs/design.md`. Read it before adding features.

Jason's memory repo (`jedelman/claude-memory`) holds the session logs. Start with
`conversations/2026-11-10-tokyo-megadungeon.md`, which has the research, the Bluesky archetypes with
links, and the data survey. Its CLAUDE.md sets the daily-journal convention, which applies here too.

## Commands

```bash
npm install                 # .npmrc sets legacy-peer-deps (npm's resolver trips on vitest's optional peers)
npm run data                # rebuild public/data/{shinjuku,tokyo}.json from the raw zips (needs: pip install pyshp shapely)
npm test                    # vitest: data, level 0's route, collision, kitten clips bind + animate
npm run build               # dist/
npx vite preview --port 4173 &  node tests/smoke.mjs   # headless Chromium: screenshots, rides, outside, finish
```

Query params for testing: `?play` skips the title, `?x=&z=&o=&yaw=` spawns anywhere (metres from
Shinjuku Station, x east, z south, o = floor), `?fps` shows fps, `?nosnap` turns off vertex snapping,
`?day=YYYY-MM-DD` sets the real day, `?chart=YYYY-MM-DD` casts tonight's sky for that date instead,
`?patches=id@YYYY-MM-DD,...` replays exact patches.
`window.__game` exposes state.

## Data and licences: these rules are not optional

- **MLIT indoor maps** (`data/raw/`, `public/data/{shinjuku,tokyo}.json`): 政府標準利用規約（第2.0版）, compatible
  with CC BY 4.0. Copying, adapting and commercial use are allowed **with both credit lines**, verbatim:
  「出典：国土交通省 高精度測位社会プロジェクト」 and, because we process it,
  「「新宿駅周辺屋内地図データ」（国土交通省）（https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2）を加工して作成」.
  Tokyo's second line is the same with 「東京駅周辺屋内地図データ」 and `mlit-indoor-tokyo-r2`.
  Never present the result as made by the government. Logos are outside the licence.
- **OpenStreetMap** (`data/osm/`, ODbL 1.0, "© OpenStreetMap contributors" in the game's credits): used for
  Astra's route, and for platforms and tracks (`tools/filter_rail.py` → `data/osm/rail-*.osm.gz` → `tools/build_rail.py`
  → `public/data/{shinjuku,tokyo}-rail.json`, ODbL files of their own; MLIT doesn't map platforms). `tools/build_astra.py` merges it with MLIT + ほこナビ into `public/data/shinjuku-astra.json`, which is
  therefore an ODbL derivative database (its `meta.license` says so). Keep OSM out of the MLIT-only files
  (`shinjuku.json`, `tokyo.json`). From cloud sessions, Overpass is blocked by the network policy, but the main API
  works: `https://api.openstreetmap.org/api/0.6/map?bbox=...` for station-sized boxes. Don't route around the block.
- **ほこナビ walking-network data** (`data/raw/hokonavi/`): Public Data License 1.0 (CC BY 4.0-compatible).
  Credit each dataset and say we processed it; see that folder's README. The three Oedo station sets are a
  limited release (gone from the portal after 2027-03-12), which is why they're committed.
- **PLATEAU** (fetched, not committed): we choose CC BY 4.0. Credit 「3D都市モデル（Project PLATEAU）新宿区（2025年度）」（国土交通省）を加工して作成.
- **Tokyo Metropolitan Government** Shinjuku terminal data (fetched, not committed): CC BY, credit 東京都都市整備局.
- The full source inventory with dataset ids is in `docs/design.md`.
- Code is MIT (`LICENSE`).

## Content rules

- **No real departure melodies.** They're copyrighted compositions (Hibiya's has been the Godzilla theme
  since 2026-11-03). Every station gets an original one.
- **No operator logos or marks** (Tokyo Metro, Toei, JR, Odakyu, Keio, Seibu). Real exit codes, station
  names and gate names are facts and fine. Wayfinding colours can echo reality without copying marks.
- **Don't recreate other games.** MegaMan Legends lends a shape (a town above, ruins below, PS1 3D,
  a chase camera), never its characters, art or names. The Exit 8 owns "looping corridor, spot the
  anomaly". This game is a real corridor that doesn't loop; it only feels like it does.
- The 1995 sarin attack is never content. Because the time warp drops you into a date's night in this underground,
  `SOMBRE` in `src/sky.js` lists nights that are never drawn or choosable: the sarin attack, the 1923 earthquake, the
  war years (Jason, 2026-11-10; 18 September 1931 to 2 September 1945, the 十五年戦争 span), the 1944–45 air raids on
  Tokyo, 11 March 2011. Add to it when in doubt; never remove a date.
- If the shoulder-checking man (ぶつかりおじさん) ever appears, it's real gendered harassment: the player
  beats it. It's never a joke at the player's expense.

## How it's built

- **Stations:** `tools/build_mlit.py <zip> <out> <station>` with an origin per station in `STATIONS` (Shinjuku's
  must never move: levels use its coordinates). A floor directory can hold several file sets, one per
  sub-facility; Tokyo's subway folder has one per station, labelled in `SUBSET_EN` (each checked against real
  station coordinates). Levels live in `src/levels.js` with a `station`; `main.js` loads
  `data/<station>.json` per level, and the title card lists the levels. `tests/tokyo.test.js` checks every level's
  goal gate, start and route, and that each card's length is honest.
- **Astra's route** (`tools/build_astra.py`, level 2): MLIT's Shinjuku core plus ほこナビ's Tochomae floor plans and
  network, the 2021 network's underground links, and OSM underground walkways at both ends, all in Shinjuku's frame,
  through `build_mlit.main(..., extra=...)`. Stitching is narrow on purpose: different sources within 3 m on a floor;
  OSM dead ends join the nearest node within 15 m (mapping gaps); and **one explicit level seam** (Times Avenue's
  end, OSM level −1, is Tochomae's B2). Don't add generic cross-level joins: a generic rule caught four spots nobody
  could vouch for. Connectors are traced through branching stair landings (Toei Tochomae's branch).
- `tools/build_mlit.py`: zip (Shift-JIS names) → JSON in local metres. Walkable area per floor = floor
  outlines (seams < 0.8 m closed) minus solid rooms, voids and columns; walkway spaces win over rooms
  drawn on top of them. **The walking network is ground truth for connectivity:** its links are carved
  in 1.8 m wide, except through shops, toilets and the like. Walls are the walkable area's edges, tagged
  by what's behind them. Stairs, escalators and lifts become connectors between whole floors.
- `src/nav.js` (no three.js, so it's testable): wall grid, point-in-area, collide-and-slide, network
  Dijkstra.
- `src/ps1.js`: 240-line target, vertex snapping, affine UVs (uv·w trick), 15-bit + Bayer dither, linear fog.
  `src/world.js` builds per-floor meshes (long triangles are split so affine texturing holds up).
  `src/main.js` runs the loop, camera, rides, the outside rule and the HUD. `src/input.js` handles keys,
  gamepad and touch.
- `src/kitten.js`: the player, with mofusand-like *proportions* (Jason, 2026-11-10): a big round head, big low-set eyes,
  a round body on stubby legs. Only the proportions: her coat, pack and wand are her own; don't copy a mofusand
  character. Rigid segments on named joints (PS1-style, no skin), animated by **three's
  `AnimationMixer`** with clips authored in code: idle, sit, walk, trot, gallop, hop. Gaits are weighted by
  speed and phase-locked; the cycle advances by distance over stride length, so paws plant. New clips go in
  `makeClips()`; `tests/kitten.test.js` fails if a track names a joint that doesn't exist. **Not R3F:** R3F is
  a React renderer and adds no animation (drei's `useAnimations` wraps this same mixer). If React is ever
  wanted for other reasons, this module mounts as a `<primitive>` unchanged.
- `src/people.js`: lost property, the lost-and-found counter (owners leave word there), and lost wanderers you
  can help only if you've been to their destination. `plan()` is pure and seeded by level + date (`?day=` overrides
  it for tests). `Store` keeps rewards, counts and visited places in localStorage (`md.progress`,
  `md.visited.<station>`). Shinjuku's counter location is sourced (`LOST_AND_FOUND`); elsewhere it's a game
  placement at a real station office, and the game says so. `tests/people.test.js` covers plans, reachability,
  rewards and persistence; the smoke test runs pickup → return → reward and a wanderer before and after a visit.
- `src/patches.js` + `patches/*.json`: the dungeon as a quilt, after Rise Up Comus (Joshy Mcroo), "The Elemental Level
  of Megadungeon Construction". A patch is 4–5 rooms: a heart (kernel: explore / talk / run), rooms around it, one
  blank the assembler stitches to another patch, and a gate (a real connector to another underground floor). Patches
  name *kinds* of place, never coordinates; `sew()` is pure, seeded by tonight's chart + level, and places up to four per level on
  real places within a 75 m walk. Patches are data and may come from friends: `checkPatch()` enforces the recipe and
  caps, the game escapes their text, and the content rules above apply to them. `tests/patches.test.js` checks every
  file and every level; the smoke test plays each kernel. Format: `patches/README.md`.
- `src/sky.js` + `src/arcana.js`: **the chart is the seed.**
  - **The sky.** Each real day draws a random date (1900–2099), and the game casts its horoscope for Tokyo at 00:00
    JST: Sun, Moon, five planets, the Ascendant, whole-sign houses, from our own Schlyter ephemeris. `?chart=YYYY-MM-DD`
    picks the date. `tests/sky.test.js` checks it against astronomy-engine (dev only, pinned; don't ship it).
  - **The spread.** The chart deals major arcana (Golden Dawn attributions) to the patches by real depth (walk to an
    exit plus its climb). The layout and connections follow His Majesty the Worm's Appendix E (Rise Up Comus): lowest
    card = way in, highest = deepest, I–V have ways up (known above the horizon, sealed below).
  - **Connections.** Table neighbours are walked (chalk stitches); sequential or divisible cards that aren't neighbours
    are wand portals in the blanks. Jason: "Yep, magic portals are in."
  - **Seeding.** `plan()` and `sew()` take a day string or a chart; both seed from `skySeed(chart, level + purpose)`.
  - **A chart makes the patch.** `placePatch(ctx, patch, date, station)` places a patch from its own date's chart and
    nothing else, so `id@YYYY-MM-DD` is an address: `?patches=a@d,b@d` replays exact patches (the finish card links
    tonight's), and tests pin addresses. Tonight's sky picks each patch's date (redrawing until it lies clear) and still
    deals the cards. Inside a patch you're in its night: its date on the HUD, its season's fog, and its season drifting
    down (petals, fireflies, osmanthus, ginkgo, snow).
- `src/critters.js`: the station's small animals: ドバト pigeons by the exits, クマネズミ black rats in the deep (they come to a
  still kitten), ニホンヤモリ geckos on walls by the lights, オカダンゴムシ pill bugs that roll up when bumped, and ツバメ
  swallows nesting over patches whose night is April–August. `census()` is pure, seeded by tonight's chart; placement
  is a game ecology by depth, not survey data. **Every field-note fact has a source URL in `SOURCES`**
  (`tests/critters.test.js` enforces it): don't add a fact you haven't checked. The `Store` keeps field notes
  (`notes`).
- `src/trains.js` + `src/crowd.js` + `src/blocks.js`: trains, tanuki and the crowd.
  - **Trains.** They run on OSM tracks snapped to MLIT's real platform edges (`build_rail.py` drops any it can't place
    off the walkable floor). `timetable()` is pure and seeded by tonight's chart. About one arrival in six is tanuki,
    stacked into a train shape (偽汽車, the Meiji phantom-train tales), with a sourced field note (`TANUKI.sources`).
  - **The world.** `World` turns the walls between a platform and its track into platform doors (frames, so you can see
    through) and draws the track bed and tunnel.
  - **The crowd.** Goofy commuters walk the walking network near the kitten, wait on platforms, and board stopped
    trains. They thin out in patches and fade between the camera and the kitten.
  - **Cost.** Use `blocks.js` (`B`, `S`, `merged`) for anything made of many little boxes: one mesh, not hundreds.
- `node tests/gaits.mjs` (with `vite preview` running) saves side-on frames of trot, gallop and sit.
- `node tests/phone.mjs`: a Pixel 7 held sideways. The title card must fit, a tap must start the game, and a
  thumb drag must move the kitten. Run it after any UI change; it caught the dead tap (the title card covered
  the canvas, which was the only thing listening).
- **Camera: no pull-in.** Jason (2026-11-10): "It's fine if the camera clips through a wall as long as we make
  the wall translucent, that way corners are still playable. Getting cornered in Bloodborne sucks." The camera
  keeps its distance; walls, glass, stairs and signs between it and the kitten turn to screen-door (mesh)
  transparency in the PS1 shader (`solidity()` in `ps1.js`, materials with `fade: true`). Floors and
  ceilings never fade.
- Fullscreen is only ever requested inside a tap/click handler (the title card, the ⛶ button), never from the
  render loop. `public/manifest.webmanifest` makes add-to-home-screen launch fullscreen and landscape.
- Floors are ordinals only; `FH` (5 m) and `CH` (3.1 m) in `world.js` are design choices, not data.

## Git

- Commits are authored by Claude through the cloud session's global git config (signed). Don't set a
  repo-local identity.
- **Merge authority (Jason, 2026-11-10): "Merge authority: yes. Go nuts."** "PR: no need [to watch]. Like
  I said, go nuts." Open a PR per change and merge it yourself once tests and the smoke run pass. Don't wait
  for review. The content and licence rules above still hold.
- **Deploy:** Cloudflare Workers Builds, wired by Jason 2026-11-10. Every push to `main` deploys to
  **https://shinjuku-megadungeon.jason-edelman.org**. `wrangler.jsonc` has `build.command`, so `wrangler deploy`
  builds first even if the dashboard's build command is blank. Node is pinned by `.node-version`. After a merge,
  check the live site serves the new build (`curl` the page and `/data/shinjuku.json`). Build logs are only on
  the Cloudflare dashboard.
