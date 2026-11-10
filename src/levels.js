// Levels. Each lies wholly inside one station's MLIT indoor map; `station` names public/data/<station>.json.
// Astra's route (Shinjuku-sanchome → Nishi-Shinjuku) needs ~530 m of corridor beyond the data; it comes from OSM.
export const LEVELS = [
  {
    id: 'seibu-b2-to-keio-new-line',
    station: 'shinjuku',
    place: '新宿 Shinjuku',
    title: 'Seibu Shinjuku B2 → 京王新線口',
    length: '1.1 km',
    start: { x: 28.81, z: -426.74, o: -2, yaw: Math.PI }, // just out of the stairwell from Seibu Shinjuku
    goal: { gate: '京王新線口', o: -1, radius: 6 },
  },
  {
    id: 'higashi-ginza-to-otemachi',
    station: 'tokyo',
    place: '東京 Tokyo',
    title: '東銀座 築地方面改札 → 大手町二丁目方面改札',
    length: '2.7 km',
    start: { x: 88.59, z: 1406.06, o: -1, yaw: Math.PI }, // Higashi-Ginza, by the Tsukiji-side gate
    goal: { gate: '大手町二丁目方面改札', o: -1, radius: 6 },
  },
  {
    // Astra's question (@astrra.space, 2026-11-10): "i wonder if you can walk all the way from shinjuku-sanchome to
    // nishishinjuku only using underground passages (so, no trains and no going outside)". kira's answer:
    // 新宿三丁目 → メトロプロムナード → 新宿西口地下広場 → 都庁前 → ... → 西新宿. Built from MLIT + ほこナビ + OSM (ODbL).
    id: 'astra-sanchome-to-nishi-shinjuku',
    station: 'shinjuku-astra',
    region: 'shinjuku',            // same station as level 0: places you've been count in both
    place: "新宿 Astra's route",
    title: '新宿三丁目 → 西新宿, no trains, no going outside',
    length: '1.8 km',
    start: { x: 376.08, z: -18.05, o: -2, yaw: Math.PI }, // Shinjuku-sanchome (Marunouchi line)
    goal: { at: { x: -652.75, z: -375.17 }, o: -1, name: '西新宿駅', radius: 8 },
  },
];
