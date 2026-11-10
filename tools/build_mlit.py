#!/usr/bin/env python3
"""Turn MLIT's Shinjuku indoor map (Shapefile zip) into the game's world JSON.

Usage: python3 tools/build_mlit.py <zip> <out.json> <station>     (station: shinjuku | tokyo)
  e.g. python3 tools/build_mlit.py data/raw/mlit-tokyo-indoor-shapefile.zip public/data/tokyo.json tokyo

Needs: pip install pyshp shapely

Source: 「新宿駅周辺屋内地図データ」（国土交通省）
(https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2) を加工して作成.
Codes follow the dataset's spec, 階層別屋内地理空間情報データ仕様書（案）.
"""
import io, json, math, os, re, sys, tempfile, zipfile, collections

import shapefile  # pyshp
import shapely
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

# Each station gets its own local frame, origin at the station. Shinjuku's must not move: levels use its coordinates.
STATIONS = {
    "shinjuku": {"origin": (139.7000, 35.6910), "dataset": "mlit-indoor-shinjuku-r2", "name": "新宿駅周辺屋内地図データ"},
    "tokyo": {"origin": (139.767125, 35.681236), "dataset": "mlit-indoor-tokyo-r2", "name": "東京駅周辺屋内地図データ"},
}
LON0, LAT0 = STATIONS["shinjuku"]["origin"]
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 111000.0

# Spaces that block walking (rooms, voids, closed areas). Everything else on a floor is walkable.
SOLID = {f"B{n:03d}" for n in range(1, 21)} | {"B026", "B027"}
# Spaces people walk through: stairs, lifts, escalators, moving walkways, slopes, platforms, concourses, decks.
WALKWAY = {"B021", "B022", "B023", "B024", "B025", "B028", "B029", "B030"}
WALL_KIND = {  # what's behind a wall, for colour
    "B001": "shop", "B002": "office", "B003": "public", "B004": "wait", "B005": "ticket", "B006": "info",
    "B007": "wc", "B008": "wc", "B009": "wc", "B010": "wc", "B011": "wc", "B012": "wc", "B013": "wc",
    "B014": "wc", "B015": "smoke", "B016": "nursing", "B017": "aid", "B018": "staff", "B019": "room",
    "B020": "void", "B026": "staff", "B027": "parking",
}
FACILITY_EN = {
    "1.JR新宿駅改札": "JR gates", "2.JR新宿駅新南改札": "JR New South gate", "3.JR新宿駅": "JR Shinjuku",
    "4.ルミネ": "Lumine", "5.東京メトロ新宿駅": "Metro Marunouchi", "6.小田急新宿駅_小田急エース": "Odakyu / Odakyu Ace",
    "7.京王新宿駅_京王モールアネックス": "Keio / Keio Mall Annex", "8.京王モール": "Keio Mall", "9.都営新宿駅": "Toei Shinjuku",
    "10.都営新宿西口駅": "Toei Shinjuku-nishiguchi", "11.サブナード": "Subnade", "12.西武新宿駅": "Seibu Shinjuku",
    "13.西口周辺": "West Exit", "14.バスタ新宿": "Busta Shinjuku", "15.NEWoMan": "NEWoMan", "16.other": "other",
    # Tokyo Station area
    "1.JR東京駅": "JR Tokyo", "2.地下鉄_公共通路": "Subway passages", "3.丸ビル": "Marunouchi Building",
    "4.新丸ビル": "Shin-Marunouchi Building", "5.TOKIA": "TOKIA", "6.丸の内ブリックスクエア": "Marunouchi Brick Square",
    "8.三菱UFJ信託銀行本店ビル": "Mitsubishi UFJ Trust Bank", "9.丸の内オアゾ": "Marunouchi OAZO",
    "10.三菱商事ビル": "Mitsubishi Corporation Building", "11.KITTE": "KITTE", "12.東京交通会館": "Tokyo Kotsu Kaikan",
    "13.有楽町イトシア": "Yurakucho Itocia", "14.有楽町マリオン": "Yurakucho Marion", "15.オーテモリ": "Otemori",
    "16.東京国際フォーラム": "Tokyo International Forum", "17.鉄鋼ビルディング": "Tekko Building",
}


# Tokyo's subway folder holds one file set per station. Names come from the prefixes, and each was checked
# against the real station's coordinates (ja.wikipedia, 2026-11-10): every set lies within ~310 m of its station.
SUBSET_EN = {
    "ChiyodaHibiya": "Chiyoda line · Hibiya", "ChiyodaNiju": "Chiyoda line · Nijubashimae",
    "ChiyodaOtemati": "Chiyoda line · Otemachi", "GinzaGinza": "Ginza line · Ginza", "Hanzo": "Hanzomon line · Otemachi",
    "HibiyaGinza": "Hibiya line · Ginza", "HibiyaHibiya": "Hibiya line · Hibiya", "HibiyaHigagin": "Hibiya line · Higashi-Ginza",
    "MaruGinza": "Marunouchi line · Ginza", "MaruOtemati": "Marunouchi line · Otemachi", "MaruTokyo": "Marunouchi line · Tokyo",
    "MitaHibiya": "Mita line · Hibiya", "MitaOtemati": "Mita line · Otemachi", "Tozai": "Tozai line · Otemachi",
    "YurakuTika": "Yurakucho underground", "Yurakucho": "Yurakucho",
}


def xy(lon, lat):
    return ((lon - LON0) * KX, -(lat - LAT0) * KY)   # x east, z south (three.js)


def to_local(geom):
    import numpy as np, shapely
    def f(c):
        return np.column_stack([(c[:, 0] - LON0) * KX, -(c[:, 1] - LAT0) * KY])
    return shapely.transform(geom, f)


def reader(path):
    for enc in ("utf-8", "cp932"):
        try:
            r = shapefile.Reader(path, encoding=enc)
            r.records()
            return r
        except UnicodeDecodeError:
            pass
    return shapefile.Reader(path, encoding="cp932", encodingErrors="replace")


def extract(zpath, dst):
    with zipfile.ZipFile(zpath) as z:
        for i in z.infolist():
            name = i.filename if i.flag_bits & 0x800 else i.filename.encode("cp437").decode("cp932")
            out = os.path.realpath(os.path.join(dst, name))
            if not out.startswith(os.path.realpath(dst) + os.sep):
                raise SystemExit("unsafe path in zip: " + name)
            if i.is_dir():
                continue
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with z.open(i) as f, open(out, "wb") as g:
                g.write(f.read())
    tops = [d for d in os.listdir(dst) if os.path.isdir(os.path.join(dst, d))]
    return os.path.join(dst, tops[0])


def polys(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    return [p for p in getattr(g, "geoms", []) if isinstance(p, Polygon)]


def r2(v):
    return round(v, 2)


def ring_out(ring):
    pts = list(ring.coords)[:-1]
    return [[r2(x), r2(z)] for x, z in pts]


def main(zpath, out, station="shinjuku"):
    global LON0, LAT0, KX
    cfg = STATIONS[station]
    LON0, LAT0 = cfg["origin"]
    KX = 111320.0 * math.cos(math.radians(LAT0))
    tmp = tempfile.mkdtemp()
    root = extract(zpath, tmp)
    per = collections.defaultdict(lambda: {"floor": [], "floor_out": [], "solid": [], "solid_kind": [],
                                           "solid_cat": [], "walkway": [], "cols": []})
    exits, gates = [], []
    def read_set(files, fac, prefix=''):
            if "Floor" not in files:
                return
            fr = reader(files["Floor"])
            o = fr.records()[0].ordinal
            P = per[o]
            for s, rec in zip(fr.shapes(), fr.records()):
                g = to_local(shape(s.__geo_interface__)).buffer(0)
                (P["floor_out"] if rec.category == "2" else P["floor"]).append(g)
            if "Space" in files:
                sr = reader(files["Space"])
                for s, rec in zip(sr.shapes(), sr.records()):
                    g = to_local(shape(s.__geo_interface__)).buffer(0)
                    if rec.category in SOLID or rec.restricted == "1":
                        P["solid"].append(g)
                        P["solid_kind"].append(WALL_KIND.get(rec.category, "staff"))
                        P["solid_cat"].append(rec.category)
                    elif rec.category in WALKWAY:
                        P["walkway"].append(g)
            if "Fixture" in files:
                xr = reader(files["Fixture"])
                for s, rec in zip(xr.shapes(), xr.records()):
                    if rec.category == "C001":
                        P["cols"].append(to_local(shape(s.__geo_interface__)).buffer(0))
            if "Facility" in files:
                cr = reader(files["Facility"])
                for s, rec in zip(cr.shapes(), cr.records()):
                    if rec.category == "F108" and s.points:
                        x, z = xy(*s.points[0])
                        name = (rec.name or "").strip()
                        exits.append({"n": re.sub(r"\s*[（(]閉鎖中[）)]", "", name), "closed": "閉鎖" in name,
                                      "o": o, "x": r2(x), "z": r2(z), "fac": SUBSET_EN.get(prefix) or FACILITY_EN.get(fac, fac.split('.', 1)[-1])})
            if "Opening" in files:
                orr = reader(files["Opening"])
                for s, rec in zip(orr.shapes(), orr.records()):
                    if len(s.points) >= 2:
                        (x1, z1), (x2, z2) = xy(*s.points[0]), xy(*s.points[-1])
                        n = (rec.name or "").strip()
                        gates.append({"n": "" if n == "不明" else n, "o": o,
                                      "a": [r2(x1), r2(z1)], "b": [r2(x2), r2(z2)]})

    for fac in sorted(os.listdir(root)):
        fdir = os.path.join(root, fac)
        if not os.path.isdir(fdir) or fac == "nw":
            continue
        for lvl in sorted(os.listdir(fdir)):
            d = os.path.join(fdir, lvl)
            if not os.path.isdir(d):
                continue
            # A floor directory can hold several file sets, one per sub-facility (Tokyo's subway folder has a set
            # per station: ChiyodaHibiya_B1_*, GinzaGinza_B1_*, ...). Group by the prefix before <level>_<Kind>.
            sets = collections.defaultdict(dict)
            for f in os.listdir(d):
                if f.endswith(".shp") and f.count("_") >= 2:
                    prefix, _lvl, kind = f[:-4].rsplit("_", 2)
                    sets[prefix][kind] = os.path.join(d, f)
            for prefix, files in sets.items():
                read_set(files, fac, prefix)


    # walking network
    nwd = os.path.join(root, "nw")
    shp = {f.lower(): os.path.join(nwd, f[:-4]) for f in os.listdir(nwd) if f.lower().endswith(".shp")}
    N = reader(next(v for k, v in shp.items() if "node" in k))
    Lk = reader(next(v for k, v in shp.items() if "link" in k))
    ids, nodes = {}, []
    for rec in N.records():
        x, z = xy(rec.lon, rec.lat)
        ids[rec.node_id] = len(nodes)
        nodes.append([r2(x), r2(z), rec.ordinal])
    links = []
    for s, rec in zip(Lk.shapes(), Lk.records()):
        a, b = ids[rec.start_id], ids[rec.end_id]
        pts = [[r2(px), r2(pz)] for px, pz in (xy(*q) for q in s.points)]
        links.append({"a": a, "b": b, "t": int(rec.route_type), "d": rec.distance,
                      "dir": int(rec.direction), "p": pts})

    floors = {}
    for o in sorted(per):
        P = per[o]
        allfloor = unary_union(P["floor"] + P["floor_out"])
        outdoor = unary_union(P["floor_out"]).difference(unary_union(P["floor"])) if P["floor_out"] else Polygon()
        walkway = unary_union(P["walkway"]) if P["walkway"] else Polygon()
        # close seams (< ~0.8 m) between neighbouring facilities' floor outlines
        base = unary_union([allfloor, walkway]).buffer(0.4, join_style="mitre").buffer(-0.4, join_style="mitre")
        cols = unary_union(P["cols"]) if P["cols"] else Polygon()
        # walkways win over rooms drawn on top of them
        solid = unary_union(P["solid"]).difference(walkway) if P["solid"] else Polygon()
        # the walking network is ground truth for connectivity: carve it in (1.8 m wide), except
        # through shops, toilets and the like ("other room", B019, is often a passage the network uses)
        hard = unary_union([g for g, c in zip(P["solid"], P["solid_cat"]) if c != "B019"]) if P["solid"] else Polygon()
        lines = [LineString(l["p"]) for l in links
                 if l["t"] in (1, 7) and nodes[l["a"]][2] == o and nodes[l["b"]][2] == o and len(l["p"]) >= 2]
        carve = unary_union([ln.buffer(0.9) for ln in lines]).difference(hard).difference(cols) if lines else Polygon()
        walk = unary_union([base.difference(unary_union([solid, cols])), carve]).buffer(0)
        walk = walk.simplify(0.05)
        walk = unary_union([p for p in polys(walk) if p.area > 2.0])     # drop slivers
        walk = shapely.set_precision(walk, 0.01)                         # valid at the 1 cm grid we export
        tree = STRtree(P["solid"]) if P["solid"] else None
        ctree = STRtree(P["cols"]) if P["cols"] else None
        walls = []
        for p in polys(walk):
            for ring in [p.exterior, *p.interiors]:
                cs = list(ring.coords)
                for (x1, z1), (x2, z2) in zip(cs[:-1], cs[1:]):
                    L = math.hypot(x2 - x1, z2 - z1)
                    if L < 0.05:
                        continue
                    kind = "edge"
                    # probe both sides of the segment, take the side that isn't walkable
                    mx, mz = (x1 + x2) / 2, (z1 + z2) / 2
                    nx, nz = -(z2 - z1) / L, (x2 - x1) / L
                    for sgn in (1, -1):
                        q = Point(mx + sgn * nx * 0.25, mz + sgn * nz * 0.25)
                        if walk.contains(q):
                            continue
                        if ctree is not None and any(P["cols"][i].buffer(0.05).contains(q) for i in ctree.query(q)):
                            kind = "col"
                        elif tree is not None:
                            for idx in tree.query(q):
                                if P["solid"][idx].contains(q):
                                    kind = P["solid_kind"][idx]
                                    break
                    walls.append([r2(x1), r2(z1), r2(x2), r2(z2), kind])
        cols = []
        for c in P["cols"]:
            for p in polys(c.simplify(0.03)):
                cols.append(ring_out(p.exterior))
        floors[str(o)] = {
            "walk": [[ring_out(p.exterior)] + [ring_out(h) for h in p.interiors] for p in polys(walk)],
            "outdoor": [[ring_out(p.exterior)] + [ring_out(h) for h in p.interiors]
                        for p in polys(shapely.set_precision(outdoor.intersection(walk), 0.01)) if p.area > 0.5],
            "walls": walls,
            "cols": cols,
            "area": round(walk.area),
        }

    # vertical connectors: from an integer-floor node, follow stairs/escalator/lift links through
    # half-floor landings until another integer floor is reached
    adj = collections.defaultdict(list)
    for i, l in enumerate(links):
        adj[l["a"]].append((l["b"], i, True))
        adj[l["b"]].append((l["a"], i, False))
    isint = lambda o: abs(o - round(o)) < 1e-6
    conns, seen = [], set()
    for start, (sx, sz, so) in enumerate(nodes):
        if not isint(so):
            continue
        for nb, li, fwd in adj[start]:
            if links[li]["t"] not in (4, 5, 6, 7):
                continue
            path_nodes, path_links, cur, prev, ok = [start], [li], nb, start, True
            while not isint(nodes[cur][2]):
                nxt = [(n2, l2) for n2, l2, _ in adj[cur] if n2 != prev and links[l2]["t"] in (1, 4, 5, 6, 7)]
                if len(nxt) != 1:
                    ok = False
                    break
                prev, (cur, l2) = cur, nxt[0]
                path_nodes.append(prev)
                path_links.append(l2)
            if not ok or nodes[cur][2] == so:
                continue
            key = tuple(sorted((start, cur))) + (links[li]["t"],)
            if key in seen:
                continue
            seen.add(key)
            path_nodes.append(cur)
            pts = []
            for k, l2 in enumerate(path_links):
                lp = links[l2]["p"] if links[l2]["a"] == path_nodes[k] else links[l2]["p"][::-1]
                o1, o2 = nodes[path_nodes[k]][2], nodes[path_nodes[k + 1]][2]
                for j, (px, pz) in enumerate(lp):
                    if pts and j == 0:
                        continue
                    f = j / max(len(lp) - 1, 1)
                    pts.append([px, pz, round(o1 + (o2 - o1) * f, 3)])
            types = {links[l2]["t"] for l2 in path_links} - {1}
            t = 4 if 4 in types else 5 if 5 in types else 7 if 7 in types and 6 not in types else 6
            conns.append({"t": t, "a": start, "b": cur, "p": pts})

    out_obj = {
        "meta": {
            "station": station,
            "source": f"「{cfg['name']}」（国土交通省）（https://www.geospatial.jp/ckan/dataset/{cfg['dataset']}）を加工して作成",
            "credit": "出典：国土交通省 高精度測位社会プロジェクト",
            "license": "政府標準利用規約（第2.0版）, compatible with CC BY 4.0",
            "origin": [LON0, LAT0], "units": "metres, x east, z south",
        },
        "floors": floors, "exits": exits, "gates": gates,
        "nodes": nodes, "links": [[l["a"], l["b"], l["t"], l["d"]] for l in links], "conns": conns,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(out_obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"floors {sorted(floors, key=float)}; walls {sum(len(v['walls']) for v in floors.values())}; "
          f"cols {sum(len(v['cols']) for v in floors.values())}; exits {len(exits)}; gates {len(gates)}; "
          f"nodes {len(nodes)}; links {len(links)}; connectors {len(conns)}; {os.path.getsize(out)//1024} KB")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "shinjuku")
