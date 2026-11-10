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
npm run data                # rebuild public/data/shinjuku.json from the raw zip (needs: pip install pyshp shapely)
npm test                    # vitest: data integrity, level 0's route, collision never leaves the walkable area
npm run build               # dist/
npx vite preview --port 4173 &  node tests/smoke.mjs   # headless Chromium: screenshots, rides, outside, finish
```

Query params for testing: `?play` skips the title, `?x=&z=&o=&yaw=` spawns anywhere (metres from
Shinjuku Station, x east, z south, o = floor), `?fps` shows fps, `?nosnap` turns off vertex snapping.
`window.__game` exposes state.

## Data and licences: these rules are not optional

- **MLIT indoor map** (`data/raw/`, `public/data/shinjuku.json`): 政府標準利用規約（第2.0版）, compatible
  with CC BY 4.0. Copying, adapting and commercial use are allowed **with both credit lines**, verbatim:
  「出典：国土交通省 高精度測位社会プロジェクト」 and, because we process it,
  「「新宿駅周辺屋内地図データ」（国土交通省）（https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2）を加工して作成」.
  Never present the result as made by the government. Logos are outside the licence.
- **OpenStreetMap** (not used yet): ODbL. When it arrives, keep it in its own files (`data/osm/`) with an
  ODbL notice and "© OpenStreetMap contributors" in the game's credits. Don't mix it into the MLIT JSON.
  From cloud sessions, Overpass is blocked by the network policy, but the main API works:
  `https://api.openstreetmap.org/api/0.6/map?bbox=...` for station-sized boxes. Don't route around the block.
- Code is MIT (`LICENSE`).

## Content rules

- **No real departure melodies.** They're copyrighted compositions (Hibiya's has been the Godzilla theme
  since 2026-11-03). Every station gets an original one.
- **No operator logos or marks** (Tokyo Metro, Toei, JR, Odakyu, Keio, Seibu). Real exit codes, station
  names and gate names are facts and fine. Wayfinding colours can echo reality without copying marks.
- **Don't recreate other games.** MegaMan Legends lends a shape (a town above, ruins below, PS1 3D,
  a chase camera), never its characters, art or names. The Exit 8 owns "looping corridor, spot the
  anomaly". This game is a real corridor that doesn't loop; it only feels like it does.
- The 1995 sarin attack is never content.
- If the shoulder-checking man (ぶつかりおじさん) ever appears, it's real gendered harassment: the player
  beats it. It's never a joke at the player's expense.

## How it's built

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
- Floors are ordinals only; `FH` (5 m) and `CH` (3.1 m) in `world.js` are design choices, not data.

## Git

- Commits are authored by Claude through the cloud session's global git config (signed). Don't set a
  repo-local identity.
- Merge policy: **not set yet.** Until Jason says otherwise, work on a branch and open a draft PR; Jason merges.
