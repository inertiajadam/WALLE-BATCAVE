"""National interstate lines for the overview map: Natural Earth 10m North America roads
(public domain), US freeways only, joined to the per-cell FHWA AADT aggregate from build_grid.
Output: app/public/data/interstates.geojson
"""
import base64, json, math, os
import numpy as np, shapefile
from rasterio.warp import transform
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, "..", "data", "raw"); PUB = os.path.join(HERE, "..", "app", "public", "data")

def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]; dmax, idx = 0, 0
    dx, dy = x2-x1, y2-y1; L = math.hypot(dx, dy) or 1e-12
    for i in range(1, len(pts)-1):
        d = abs(dy*pts[i][0] - dx*pts[i][1] + x2*y1 - y2*x1) / L
        if d > dmax: dmax, idx = d, i
    if dmax > eps: return rdp(pts[:idx+1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

def main():
    g = json.load(open(os.path.join(PUB, "grid.json")))
    dec = lambda s, dt: np.frombuffer(base64.b64decode(s), dtype=dt)
    grts = dec(g["grts"], np.int32); lon = dec(g["lon"], np.float32); lat = dec(g["lat"], np.float32); aadt = dec(g["aadt"], np.float32)
    # cell lookup by Albers index (same construction as build_grid)
    r = shapefile.Reader(os.path.join(RAW, "nabat", "conus_mastersample_10km_GRTS")); prj = open(os.path.join(RAW, "nabat", "conus_mastersample_10km_GRTS.prj")).read()
    recs = r.records(); bboxes = np.array([r.shape(i).bbox for i in range(len(recs))]); x0, y0 = bboxes[:, 0].min(), bboxes[:, 1].min()
    byg = {int(x["GRTS_ID"]): i for i, x in enumerate(recs)}
    ix = np.round((bboxes[:, 0]-x0)/10000).astype(int); iy = np.round((bboxes[:, 1]-y0)/10000).astype(int)
    aadt_by_idx = {}
    for gg, a in zip(grts, aadt):
        i = byg.get(int(gg))
        if i is not None and a > 0: aadt_by_idx[(int(ix[i]), int(iy[i]))] = float(a)
    roads = shapefile.Reader(os.path.join(RAW, "roads", "ne_10m_roads_north_america"))
    feats = []
    for sr in roads.iterShapeRecords(fields=["country", "type", "class", "number", "prefix", "length"]):
        rec = sr.record
        if rec["country"] != "United States" or rec["type"] != "Freeway": continue
        pts = sr.shape.points; parts = list(sr.shape.parts) + [len(pts)]
        for p in range(len(parts)-1):
            seg = [(round(x, 3), round(y, 3)) for x, y in rdp(pts[parts[p]:parts[p+1]], 0.008)]
            if len(seg) < 2: continue
            xs, ys = transform("EPSG:4326", prj, [q[0] for q in seg], [q[1] for q in seg])
            vals = [aadt_by_idx.get((int(math.floor((x-x0)/10000)), int(math.floor((y-y0)/10000)))) for x, y in zip(xs, ys)]
            vals = [v for v in vals if v]
            feats.append({"type": "Feature", "properties": {"number": rec["number"], "prefix": rec["prefix"], "cls": rec["class"], "aadt": round(sum(vals)/len(vals)) if vals else None},
                          "geometry": {"type": "LineString", "coordinates": [[x, y] for x, y in seg]}})
    json.dump({"type": "FeatureCollection", "source": "Natural Earth 10m roads (public domain); AADT from FHWA HPMS 2024 interstate cells", "features": feats}, open(os.path.join(PUB, "interstates.geojson"), "w"), separators=(",", ":"))
    print(len(feats), "freeway segments; with AADT:", sum(1 for f in feats if f["properties"]["aadt"]), "size MB", round(os.path.getsize(os.path.join(PUB, "interstates.geojson"))/1e6, 2))

if __name__ == "__main__": main()
