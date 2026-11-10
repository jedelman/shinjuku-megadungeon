# Patches

The dungeon is written in small pieces and sewn onto the real station like a quilt. The recipe is Rise Up Comus's
(Joshy Mcroo), from ["The Elemental Level of Megadungeon Construction"](https://riseupcomus.blogspot.com/2026/09/the-elemental-level-of-megadungeon.html)
([the challenge on Bluesky](https://bsky.app/profile/riseupcomus.bsky.social/post/3mumgdofhl22k)):

1. Start with a kernel: a reason to explore, a reason to talk, a reason to run away.
2. Build 2–3 rooms around it.
3. Connect an intentionally blank room. The assembler fills it.
4. Put a gate that connects to another level.
5. Give it an evocative name.

Here a **room** is a real place in the station: a ticket gate, an exit, a station office. A patch's rooms are real
places within a 75 m walk of each other on one floor. Its **gate** is a real stair, escalator or lift to another
underground floor. You write a patch against *kinds* of place, never coordinates, so it sews into Shinjuku, Tokyo or
any station we add. Each day the game sews up to four patches onto each level, somewhere new (`src/patches.js`, `sew()`).

## The format

One JSON file per patch, named after it (`the-last-shutter.json`):

```json
{
  "name": "The Last Shutter",
  "by": "Claude",
  "kernel": "run",
  "idea": "Closing time. The shutters along this stretch are coming down.",
  "rooms": [
    { "role": "heart", "at": "any", "say": ["…"], "found": ["…"], "missed": ["…"] },
    { "role": "room", "at": "exit", "prop": "cart", "say": ["…"] },
    { "role": "room", "say": ["…"] },
    { "role": "blank" },
    { "role": "gate", "say": ["…"] }
  ]
}
```

- `kernel` is one of these:
  - `explore`: the heart's `found` comes once you've reached every `room`. The optional `then` line sends you back to the heart.
  - `talk`: someone stands at the heart. Listen, and they say `say`, then tell you where today's nearest lost thing is.
  - `run`: reaching the heart starts a clock. Reach the gate in time for `found`, or hear `missed`.
- `rooms`: 4 or 5 in all, with exactly one `heart`, at least one `room`, exactly one `blank` and one or two `gate`s.
- `at` is `gate`, `exit`, `office` or `any` (the default). It's the kind of real place the room sits on. Ask for less and
  your patch fits more places.
- `prop` is optional: `vending`, `bench` or `cart`, stood against the nearest wall.
- A `blank` has no text. The assembler stitches it to another patch ("Chalked on the floor: an arrow, and 'Three Chalk
  Cats', 140 m") or, if it's alone, to the lost-and-found.
- The game adds the gate's real kind and floor ("Stairs to B1F"). Don't say "up" or "down": you don't know which it is.
- Lines are plain text, at most 4 per field and 160 characters each. `tests/patches.test.js` fails on any patch that
  breaks the recipe. The game leaves a broken patch out rather than crash.

## The rules that apply to everyone's patches

Patches are read like any outside input, so they're capped and escaped. The game's content rules
(`CLAUDE.md`) hold for them too:
- No real departure melodies.
- No operator logos or marks.
- Nothing recreated from another game.
- The 1995 sarin attack is never content.
- The shoulder-checking man only ever appears to be beaten.

Credit yourself in `by`. Send a patch as a pull request with one file.
