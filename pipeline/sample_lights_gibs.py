"""Provisional per-grid-cell night-light brightness from NASA GIBS 'VIIRS_Black_Marble' tiles
(2016 annual composite, served openly with no login). This is a *visual* product (RGB), so the value
is a 0-255 brightness proxy, not calibrated radiance. It is replaced by process_viirs.py once the
EOG annual VNL GeoTIFF (calibrated nW/cm2/sr) is available.

Source: NASA GIBS, layer VIIRS_Black_Marble, https://gibs.earthdata.nasa.gov
"""
import io, json, math, os, sys, time, urllib.request
import numpy as np
from PIL import Image
import shapefile
from rasterio.warp import transform

HERE = os.path.dirname(__file__)
GRID = os.path.join(HERE, "..", "data", "raw", "nabat", "conus_mastersample_10km_GRTS")
OUT = os.path.join(HERE, "..", "data", "raw", "lights", "gibs_cell_brightness.json")
Z = 7
URL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png"

def lonlat_to_tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def main():
    r = shapefile.Reader(GRID)
    recs = r.records()
    ids = np.array([rec["GRTS_ID"] for rec in recs]); lats = np.array([rec["lat"] for rec in recs]); lons = np.array([rec["long"] for rec in recs])
    # 10 km cell ~ 0.09 deg lat; at z7 a pixel is ~1.2 km at 40N. Sample a 7x7 block of pixels around each centroid.
    tx, ty = lonlat_to_tile(lons, lats, Z) if False else (None, None)
    cache = {}
    def tile(x, y):
        k = (x, y)
        if k not in cache:
            for i in range(4):
                try:
                    with urllib.request.urlopen(URL.format(z=Z, x=x, y=y), timeout=60) as resp:
                        im = Image.open(io.BytesIO(resp.read())).convert("RGB")
                    cache[k] = np.asarray(im, dtype=np.float32); break
                except Exception as e:
                    print("retry", k, e, file=sys.stderr); time.sleep(2)
            else:
                cache[k] = np.zeros((256, 256, 3), np.float32)
        return cache[k]
    vals = np.zeros(len(ids), np.float32)
    for i, (lon, lat) in enumerate(zip(lons, lats)):
        fx, fy = lonlat_to_tile(lon, lat, Z)
        px, py = fx * 256, fy * 256
        acc, n = 0.0, 0
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                X, Y = int(px) + dx, int(py) + dy
                t = tile(X // 256, Y // 256)
                p = t[Y % 256, X % 256]
                acc += 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; n += 1
        vals[i] = acc / n
        if i % 10000 == 0: print(i, len(cache), "tiles", flush=True)
    json.dump({"source": "NASA GIBS VIIRS_Black_Marble 2016 (brightness proxy 0-255)", "grts": ids.tolist(), "brightness": [round(float(v), 1) for v in vals]}, open(OUT, "w"))
    print("done", len(cache), "tiles; mean", float(vals.mean()))

if __name__ == "__main__":
    main()
