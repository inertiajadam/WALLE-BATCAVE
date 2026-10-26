"""Fetch full-resolution 2024 HPMS road segments with AADT for each deep-dive corridor.
Output: app/public/data/corridors/<id>_roads.geojson
Source: FHWA HPMS 2024 per-state feature services (geo.dot.gov).
"""
import json, os, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "app", "public", "data", "corridors"); os.makedirs(OUT, exist_ok=True)
FIELDS = "route_id,routenumber,routename,f_system,aadt,through_lanes,begin_point,end_point,urban_id,k_factor,dir_factor,speed_limit,facility_type,access_control"

def fetch(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(url, timeout=180) as r: return json.load(r)
        except Exception as e: print("retry", e, file=sys.stderr); time.sleep(2*(i+1))

def main():
    cfg = json.load(open(os.path.join(HERE, "corridors.json")))
    for cid, c in cfg.items():
        base = f"https://geo.dot.gov/server/rest/services/hosted/HPMS_FULL_{c['state']}_2024/FeatureServer/0/query"
        where = f"f_system IN ({','.join(map(str,c['fSystems']))}) AND routenumber IN ({','.join(map(str,c['routeNumbers']))})"
        feats, offset = [], 0
        while True:
            q = {"where": where, "geometry": ",".join(map(str, c["bbox"])), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
                 "spatialRel": "esriSpatialRelIntersects", "outFields": FIELDS, "outSR": 4326, "geometryPrecision": 5,
                 "resultOffset": offset, "resultRecordCount": 2000, "f": "geojson"}
            d = fetch(base + "?" + urllib.parse.urlencode(q))
            if not d or "features" not in d: print(cid, "failed", d); break
            feats += d["features"]
            if not d.get("properties", {}).get("exceededTransferLimit") and len(d["features"]) < 2000: break
            offset += len(d["features"])
        # keep only segments with an AADT value
        feats = [f for f in feats if f["properties"].get("aadt")]
        json.dump({"type": "FeatureCollection", "corridor": cid, "source": "FHWA HPMS 2024", "features": feats}, open(os.path.join(OUT, f"{cid}_roads.geojson"), "w"))
        aadts = [f["properties"]["aadt"] for f in feats]
        print(cid, len(feats), "segments; AADT range", min(aadts) if aadts else None, max(aadts) if aadts else None, flush=True)

if __name__ == "__main__": main()
