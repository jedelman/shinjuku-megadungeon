# MLIT walking-navigation open data (ほこナビDP)

From MLIT's 歩行空間ナビゲーションデータプラットフォーム open-data site, https://ckan.hokonavi.go.jp, downloaded
2026-11-10. **The three station datasets are a limited release:** they're published only during the Public
Transportation Open Data Challenge 2026, until 2027-03-12. That's why they're archived here rather than fetched.

Licence: **公共データ利用規約（第1.0版）** (Public Data License 1.0, Digital Agency,
https://www.digital.go.jp/resources/open_data/public_data_license_v1.0), compatible with CC BY 4.0. Free use
including commercial, with credit. If you process the data, say so.

| file | dataset id | what |
|---|---|---|
| `station_oedo_tochomae__stationmap_*.zip` | `station_oedo_tochomae` | Toei Oedo Tochomae station floor plans (構内地図データ), floors 1, B1–B3 |
| `station_oedo_tochomae__nwd_*.zip` | `station_oedo_tochomae` | its walking network |
| `station_oedo_shinjuku__stationmap_*.zip` | `station_oedo_shinjuku` | Toei Oedo Shinjuku station floor plans, floors 1, B1–B3, B5, **B6** |
| `station_oedo_shinjuku__nwd_*.zip` | `station_oedo_shinjuku` | its walking network |
| `station_oedo_shinjukunishiguchi__stationmap_*.zip` | `station_oedo_shinjukunishiguchi` | Toei Oedo Shinjuku-nishiguchi floor plans, B0.5, B1, B3, B4 |
| `station_oedo_shinjukunishiguchi__nwd_*.zip` | `station_oedo_shinjukunishiguchi` | its walking network |
| `nwd_shibuya_sendagaya_shinjuku__{link,node}.geojson.gz` | `nwd_shibuya_sendagaya_shinjuku` | walking network for Shibuya, Sendagaya and Shinjuku (2021-05-26), 7,921 links, gzipped |

The station floor plans follow the same spec as the MLIT Shinjuku indoor map (階層別屋内地理空間情報データ仕様書), so
`tools/build_mlit.py`'s readers apply. The station zips have Shift-JIS-free names; the GeoJSON is JGD2011 lon/lat.

Coverage notes (measured 2026-11-10):
- Tochomae's plans end ~280 m west of where the MLIT Shinjuku map stops. The 2021 network has underground
  passage links (`rt_struct` 5, floor −1) along that stretch.
- Around Shinjuku-sanchome, the Metro Promenade's east end and Nishi-Shinjuku, the 2021 network is street level
  only. Those stretches still need OpenStreetMap.

Credit, per dataset: 出典：国土交通省「歩行空間ネットワークデータ（都営地下鉄大江戸線 都庁前駅）」 (and likewise for
新宿駅, 新宿西口駅, and 「歩行空間ネットワークデータ（東京都渋谷区・渋谷駅、千駄ヶ谷駅周辺／東京都新宿区・新宿駅周辺）」).
When used in the game: 「…」（国土交通省）（https://ckan.hokonavi.go.jp）を加工して作成.
