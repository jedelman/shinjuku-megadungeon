# Raw data

`mlit-shinjuku-indoor-shapefile.zip`: MLIT's 新宿駅周辺屋内地図オープンデータ, Shapefile edition, as downloaded
from G-Spatial (dataset `mlit-indoor-shinjuku-r2`, 令和2年度更新版) by Jason on 2026-11-10.
sha256 `b005f0ca0433554c796ae903969491649ed2846b96a2afbd33594c77081e5dec`.

- 16 facility folders split by floor, plus `nw/` (the walking network). Filenames inside the zip are Shift-JIS.
- Facility files dated Aug 2020. The network files date from Sept 2018, which may be before the July 2020
  East–West free passage opened (unchecked).
- Per its metadata, it was built from the 2016 Shinjuku Terminal Map and 1:200 floor plans, with no field
  survey. The station has changed since.
- Spec: 階層別屋内地理空間情報データ仕様書（案）, on the dataset page.

Licence: 新宿駅周辺屋内地図オープンデータ利用規約 (2020-10-27), based on 政府標準利用規約（第2.0版）, compatible with
CC BY 4.0. Credit: 「出典：国土交通省 高精度測位社会プロジェクト」. If you process it, also add
「「新宿駅周辺屋内地図データ」（国土交通省）（https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2）を加工して作成」.
Third-party rights may exist in parts of the content; logos are excluded.

## Tokyo Station area

`mlit-tokyo-indoor-shapefile.zip`: MLIT's 東京駅周辺屋内地図オープンデータ（令和2年度更新版）, Shapefile edition (dataset
`mlit-indoor-tokyo-r2`), downloaded by Jason on 2026-11-10. sha256 `c7a79ea9e141721cd6f9dba443ba9bd9120a0bcba025597b83e755a6ab3acec1`.

- 17 facility folders (JR Tokyo; subway and public passages; the Marunouchi towers; KITTE; Tokyo International Forum;
  Yurakucho Itocia and Marion; Otemori; Tekko Building…) plus `nw/` (`Tokyo_node`, `Tokyo_Link`).
- **The subway folder holds one file set per station in each floor directory** (`ChiyodaHibiya_B1_*`,
  `GinzaGinza_B1_*`, `MaruTokyo_B1_*`, `Tozai_B1_*`…, 16 on B1). The pipeline groups files by prefix; reading one
  set per directory silently drops most of the subway.
- 3,368 network nodes, ~36 km of walkways (incl. 270 m of slopes, `route_type` 7), floors B2–1F, 144 exits
  (A5 and B9 marked closed).
- Licence: 東京駅周辺屋内地図オープンデータ利用規約, same terms as Shinjuku's. Credit 「出典：国土交通省 高精度測位社会プロジェクト」
  and 「「東京駅周辺屋内地図データ」（国土交通省）（https://www.geospatial.jp/ckan/dataset/mlit-indoor-tokyo-r2）を加工して作成」.
- Not to be confused with the dataset's 全体版 PDF, a 3-page overview drawing, not data.
