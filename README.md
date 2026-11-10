# Shinjuku Megadungeon

新宿ダンジョン. Shinjuku Station as a PS1-era megadungeon, walkable in the browser and built from the
real station's open indoor map: eight floors from B3 up to the bus terminal on 4F, 1,153 rooms,
605 columns, 150 named exits and 32 km of walkways.

It started from one question on Bluesky ([@astrra.space](https://bsky.app/profile/astrra.space/post/3mzws5xcevk2m)):

> it's cold outside today. i wonder if you can walk all the way from shinjuku-sanchome to nishishinjuku only using underground passages (so, no trains and no going outside)

You're a kitten, 30 cm tall, with a backpack and a magic wand. At that size the station is about six
times bigger than it is for everyone else.

That's the rule here. Two levels so far, each a real walk that never surfaces:

- **Level 0 · 新宿 Shinjuku:** from the foot of the Seibu Shinjuku stairs on B2 to the Keio New Line gate on B1, 1.1 km.
- **Level 2 · Astra's route:** Shinjuku-sanchome to Nishi-Shinjuku, 1.8 km: the Metro Promenade, the West Exit
  underground plaza, the 4号街路 passage to Tochomae, then Times Avenue. Exactly the walk Astra asked about.
- **Level 1 · 東京 Tokyo:** from Higashi-Ginza's Tsukiji-side gate (Hibiya line) to Otemachi's 大手町二丁目方面改札,
  2.7 km through the Ginza, Hibiya, Yurakucho, Nijubashimae and Otemachi concourses.

Along the way: lost property (no use to a kitten, but its owner left word at the lost-and-found, and they'll
give you something useful), and lost people you can help, if you've been where they're going.

The dungeon itself is a quilt of **patches**, after Rise Up Comus's
["The Elemental Level of Megadungeon Construction"](https://riseupcomus.blogspot.com/2026/09/the-elemental-level-of-megadungeon.html).
Each patch has 4–5 rooms on real places: a heart with a reason to explore, talk or run, rooms around it, a blank that
stitches it to the next patch, and a gate to another floor. They're sewn somewhere new each day. Patches are small
JSON files written against kinds of place, so anyone can write one and it fits any station: see `patches/README.md`.

Each night has a sky. The game casts a horoscope for Tokyo at midnight on a random date (one per day; `?chart=YYYY-MM-DD`
picks your own), and the chart deals a tarot spread onto the patches. It follows the underworld procedure in Rise Up
Comus's *His Majesty the Worm*: the lowest card is the way in, the highest is the deepest patch (measured from the real
exits), and cards I–V have ways up to the street, sealed if their card was below the horizon. Cards that connect but
aren't neighbours open portals, cast with the kitten's wand.

A chart makes the patch: each patch is placed by the horoscope of its own night, so it has an address, like
`the-last-shutter@1927-12-30`, that always gives the same patch. Step into it and you're in that night: its date on the
HUD, its season's light, and cherry petals, fireflies, osmanthus, ginkgo or snow drifting down the corridor. The finish
card links tonight's patches; `?patches=a@d,b@d` replays any.

## Play

- **Keyboard:** WASD or arrows to walk, Shift for zoomies, drag or Q / C to look, E for stairs, escalators and lifts, R to restart.
- **Gamepad:** left stick to walk, right stick to look, Ⓐ to take stairs, Ⓑ / RT for zoomies, Start to restart.
- **Phone:** play in landscape. Left thumb walks, right thumb looks, and a ▲▼ button appears at stairs.

Live: https://shinjuku-megadungeon.jason-edelman.org

## Run it

```bash
npm install
npm run dev
```

## Credits

Map data: 出典：国土交通省 高精度測位社会プロジェクト.
「新宿駅周辺屋内地図データ」（国土交通省）（https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2）を加工して作成.
「東京駅周辺屋内地図データ」（国土交通省）（https://www.geospatial.jp/ckan/dataset/mlit-indoor-tokyo-r2）を加工して作成.
Astra's route also uses 「歩行空間ネットワークデータ（都営地下鉄大江戸線 都庁前駅）」 and 「歩行空間ネットワークデータ（東京都渋谷区・渋谷駅、千駄ヶ谷駅周辺／東京都新宿区・新宿駅周辺）」
（国土交通省）（https://ckan.hokonavi.go.jp）を加工して作成, Public Data License 1.0, and OpenStreetMap data,
© OpenStreetMap contributors, under the ODbL. Its combined data file (`public/data/shinjuku-astra.json`) is
therefore under the ODbL 1.0.
Patch structure after Rise Up Comus (Joshy Mcroo), "The Elemental Level of Megadungeon Construction" (2026); the
underworld layout after his *His Majesty the Worm*, Appendix E. Planet positions: our own implementation of Paul
Schlyter's method, tested against astronomy-engine (MIT, development only).
Used under the Government of Japan Standard Terms of Use (2.0), compatible with CC BY 4.0. The map has
been processed for this game: walls, collision and floor connections are derived from it.

Code: MIT.
