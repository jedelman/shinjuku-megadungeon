#!/usr/bin/env python3
"""Astra's route: Shinjuku-sanchome -> Nishi-Shinjuku without surfacing.

  python3 tools/build_astra.py      -> public/data/shinjuku-astra.json

Combines four sources in Shinjuku's local frame:
  - MLIT's Shinjuku indoor map (the core; build_mlit.py does the heavy lifting),
  - ほこナビ: Toei Oedo Tochomae station floor plans + network, and the 2021 walking network's underground links,
  - OpenStreetMap underground walkways at both ends (メトロプロムナード to Sanchome; 4号街路, Tochomae, タイムズアベニュー,
    Nishi-Shinjuku).
Because it contains OSM data, the output is a derivative database under ODbL 1.0 (data/osm/README.md).

Stitching (each rule is narrow on purpose):
  - nodes from different sources within 3 m on the same floor are joined;
  - an OSM way that dead-ends joins the nearest node on its floor within 15 m (OSM mapping gaps, e.g. the 4号街路
    walkway and the Tochomae-bound footway don't share an end node);
  - one explicit level seam: Times Avenue's end (OSM level -1) is 4.1 m from a Toei Tochomae network node on B2,
    where an unlevelled OSM staircase also ends. One place, two level numbers.
"""
import collections, gzip, io, json, math, os, sys, zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_mlit as B  # noqa: E402
from shapely.geometry import shape, LineString, Polygon  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(REPO, "data", "raw")
HOKO = os.path.join(RAW, "hokonavi")
OSM = [os.path.join(REPO, "data", "osm", f) for f in ("nishi-shinjuku-west.osm.gz", "shinjuku-sanchome-east.osm.gz")]
OUT = os.path.join(REPO, "public", "data", "shinjuku-astra.json")
NWD_BOX = (139.688, 35.686, 139.708, 35.698)

SEAMS = [  # (x, z, floor, source) <-> (x, z, floor, source), why
    ((-712.2, 67.5, -1.0, "osm"), (-710.4, 63.8, -2.0, "toch"), "タイムズアベニュー end (OSM level -1) = Tochomae B2 (4.1 m)"),
]
WIDTH = {"footway": 3.0, "corridor": 3.0, "pedestrian": 5.0, "steps": 2.0, "path": 2.5}


def zip_geojson(path):
    out = {}
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if n.endswith(".geojson"):
                out[os.path.basename(n)] = json.loads(z.read(n).decode("utf-8"))
    return out


def local_line(coords):
    return [[B.r2(x), B.r2(z)] for x, z in (B.xy(lon, lat) for lon, lat, *_ in coords)]


def extra(per, nodes, links, exits, gates, offices):
    src = ["mlit"] * len(nodes)

    def node(x, z, o, s):
        nodes.append([B.r2(x), B.r2(z), float(o)])
        src.append(s)
        return len(nodes) - 1

    def link(a, b, t=1, p=None):
        if p is None:
            p = [nodes[a][:2], nodes[b][:2]]
        d = sum(math.hypot(q[0] - r[0], q[1] - r[1]) for q, r in zip(p, p[1:]))
        links.append({"a": a, "b": b, "t": t, "d": round(d, 1), "dir": 1, "p": p})

    # --- ほこナビ Tochomae: floor plans (same spec as MLIT) and network
    plans = zip_geojson(os.path.join(HOKO, "station_oedo_tochomae__stationmap_oedo_tochomae_geojson.zip"))
    sets = collections.defaultdict(dict)
    for name, fc in plans.items():
        prefix, lvl, kind = name[:-8].rsplit("_", 2)
        sets[(prefix, lvl)][kind] = fc
    for (prefix, lvl), files in sets.items():
        if "Floor" not in files:
            continue
        o = float(files["Floor"]["features"][0]["properties"]["ordinal"])
        P = per[o]
        for f in files["Floor"]["features"]:
            g = B.to_local(shape(f["geometry"])).buffer(0)
            (P["floor_out"] if str(f["properties"].get("category")) == "2" else P["floor"]).append(g)
        for f in files.get("Space", {}).get("features", []):
            pr = f["properties"]
            g = B.to_local(shape(f["geometry"])).buffer(0)
            if pr.get("category") in B.SOLID or str(pr.get("restricted")) == "1":
                P["solid"].append(g); P["solid_kind"].append(B.WALL_KIND.get(pr.get("category"), "staff")); P["solid_cat"].append(pr.get("category"))
            elif pr.get("category") in B.WALKWAY:
                P["walkway"].append(g)
        for f in files.get("Fixture", {}).get("features", []):
            if f["properties"].get("category") == "C001":
                P["cols"].append(B.to_local(shape(f["geometry"])).buffer(0))
        for f in files.get("Facility", {}).get("features", []):
            pr = f["properties"]
            if pr.get("category") == "F108" and (pr.get("name") or "").strip():
                x, z = B.xy(*f["geometry"]["coordinates"][:2])
                exits.append({"n": pr["name"].strip(), "closed": False, "o": o, "x": B.r2(x), "z": B.r2(z), "fac": "Oedo line · Tochomae"})
    nwd = zip_geojson(os.path.join(HOKO, "station_oedo_tochomae__nwd_oedo_tochomae_geojson.zip"))
    ids = {}
    for f in nwd["node.geojson"]["features"]:
        pr = f["properties"]
        ids[pr["node_id"]] = node(*B.xy(pr["lon"], pr["lat"]), float(pr["floor"]), "toch")
    for f in nwd["link.geojson"]["features"]:
        pr = f["properties"]
        if pr["start_id"] in ids and pr["end_id"] in ids:
            t = int(pr.get("route_type") or 1)
            link(ids[pr["start_id"]], ids[pr["end_id"]], t if t in (1, 4, 5, 6, 7) else 1, local_line(f["geometry"]["coordinates"]))

    # --- ほこナビ 2021 network: underground links only, inside the Shinjuku box; they also widen into corridors
    with gzip.open(os.path.join(HOKO, "nwd_shibuya_sendagaya_shinjuku__node.geojson.gz")) as fh:
        N = json.load(fh)["features"]
    with gzip.open(os.path.join(HOKO, "nwd_shibuya_sendagaya_shinjuku__link.geojson.gz")) as fh:
        L = json.load(fh)["features"]
    ids = {}
    for f in N:
        pr = f["properties"]
        if float(pr.get("floor") or 0) < 0 and NWD_BOX[0] <= pr["lon"] <= NWD_BOX[2] and NWD_BOX[1] <= pr["lat"] <= NWD_BOX[3]:
            ids[pr["node_id"]] = node(*B.xy(pr["lon"], pr["lat"]), float(pr["floor"]), "nwd21")
    for f in L:
        pr = f["properties"]
        a, b = ids.get(pr["start_id"]), ids.get(pr["end_id"])
        if a is None or b is None:
            continue
        p = local_line(f["geometry"]["coordinates"])
        link(a, b, 1 if nodes[a][2] == nodes[b][2] else 6, p)
        if nodes[a][2] == nodes[b][2] and len(p) >= 2:
            per[nodes[a][2]]["walkway"].append(LineString(p).buffer(1.5))

    # --- OpenStreetMap underground walkways
    osm_exits = []
    for path in OSM:
        with gzip.open(path) as fh:
            root = ET.parse(fh).getroot()
        ll = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in root.iter("node")}
        entrances = {}
        for n in root.iter("node"):
            t = {k.get("k"): k.get("v") for k in n.findall("tag")}
            if t.get("railway") == "subway_entrance" and t.get("ref"):
                entrances[n.get("id")] = t
        ways = []
        for w in root.iter("way"):
            t = {k.get("k"): k.get("v") for k in w.findall("tag")}
            hw = t.get("highway")
            if not (hw in WIDTH or hw == "elevator" or t.get("railway") == "platform" or t.get("indoor") == "corridor"):
                continue
            levels = []
            for v in t.get("level", "").replace(",", ";").split(";"):
                try:
                    levels.append(float(v))
                except ValueError:
                    pass
            ly = t.get("layer", "")
            if not levels and (ly.startswith("-") or t.get("tunnel") in ("yes", "building_passage") or t.get("location") == "underground"):
                try:
                    levels = [float(ly)] if ly else [-1.0]
                except ValueError:
                    levels = [-1.0]
            if not levels or min(levels) >= 0:
                continue
            refs = [r for r in (nd.get("ref") for nd in w.findall("nd")) if r in ll]
            if len(refs) >= 2:
                ways.append((refs, levels, t))
        on_level = collections.defaultdict(set)
        for refs, lv, t in ways:
            if len(lv) == 1:
                for r in refs:
                    on_level[r].add(lv[0])
        made = {}

        def get(r, lvl):
            if (r, lvl) not in made:
                made[(r, lvl)] = node(*B.xy(*ll[r]), lvl, "osm")
                if r in entrances:
                    osm_exits.append((entrances[r], made[(r, lvl)]))
            return made[(r, lvl)]
        for refs, lv, t in ways:
            pts = [list(B.xy(*ll[r])) for r in refs]
            if len(lv) == 1:
                o = lv[0]
                for a, b in zip(refs, refs[1:]):
                    link(get(a, o), get(b, o), 1)
                try:
                    wdt = float(t.get("width", "").split()[0])
                except (ValueError, IndexError):
                    wdt = WIDTH.get(t.get("highway"), 3.0)
                closed = refs[0] == refs[-1] and len(refs) > 3
                if closed and (t.get("area") == "yes" or t.get("railway") == "platform" or t.get("highway") == "pedestrian"):
                    per[o]["walkway"].append(Polygon(pts).buffer(0))
                else:
                    per[o]["walkway"].append(LineString(pts).buffer(max(1.0, wdt / 2)))
            else:
                lo, hi = min(lv), max(lv)
                ea, eb = next(iter(on_level[refs[0]]), None), next(iter(on_level[refs[-1]]), None)
                la = ea if ea in (lo, hi) else (hi if eb == lo else lo)
                lb = hi if la == lo else lo
                link(get(refs[0], la), get(refs[-1], lb), 4 if t.get("highway") == "elevator" else 6, [pts[0], pts[-1]])

    # OSM entrances become exits (skipping ones MLIT already has nearby under the same name)
    for t, k in osm_exits:
        x, z, o = nodes[k]
        if any(e["n"] == t["ref"] and math.hypot(e["x"] - x, e["z"] - z) < 40 for e in exits):
            continue
        exits.append({"n": t["ref"], "closed": False, "o": o, "x": x, "z": z, "fac": (t.get("name") or "OSM").split(";")[0]})

    # --- stitch
    cell = collections.defaultdict(list)
    for i, (x, z, o) in enumerate(nodes):
        cell[(o, int(x // 3), int(z // 3))].append(i)
    deg = collections.Counter()
    for l in links:
        deg[l["a"]] += 1; deg[l["b"]] += 1
    joined = set()
    for i, (x, z, o) in enumerate(nodes):
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for j in cell.get((o, int(x // 3) + dx, int(z // 3) + dz), []):
                    if j > i and src[i] != src[j] and (i, j) not in joined and math.hypot(nodes[j][0] - x, nodes[j][1] - z) < 3:
                        link(i, j); joined.add((i, j))
    gaps = 0
    for i, (x, z, o) in enumerate(nodes):
        if src[i] != "osm" or deg[i] != 1 or o >= 0:
            continue
        best, bd = None, 15.0
        for dx in range(-5, 6):
            for dz in range(-5, 6):
                for j in cell.get((o, int(x // 3) + dx, int(z // 3) + dz), []):
                    d = math.hypot(nodes[j][0] - x, nodes[j][1] - z)
                    if j != i and d < bd and (min(i, j), max(i, j)) not in joined and d > 0.01:
                        bd, best = d, j
        if best is not None:
            link(i, best); joined.add((min(i, best), max(i, best))); gaps += 1
    for (ax, az, ao, asrc), (bx, bz, bo, bsrc), why in SEAMS:
        i = min((k for k in range(len(nodes)) if src[k] == asrc and nodes[k][2] == ao), key=lambda k: math.hypot(nodes[k][0] - ax, nodes[k][1] - az))
        j = min((k for k in range(len(nodes)) if src[k] == bsrc and nodes[k][2] == bo), key=lambda k: math.hypot(nodes[k][0] - bx, nodes[k][1] - bz))
        link(i, j, 6)
    print(f"astra: +{collections.Counter(src[len(src) - (len(src) - src.count('mlit')):])} nodes; "
          f"{len(joined)} stitches, {gaps} gap joins, {len(SEAMS)} seam(s)")


META = {
    "station": "shinjuku-astra",
    "license": "ODbL 1.0 (combined database, contains OpenStreetMap data)",
    "credits": [
        "出典：国土交通省 高精度測位社会プロジェクト",
        "「新宿駅周辺屋内地図データ」（国土交通省）（https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2）を加工して作成",
        "「歩行空間ネットワークデータ（都営地下鉄大江戸線 都庁前駅）」（国土交通省）（https://ckan.hokonavi.go.jp）を加工して作成",
        "「歩行空間ネットワークデータ（東京都渋谷区・渋谷駅、千駄ヶ谷駅周辺／東京都新宿区・新宿駅周辺）」（国土交通省）（https://ckan.hokonavi.go.jp）を加工して作成",
        "© OpenStreetMap contributors (ODbL 1.0)",
    ],
}

if __name__ == "__main__":
    B.main(os.path.join(RAW, "mlit-shinjuku-indoor-shapefile.zip"), OUT, "shinjuku", extra=extra, meta_extra=META)
