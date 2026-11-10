"""Keep only the railway from OpenStreetMap extracts: platforms and track centrelines, with their nodes.

    python3 tools/filter_rail.py out.osm.gz in1.osm[.gz] in2.osm[.gz] ...

The inputs are station-sized boxes from the OSM main API (https://api.openstreetmap.org/api/0.6/map?bbox=...).
The output is an ODbL extract (© OpenStreetMap contributors), small enough to commit; tools/build_rail.py reads it.
"""
import gzip
import sys
import xml.etree.ElementTree as ET

KEEP_RAILWAY = {"platform", "subway", "rail", "light_rail", "narrow_gauge", "monorail"}


def opened(path):
    return gzip.open(path, "rb") if path.endswith(".gz") else open(path, "rb")


def main(out, inputs):
    nodes, ways = {}, {}
    for path in inputs:
        with opened(path) as f:
            root = ET.parse(f).getroot()
        for n in root.iter("node"):
            nodes[n.get("id")] = (n.get("lat"), n.get("lon"))
        for w in root.iter("way"):
            tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
            if tags.get("railway") in KEEP_RAILWAY or tags.get("public_transport") == "platform":
                ways[w.get("id")] = ([nd.get("ref") for nd in w.findall("nd")], tags)
    used = {r for refs, _ in ways.values() for r in refs}
    osm = ET.Element("osm", version="0.6", generator="shinjuku-megadungeon filter_rail.py",
                     copyright="OpenStreetMap and contributors", attribution="https://www.openstreetmap.org/copyright",
                     license="https://opendatacommons.org/licenses/odbl/1-0/")
    for nid in sorted(used, key=int):
        if nid in nodes:
            lat, lon = nodes[nid]
            ET.SubElement(osm, "node", id=nid, lat=lat, lon=lon)
    for wid in sorted(ways, key=int):
        refs, tags = ways[wid]
        w = ET.SubElement(osm, "way", id=wid)
        for r in refs:
            ET.SubElement(w, "nd", ref=r)
        for k in sorted(tags):
            ET.SubElement(w, "tag", k=k, v=tags[k])
    with gzip.open(out, "wb") as f:
        f.write(ET.tostring(osm, encoding="utf-8", xml_declaration=True))
    print(f"{out}: {len(ways)} ways, {len(used)} nodes")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
