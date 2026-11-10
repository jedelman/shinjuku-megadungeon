// Level 0 lies wholly inside MLIT's Shinjuku data. Astra's route (Shinjuku-sanchome → Nishi-Shinjuku)
// needs ~530 m of corridor that the data doesn't cover; it comes next, from OSM.
export const LEVELS = [
  {
    id: 'seibu-b2-to-keio-new-line',
    title: 'Seibu Shinjuku B2 → 京王新線口',
    brief: "It's cold outside. Walk to the Keio New Line gate without going up to the street.",
    start: { x: 28.81, z: -426.74, o: -2, yaw: Math.PI }, // just out of the stairwell from Seibu Shinjuku
    goal: { gate: '京王新線口', o: -1, radius: 6 },
  },
];
