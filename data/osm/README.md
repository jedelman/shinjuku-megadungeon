# OpenStreetMap extracts

© OpenStreetMap contributors. Available under the Open Database License (ODbL 1.0):
https://opendatacommons.org/licenses/odbl/1-0/ · https://www.openstreetmap.org/copyright

Downloaded 2026-11-10 from the OSM main API (`/api/0.6/map`), unmodified apart from gzip (the `rail-*` files keep
only railway features):

| file | bbox (lon, lat) | what it's for |
|---|---|---|
| `nishi-shinjuku-west.osm.gz` | 139.6905, 35.6890 – 139.6980, 35.6960 | the 4号街路 passage west, Tochomae, タイムズアベニュー, Nishi-Shinjuku (exits E5–E9, platforms) |
| `shinjuku-sanchome-east.osm.gz` | 139.7010, 35.6890 – 139.7070, 35.6935 | メトロプロムナード and Shinjuku-sanchome |
| `rail-shinjuku.osm.gz` | 139.6950, 35.6860 – 139.7060, 35.6950, plus the two above | platforms and track centrelines only (`tools/filter_rail.py`) |
| `rail-tokyo.osm.gz` | 139.7600, 35.6670 – 139.7720, 35.6885 (three boxes) | platforms and track centrelines only (`tools/filter_rail.py`) |

`tools/build_astra.py` combines these with MLIT's Shinjuku indoor map and ほこナビ data into
`public/data/shinjuku-astra.json`. **That combined file is a derivative database of OSM, so it is also under
ODbL 1.0**, with the MLIT and ほこナビ credits carried alongside. The MLIT-only files (`shinjuku.json`, `tokyo.json`)
contain no OSM data and keep their own terms.

`tools/build_rail.py` makes `public/data/shinjuku-rail.json` and `public/data/tokyo-rail.json` from the `rail-*` files
(placing each platform on an MLIT floor and snapping tracks to MLIT's platform edges uses the MLIT geometry only to
decide where, and copies none of it in). They are OSM derivative databases under ODbL 1.0.
