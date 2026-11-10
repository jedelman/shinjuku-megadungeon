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
];
