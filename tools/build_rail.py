"""Platforms and tracks from OpenStreetMap, in a station's frame, for the trains.

    python3 tools/build_rail.py <station> <rail.osm.gz> <station.json> <out.json>

MLIT's indoor maps don't mark platforms or tracks, so they come from OSM (filtered by tools/filter_rail.py). Each
platform is placed on the MLIT floor whose walkable area it overlaps most (OSM's level numbers don't always match
MLIT's floors), measured as a rotated rectangle, and the tracks alongside its long sides are found from the OSM track
centrelines. The output mixes OSM with nothing else, and is an ODbL database like its source.
"""
import gzip
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(__file__))
import build_mlit as M  # noqa: E402

TRACK = {"subway", "rail", "light_rail", "narrow_gauge", "monorail"}
# wayfinding colours by line name (colours echo reality; no marks or logos)
COLOURS = [
    ("丸ノ内", "#f62e36"), ("大江戸", "#b6007a"), ("都営地下鉄新宿線", "#6cbb5a"), ("副都心", "#9c5e31"),
    ("小田急", "#3a75c4"), ("京王新線", "#dd0077"), ("京王", "#dd0077"), ("山手", "#9acd32"), ("緩行", "#ffd400"),
    ("総武", "#ffd400"), ("中央", "#f15a22"), ("埼京", "#00ac9a"), ("湘南新宿", "#e86a10"), ("銀座", "#ff9500"),
    ("日比谷", "#b5b5ac"), ("千代田", "#00bb85"), ("東西", "#009bbf"), ("半蔵門", "#8f76d6"), ("有楽町", "#c1a470"),
    ("南北", "#00ac9b"), ("三田", "#0079c2"), ("浅草", "#ec6e65"), ("京葉", "#c9242f"), ("横須賀", "#0067c0"),
    ("京浜東北", "#00b2e5"), ("東海道", "#f68b1e"), ("新幹線", "#2a5caa"),
]


def colour(name):
    for k, c in COLOURS:
        if k in (name or ""):
            return c
    return "#9aa0a6"


def levels(tags):
    """OSM's level (or, failing that, layer) as numbers; MLIT's floors are within one of it"""
    for k in ("level", "layer"):
        v = tags.get(k)
        if v:
            try:
                return [float(x) for x in v.replace(",", ";").split(";") if x.strip()]
            except ValueError:
                pass
    return None


def near_level(o, lv):
    return lv is None or any(abs(o - x) <= 1 for x in lv)


def main(station, osm_path, station_json, out):
    lon0, lat0 = M.STATIONS[station]["origin"]
    kx, ky = 111320.0 * math.cos(math.radians(lat0)), M.KY

    def xy(lon, lat):
        return ((lon - lon0) * kx, -(lat - lat0) * ky)

    with gzip.open(osm_path, "rb") as f:
        root = ET.parse(f).getroot()
    nodes = {n.get("id"): xy(float(n.get("lon")), float(n.get("lat"))) for n in root.iter("node")}
    plats, tracks = [], []
    for w in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        refs = [r.get("ref") for r in w.findall("nd") if r.get("ref") in nodes]
        if len(refs) < 2:
            continue
        pts = [nodes[r] for r in refs]
        if tags.get("railway") == "platform" or tags.get("public_transport") == "platform":
            g = Polygon(pts).buffer(0) if refs[0] == refs[-1] and len(refs) >= 4 else LineString(pts).buffer(2.0, cap_style=2)
            if g.area > 20:
                plats.append((w.get("id"), g, tags))
        elif tags.get("railway") in TRACK:
            tracks.append((w.get("id"), LineString(pts), tags))

    data = json.load(open(station_json))
    walk = {}
    for k, fl in data["floors"].items():
        polys = [Polygon(p[0], p[1:]) for p in fl["walk"] if len(p[0]) >= 3]
        walk[k] = unary_union([p.buffer(0) for p in polys])

    out_platforms, out_tracks = [], []
    for pid, g, tags in plats:
        # the floor it lies on: most overlap with walkable area, near OSM's level (stacked floors fool 2D overlap)
        lv = levels(tags)
        best, bk = 0.0, None
        for k, wa in walk.items():
            if not near_level(float(k), lv):
                continue
            a = g.intersection(wa).area / g.area
            if a > best:
                best, bk = a, k
        if bk is None or best < (0.5 if lv is not None else 0.6):
            continue   # not on any floor we can walk, or not sure which
        o = float(bk)
        rect = g.minimum_rotated_rectangle
        cs = list(rect.exterior.coords)[:4]
        e1 = (cs[1][0] - cs[0][0], cs[1][1] - cs[0][1])
        e2 = (cs[2][0] - cs[1][0], cs[2][1] - cs[1][1])
        l1, l2 = math.hypot(*e1), math.hypot(*e2)
        (ux, uz), L, W = ((e1[0] / l1, e1[1] / l1), l1, l2) if l1 >= l2 else ((e2[0] / l2, e2[1] / l2), l2, l1)
        if L < 30 or W < 2:
            continue
        cx, cz = rect.centroid.x, rect.centroid.y
        nx, nz = -uz, ux
        mine = []
        for side in (-1, 1):
            found = None
            for tid, line, ttags in tracks:
                if lv is not None and levels(ttags) is not None and not any(abs(a - b) <= 1 for a in lv for b in levels(ttags)):
                    continue   # a line on another level, passing above or below
                ds = []
                seg = line.segmentize(2.0)
                c = list(seg.coords)
                for i in range(len(c) - 1):
                    px, pz = c[i]
                    dx, dz = c[i + 1][0] - px, c[i + 1][1] - pz
                    dl = math.hypot(dx, dz)
                    if dl < 1e-6 or abs((dx * ux + dz * uz) / dl) < 0.94:
                        continue
                    t = (px - cx) * ux + (pz - cz) * uz
                    d = (px - cx) * nx + (pz - cz) * nz
                    if abs(t) <= L / 2 and W / 2 + 0.3 <= side * d <= W / 2 + 5.0:
                        ds.append(d)
                if len(ds) >= 3:
                    ds.sort()
                    off = ds[len(ds) // 2]
                    if found is None or abs(off) < abs(found[0]):
                        found = (off, tid, ttags)
            if not found:
                continue
            off, tid, ttags = found
            # OSM and MLIT disagree by a metre or three: run the train just past MLIT's real platform edge. The edge is
            # the strongest long wall line parallel to the platform on this side (kiosks on the platform are holes, so
            # a ray across would stop short at them); if there isn't one, leave this side without trains
            bins = {}
            for x1, z1, x2, z2, kind in data["floors"][bk]["walls"]:
                if kind in ("col", "shop"):
                    continue
                wl = math.hypot(x2 - x1, z2 - z1)
                if wl < 0.5 or abs(((x2 - x1) * ux + (z2 - z1) * uz) / wl) < 0.95:
                    continue
                mx, mz = (x1 + x2) / 2, (z1 + z2) / 2
                t = (mx - cx) * ux + (mz - cz) * uz
                d = side * ((mx - cx) * nx + (mz - cz) * nz)
                if abs(t) <= L / 2 and W / 2 - 3 <= d <= W / 2 + 6:
                    b = round(d * 2) / 2
                    bins[b] = bins.get(b, 0) + wl
            if not bins:
                continue
            # a wall line split across neighbouring bins is still one line: weigh each bin with its neighbours
            near = {b: sum(v for c, v in bins.items() if abs(c - b) <= 0.75) for b in bins}
            line = max(near, key=lambda b: near[b])
            if near[line] < 0.25 * L:
                continue
            edge = sum(c * v for c, v in bins.items() if abs(c - line) <= 0.75) / near[line]
            # the train must run off the walkable floor: nudge it out up to 1.5 m until at most a tenth of its
            # length crosses walkable area (a platform end, a stair); if it never does, no trains on this side
            off = None
            for extra in (0, 0.5, 1.0, 1.5):
                o2 = side * (edge + 1.7 + extra)
                tx, tz = cx + nx * o2, cz + nz * o2
                inside = sum(walk[bk].contains(Point(tx + ux * k * L, tz + uz * k * L)) for k in [i / 20 - 0.45 for i in range(19)])
                if inside <= 1:
                    off = o2
                    break
            if off is None:
                continue
            # one train per real track: side platforms either side of it share it
            px, pz = cx + nx * off, cz + nz * off
            ti = None
            for j, tr in enumerate(out_tracks):
                if tr["o"] == o and tr["way"] == tid and abs((px - tr["p"][0]) * tr["n"][0] + (pz - tr["p"][1]) * tr["n"][1]) < 2.5:
                    ti = j
                    break
            if ti is None:
                name = ttags.get("name") or tags.get("name") or ""
                out_tracks.append({"way": tid, "o": o, "p": [round(px, 2), round(pz, 2)], "u": [round(ux, 4), round(uz, 4)],
                                   "n": [round(nx * side, 4), round(nz * side, 4)], "line": name, "colour": colour(name),
                                   "stops": [], "L": round(L, 1)})
                ti = len(out_tracks) - 1
            tr = out_tracks[ti]
            stop = round((cx - tr["p"][0]) * tr["u"][0] + (cz - tr["p"][1]) * tr["u"][1], 2)
            tr["stops"].append(stop)
            tr["L"] = max(tr["L"], round(L, 1))
            mine.append({"track": ti, "side": side, "off": round(off, 2)})
        if not mine:
            continue
        out_platforms.append({"o": o, "c": [round(cx, 2), round(cz, 2)], "u": [round(ux, 4), round(uz, 4)],
                              "L": round(L, 1), "W": round(W, 1), "name": tags.get("name") or tags.get("ref") or "",
                              "on": round(best, 2), "tracks": mine})
    for tr in out_tracks:
        tr["stop"] = round(sum(tr["stops"]) / len(tr["stops"]), 2)
        del tr["stops"]
    meta = {"source": "© OpenStreetMap contributors", "license": "ODbL-1.0 (https://opendatacommons.org/licenses/odbl/1-0/)",
            "from": os.path.basename(osm_path), "floors": os.path.basename(station_json), "station": station}
    json.dump({"meta": meta, "platforms": out_platforms, "tracks": out_tracks}, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{out}: {len(out_platforms)} platforms, {len(out_tracks)} tracks")
    for p in out_platforms:
        print("  ", p["o"], p["name"], p["L"], "x", p["W"], "on", p["on"], [(out_tracks[t["track"]]["line"], t["side"]) for t in p["tracks"]])


if __name__ == "__main__":
    main(*sys.argv[1:])
