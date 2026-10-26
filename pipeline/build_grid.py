"""Assemble the national 10 km grid used by the app.

Inputs
  data/raw/nabat/conus_mastersample_10km_GRTS.*   NABat CONUS master sample grid (USGS)
  data/raw/nabat/<SP>_gridcell_occupancy.csv       NABat summer occupancy 2010-2019 (USGS, doi:10.5066/P92JGACB)
  data/raw/lights/viirs_cell_radiance.json         (optional) calibrated EOG VNL radiance per cell
  data/raw/lights/gibs_cell_brightness.json        (fallback) NASA GIBS Black Marble brightness proxy
  data/raw/hpms/<ST>_interstate_2024.json          (optional) FHWA HPMS 2024 interstate segments

Output  app/public/data/grid.json  (base64 typed arrays; see app/src/lib/grid.ts for the reader)
"""
import base64, csv, glob, json, math, os, sys
import numpy as np
import shapefile
from rasterio.warp import transform

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")
OUT = os.path.join(HERE, "..", "app", "public", "data", "grid.json")
SPECIES = ["EPFU","LACI","LANO","MYEV","MYGR","MYLE","MYLU","MYSE","MYTH","MYVO","MYYU","PESU"]

def b64(arr): return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode()

def main():
    r = shapefile.Reader(os.path.join(RAW, "nabat", "conus_mastersample_10km_GRTS"))
    recs = r.records()
    grts = np.array([x["GRTS_ID"] for x in recs], np.int32)
    lat = np.array([x["lat"] for x in recs], np.float32)
    lon = np.array([x["long"] for x in recs], np.float32)
    # Albers cell origin (for assigning arbitrary points to cells). Grid is regular 10 km in the shapefile CRS.
    shp0 = r.shape(0).points; prj = open(os.path.join(RAW, "nabat", "conus_mastersample_10km_GRTS.prj")).read()
    # compute each cell's lower-left Albers corner from its bbox
    bboxes = np.array([r.shape(i).bbox for i in range(len(recs))], np.float64)  # xmin ymin xmax ymax
    x0, y0 = bboxes[:, 0].min(), bboxes[:, 1].min()
    ix = np.round((bboxes[:, 0] - x0) / 10000).astype(np.int32); iy = np.round((bboxes[:, 1] - y0) / 10000).astype(np.int32)
    index = {(int(a), int(b)): i for i, (a, b) in enumerate(zip(ix, iy))}
    pos = {int(g): i for i, g in enumerate(grts)}
    n = len(grts)
    print("cells", n)

    # --- NABat occupancy: mean of the latest 3 modeled years per cell (0-250 scaled; 255 = not modeled)
    occ = {}
    for sp in SPECIES:
        arr = np.full(n, 255, np.uint8); acc = {}
        with open(os.path.join(RAW, "nabat", f"{sp}_gridcell_occupancy.csv")) as f:
            for row in csv.DictReader(f):
                if int(row["year"]) < 2017: continue
                gs = row["grts"]
                if not gs.startswith("US"): continue
                g = int(gs[2:]); acc.setdefault(g, []).append(float(row["mean"]))
        for g, vals in acc.items():
            i = pos.get(g)
            if i is not None: arr[i] = int(round(250 * sum(vals) / len(vals)))
        occ[sp] = arr; print(sp, "modeled cells", len(acc), "mean occ", round(float(np.mean([v for v in arr if v != 255]) / 250), 3))
    anybat = np.any(np.stack([occ[s] != 255 for s in SPECIES]), axis=0)

    # --- GBIF-derived relative density layers for species NABat's summer models do not cover
    density = {}
    merged = {}
    for dp in glob.glob(os.path.join(RAW, "gbif", "density*.json")): merged.update(json.load(open(dp)))
    if merged:
        for code, d in merged.items():
            arr = np.zeros(n, np.float32)
            for g, v in zip(d["grts"], d["value"]):
                i = pos.get(int(g))
                if i is not None: arr[i] = v
            density[code] = arr; anybat |= arr > 0.05
            print(code, "density cells", int((arr > 0).sum()))

    # --- Night lights per cell
    light = np.zeros(n, np.float32); light_src = "none"; light_years = {}
    p = os.path.join(RAW, "lights", "viirs_cell_radiance.json")
    if os.path.exists(p):
        d = json.load(open(p)); light_src = d["source"]
        for g, v in zip(d["grts"], d["radiance"]):
            if g in pos: light[pos[g]] = v
        for yr, vals in d.get("years", {}).items():
            arr = np.zeros(n, np.float32)
            for g, v in zip(d["grts"], vals):
                if g in pos: arr[pos[g]] = v
            light_years[str(yr)] = arr
    else:
        p = os.path.join(RAW, "lights", "gibs_cell_brightness.json")
        if os.path.exists(p):
            d = json.load(open(p)); light_src = d["source"]
            for g, v in zip(d["grts"], d["brightness"]):
                if g in pos: light[pos[g]] = v
    print("light source:", light_src, "max", float(light.max()))

    # --- Interstate traffic per cell: AADT-weighted by segment length; plus interstate km per cell
    aadt_sum = np.zeros(n, np.float64); km = np.zeros(n, np.float64); routes = [set() for _ in range(n)]
    files = glob.glob(os.path.join(RAW, "hpms", "*_interstate_2024.json"))
    for fp in files:
        d = json.load(open(fp))
        for ft in d["features"]:
            a = ft["attributes"]; aadt = a.get("aadt") or 0
            for path in ft.get("geometry", {}).get("paths", []):
                if len(path) < 2: continue
                xs = [q[0] for q in path]; ys = [q[1] for q in path]
                ax, ay = transform("EPSG:4326", prj, xs, ys)
                for k in range(len(path) - 1):
                    seg_km = math.hypot(ax[k+1]-ax[k], ay[k+1]-ay[k]) / 1000
                    cx, cy = (ax[k]+ax[k+1])/2, (ay[k]+ay[k+1])/2
                    i = index.get((int(math.floor((cx - x0)/10000)), int(math.floor((cy - y0)/10000))))
                    if i is None: continue
                    km[i] += seg_km; aadt_sum[i] += aadt * seg_km
                    if a.get("routenumber"): routes[i].add(int(a["routenumber"]))
    aadt_mean = np.where(km > 0, aadt_sum / np.maximum(km, 1e-9), 0).astype(np.float32)
    print("hpms states", len(files), "cells with interstate", int((km > 0).sum()), "max mean AADT", float(aadt_mean.max()))

    # --- State per cell (Natural Earth 50m admin-1, public domain) for regional phenology
    from shapely.geometry import shape, Point
    from shapely.strtree import STRtree
    sr = shapefile.Reader(os.path.join(RAW, "roads", "states", "ne_50m_admin_1_states_provinces"))
    polys, names = [], []
    for srec in sr.iterShapeRecords(fields=["name", "iso_a2"]):
        if srec.record["iso_a2"] != "US": continue
        polys.append(shape(srec.shape.__geo_interface__)); names.append(srec.record["name"])
    tree = STRtree(polys); state_idx = np.full(n, 255, np.uint8)
    pts = [Point(float(a), float(b)) for a, b in zip(lon, lat)]
    for i, pt in enumerate(pts):
        for j in tree.query(pt, predicate="within"):
            state_idx[i] = j; break
    # cells just offshore / on borders: nearest state
    miss = np.where(state_idx == 255)[0]
    for i in miss:
        j = tree.nearest(pts[i]); state_idx[i] = j
    print("states assigned; unmatched before nearest-fill:", len(miss))

    keep = anybat | (km > 0)
    sel = np.where(keep)[0]
    out = {
        "n": int(len(sel)), "species": SPECIES,
        "grts": b64(grts[sel]), "lon": b64(lon[sel]), "lat": b64(lat[sel]),
        "occ": {sp: b64(occ[sp][sel]) for sp in SPECIES},
        "density": {code: b64(arr[sel]) for code, arr in density.items()},
        "light": b64(light[sel]), "lightSource": light_src,
        "lightYears": {yr: b64(arr[sel]) for yr, arr in sorted(light_years.items())},
        "aadt": b64(aadt_mean[sel]), "interstateKm": b64(km[sel].astype(np.float32)),
        "routes": [sorted(routes[i])[:3] for i in sel],
        "state": b64(state_idx[sel]), "states": names,
        "sources": {
            "grid": "USGS NABat CONUS 10x10 km master sample grid, https://www.sciencebase.gov/catalog/item/5b7753bde4b0f5d578820455",
            "occupancy": "USGS, Status and Trends of North American Bats Summer Occupancy Analysis 2010-2019, doi:10.5066/P92JGACB (mean of 2017-2019 posterior means)",
            "traffic": "FHWA Highway Performance Monitoring System 2024, interstate (F_SYSTEM=1) AADT, length-weighted per cell",
            "light": light_src,
            "density": "GBIF.org occurrence records (TABR, LABO, MYSO), log-count per cell smoothed with a 1.5-cell Gaussian, scaled to the 98th percentile",
        },
    }
    json.dump(out, open(OUT, "w"))
    print("wrote", OUT, round(os.path.getsize(OUT)/1e6, 2), "MB; cells kept", len(sel))

if __name__ == "__main__": main()
