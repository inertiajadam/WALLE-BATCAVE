"""Per-cell relative occurrence density from GBIF points for species NABat's summer models
do not cover (Mexican free-tailed bat, eastern red bat, Indiana bat). Points are assigned to
the 10 km NABat cell, smoothed with a 1-cell Gaussian, and scaled so the 98th percentile = 1.
Output: data/raw/gbif/density.json  { code: {grts: [...], value: [...]} }
"""
import json, math, os, sys, time, urllib.parse, urllib.request
import numpy as np, shapefile
from rasterio.warp import transform
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, "..", "data", "raw")
SPECIES = {"TABR": 2433011, "LABO": 5218543, "MYSO": 2432418, "NYHU": 2432314, "MYAU": 2432451}

def get(params):
    url = "https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode(params)
    for i in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r: return json.load(r)
        except Exception as e: print("retry", e, file=sys.stderr); time.sleep(2*(i+1))

def main():
    r = shapefile.Reader(os.path.join(RAW, "nabat", "conus_mastersample_10km_GRTS")); prj = open(os.path.join(RAW, "nabat", "conus_mastersample_10km_GRTS.prj")).read()
    recs = r.records(); grts = [x["GRTS_ID"] for x in recs]
    bboxes = np.array([r.shape(i).bbox for i in range(len(recs))]); x0, y0 = bboxes[:,0].min(), bboxes[:,1].min()
    ix = np.round((bboxes[:,0]-x0)/10000).astype(int); iy = np.round((bboxes[:,1]-y0)/10000).astype(int)
    W, H = ix.max()+1, iy.max()+1
    out = {}
    only = sys.argv[1:]
    for code, key in SPECIES.items():
        if only and code not in only: continue
        # GBIF's search API stalls at deep offsets, so page within year buckets that each stay small.
        pts = []
        for yr in ["*,1949", "1950,1969", "1970,1979", "1980,1999", "2000,2009", "2010,2016", "2017,2020", "2021,2023", "2024,2026"]:
            offset = 0
            while offset < 9000:
                d = get({"taxonKey": key, "country": "US", "hasCoordinate": "true", "hasGeospatialIssue": "false", "year": yr, "limit": 300, "offset": offset})
                if not d: break
                pts += [(o["decimalLongitude"], o["decimalLatitude"]) for o in d["results"]]
                offset += 300
                if d.get("endOfRecords"): break
            print(code, yr, len(pts), flush=True)
        xs, ys = transform("EPSG:4326", prj, [p[0] for p in pts], [p[1] for p in pts])
        grid = np.zeros((H, W))
        for x, y in zip(xs, ys):
            i, j = int(math.floor((x-x0)/10000)), int(math.floor((y-y0)/10000))
            if 0 <= i < W and 0 <= j < H: grid[j, i] += 1
        # log-compress then gaussian smooth (sigma = 1.5 cells) via separable kernel
        g = np.log1p(grid); k = np.exp(-0.5*(np.arange(-4,5)/1.5)**2); k /= k.sum()
        g = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 0, g); g = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 1, g)
        vals = g[iy, ix]; p98 = np.percentile(vals[vals>0], 98) if (vals>0).any() else 1
        vals = np.clip(vals/p98, 0, 1)
        nz = vals > 0.01
        out[code] = {"n_points": len(pts), "grts": [int(grts[i]) for i in np.where(nz)[0]], "value": [round(float(v),3) for v in vals[nz]]}
        print(code, len(pts), "points ->", int(nz.sum()), "cells", flush=True)
    suffix = "_" + "_".join(only) if only else ""
    json.dump(out, open(os.path.join(RAW, "gbif", f"density{suffix}.json"), "w"))

if __name__ == "__main__": main()
