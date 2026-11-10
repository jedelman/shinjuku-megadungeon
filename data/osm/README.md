# OpenStreetMap extracts

© OpenStreetMap contributors. Available under the Open Database License (ODbL 1.0):
https://opendatacommons.org/licenses/odbl/1-0/ · https://www.openstreetmap.org/copyright

Downloaded 2026-11-10 from the OSM main API (`/api/0.6/map`), unmodified apart from gzip:

| file | bbox (lon, lat) | what it's for |
|---|---|---|
| `nishi-shinjuku-west.osm.gz` | 139.6905, 35.6890 – 139.6980, 35.6960 | the 4号街路 passage west, Tochomae, タイムズアベニュー, Nishi-Shinjuku (exits E5–E9, platforms) |
| `shinjuku-sanchome-east.osm.gz` | 139.7010, 35.6890 – 139.7070, 35.6935 | メトロプロムナード and Shinjuku-sanchome |

`tools/build_astra.py` combines these with MLIT's Shinjuku indoor map and ほこナビ data into
`public/data/shinjuku-astra.json`. **That combined file is a derivative database of OSM, so it is also under
ODbL 1.0**, with the MLIT and ほこナビ credits carried alongside. The MLIT-only files (`shinjuku.json`, `tokyo.json`)
contain no OSM data and keep their own terms.
