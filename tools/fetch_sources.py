#!/usr/bin/env python3
"""Fetch the open sources that aren't committed (they're large and stably hosted).

Usage: python3 tools/fetch_sources.py [outdir]   (default: data/fetched, which is git-ignored)

- PLATEAU Shinjuku-ku FY2025, underground-mall model only (udx/ubld, LOD1 + LOD4.1, real elevations, ~44 MB GML).
  Pulled out of the 773 MB CityGML zip with HTTP range requests, so only ~10 MB crosses the wire.
  Licence: pick one of 政府標準利用規約2.0 / CC BY 4.0 / ODC-BY / ODbL (PLATEAU Site Policy §3). We use CC BY 4.0.
  Credit: 「3D都市モデル（Project PLATEAU）新宿区（2025年度）」（国土交通省）を加工して作成.
- Tokyo Metropolitan Government, 新宿駅周辺の施設情報及び施設から目的地への移動ルート情報 (catalog t000008d0000000037,
  G-Spatial id tmg-shinjuku-navigation). Same footprint as the MLIT map; adds levels B4F/B5F, mezzanines, names and
  the station's lost-and-found office. Licence: CC BY. Credit: 東京都都市整備局.
"""
import io, os, sys, urllib.request, zipfile

PLATEAU = "https://assets.cms.plateau.reearth.io/assets/db/2866b9-e3c2-4bc4-83d3-b7b42e9b85a1/13104_shinjuku-ku_pref_2025_citygml_1_op.zip"
TMG = "https://www.toshiseibi.metro.tokyo.lg.jp/kiban/shinjuku_terminal/pdf/shisetsu_root.zip"


class RangeFile(io.RawIOBase):
    """A remote file read with HTTP Range requests, cached in 1 MB blocks."""

    def __init__(self, url):
        self.url, self.pos, self.cache, self.B, self.fetched = url, 0, {}, 1 << 20, 0
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def _block(self, i):
        if i not in self.cache:
            a = i * self.B
            b = min(self.size, a + self.B) - 1
            req = urllib.request.Request(self.url, headers={"Range": f"bytes={a}-{b}"})
            with urllib.request.urlopen(req, timeout=120) as r:
                self.cache[i] = r.read()
            self.fetched += len(self.cache[i])
        return self.cache[i]

    def read(self, n=-1):
        if n < 0:
            n = self.size - self.pos
        out = bytearray()
        while n > 0 and self.pos < self.size:
            i = self.pos // self.B
            blk = self._block(i)
            chunk = blk[self.pos - i * self.B:][:n]
            out += chunk
            self.pos += len(chunk)
            n -= len(chunk)
        return bytes(out)

    def readinto(self, b):
        d = self.read(len(b))
        b[:len(d)] = d
        return len(d)


def main(out):
    os.makedirs(out, exist_ok=True)
    f = RangeFile(PLATEAU)
    z = zipfile.ZipFile(f)
    for info in z.infolist():
        if info.filename.startswith("udx/ubld/") and info.filename.endswith(".gml"):
            dst = os.path.join(out, "plateau-" + os.path.basename(info.filename))
            with open(dst, "wb") as g:
                g.write(z.read(info))
            print("PLATEAU", dst, info.file_size, "bytes")
    print(f"  (fetched {f.fetched // 1024} KB of {f.size // (1 << 20)} MB)")
    dst = os.path.join(out, "tmg-shisetsu_root.zip")
    urllib.request.urlretrieve(TMG, dst)
    print("TMG", dst, os.path.getsize(dst), "bytes")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/fetched")
