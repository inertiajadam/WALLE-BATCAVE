"""Calibrated night-light radiance per 10 km NABat cell from the EOG annual VNL composite.

Usage: python3 process_viirs.py <VNL ... average_masked.dat.tif[.gz]> [<older year file for trend>]

Reads only the CONUS window of the global 15 arc-second GeoTIFF (rasterio windowed read, so the
global 1 GB+ raster is never fully loaded), averages radiance (nW/cm2/sr) over each cell, and also
writes a downsampled CONUS PNG overlay for the map.

Outputs
  data/raw/lights/viirs_cell_radiance.json   { source, year, grts[], radiance[] , radiance_prev[] }
  app/public/data/lights_conus.png           log-scaled CONUS overlay (for the map's raster layer)
  app/public/data/lights_conus.json          bounds + scale metadata

Source: Earth Observation Group, Payne Institute, Colorado School of Mines. Annual VNL V2.
Elvidge et al. 2021, Remote Sensing 13(5):922; Elvidge et al. 2017, IJRS 38:5860-5879. CC BY 4.0.
"""
import gzip, json, math, os, re, shutil, sys
import numpy as np, rasterio, shapefile
from rasterio.windows import from_bounds
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, "..", "data", "raw"); PUB = os.path.join(HERE, "..", "app", "public", "data")
CONUS = (-125.5, 24.0, -66.5, 50.0)  # W S E N

def open_tif(path):
    # Read through GDAL's /vsigzip/ so the ~11.6 GB uncompressed global raster never touches disk.
    if path.endswith(".gz"): path = "/vsigzip/" + os.path.abspath(path)
    return rasterio.open(path)

def cell_means(ds, lons, lats):
    win = from_bounds(*CONUS, transform=ds.transform)
    arr = ds.read(1, window=win).astype(np.float32)
    tr = ds.window_transform(win)
    arr[arr < 0] = 0
    # 10 km cell ~ 0.09 deg lat; 15 arcsec px = 0.004167 deg -> a cell spans ~22 rows and ~22/cos(lat) cols
    rows = ((lats - tr.f) / tr.e).astype(int); cols = ((lons - tr.c) / tr.a).astype(int)
    half_r = int(round(0.045 / abs(tr.e)))
    out = np.zeros(len(lons), np.float32)
    for i in range(len(lons)):
        half_c = int(round(0.045 / (abs(tr.a) * math.cos(math.radians(lats[i])))))
        r0, r1 = max(rows[i]-half_r, 0), min(rows[i]+half_r+1, arr.shape[0]); c0, c1 = max(cols[i]-half_c, 0), min(cols[i]+half_c+1, arr.shape[1])
        if r1 > r0 and c1 > c0: out[i] = arr[r0:r1, c0:c1].mean()
    return out, arr, tr

def main():
    paths = sys.argv[1:]
    r = shapefile.Reader(os.path.join(RAW, "nabat", "conus_mastersample_10km_GRTS")); recs = r.records()
    grts = [x["GRTS_ID"] for x in recs]; lats = np.array([x["lat"] for x in recs]); lons = np.array([x["long"] for x in recs])
    year = re.search(r"_(20\d\d)_", os.path.basename(paths[0])).group(1)
    ds = open_tif(paths[0]); print("opened", ds.width, ds.height, ds.crs, ds.res)
    rad, arr, tr = cell_means(ds, lons, lats)
    print(year, "cell radiance: mean", float(rad.mean()), "p50", float(np.median(rad)), "p99", float(np.percentile(rad, 99)), "max", float(rad.max()))
    out = {"source": f"EOG Annual VNL V2 {year} average_masked (nW/cm2/sr), Colorado School of Mines, CC BY 4.0", "year": int(year), "grts": [int(g) for g in grts], "radiance": [round(float(v), 3) for v in rad]}
    out["years"] = {int(year): out["radiance"]}
    for p in paths[1:]:
        y2 = re.search(r"_(20\d\d)_", os.path.basename(p)).group(1); ds2 = open_tif(p); rad2, _, _ = cell_means(ds2, lons, lats)
        out["years"][int(y2)] = [round(float(v), 3) for v in rad2]
        print(y2, "mean", float(rad2.mean()), flush=True)
    json.dump(out, open(os.path.join(RAW, "lights", "viirs_cell_radiance.json"), "w"))
    # map overlay: downsample CONUS window by 4 (-> ~3.5 km px), log scale, alpha by brightness
    h, w = arr.shape; f = 4; a = arr[:h//f*f, :w//f*f].reshape(h//f, f, w//f, f).mean(axis=(1, 3))
    v = np.clip(np.log1p(a) / np.log1p(60.0), 0, 1)
    rgba = np.zeros((*v.shape, 4), np.uint8)
    rgba[..., 0] = (255 * np.clip(v * 1.15, 0, 1)); rgba[..., 1] = (215 * v ** 1.3); rgba[..., 2] = (120 * v ** 2); rgba[..., 3] = (255 * np.clip(v * 1.6, 0, 1))
    Image.fromarray(rgba, "RGBA").save(os.path.join(PUB, "lights_conus.png"), optimize=True)
    json.dump({"bounds": [CONUS[0], CONUS[3], tr.c + tr.a * w, tr.f + tr.e * h], "year": int(year), "scale": "log1p(radiance)/log1p(60)", "source": out["source"]}, open(os.path.join(PUB, "lights_conus.json"), "w"))
    print("wrote overlay", v.shape, os.path.getsize(os.path.join(PUB, "lights_conus.png")) / 1e6, "MB")

if __name__ == "__main__": main()
