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
Used under the Government of Japan Standard Terms of Use (2.0), compatible with CC BY 4.0. The map has
been processed for this game: walls, collision and floor connections are derived from it.

Code: MIT.
