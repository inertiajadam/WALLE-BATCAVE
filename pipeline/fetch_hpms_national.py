"""Fetch 2024 HPMS interstate segments (f_system=1) for every CONUS state from FHWA's
per-state ArcGIS feature services on geo.dot.gov. Saves one GeoJSON-ish JSON per state
in data/raw/hpms/. Geometry is generalized (maxAllowableOffset) because the national
view only needs per-grid-cell traffic aggregates, not centimetre-accurate lines.

Source: FHWA Highway Performance Monitoring System 2024,
https://geo.dot.gov/server/rest/services/hosted/HPMS_FULL_<ST>_2024/FeatureServer/0
"""
import json, os, sys, time, urllib.parse, urllib.request

STATES = ["AL","AZ","AR","CA","CO","CT","DE","DC","FL","GA","ID","IL","IN","IA","KS","KY","LA","ME","MD",
          "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
          "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "hpms")
FIELDS = "state_id,route_id,routenumber,f_system,aadt,through_lanes,begin_point,end_point,urban_id,k_factor,speed_limit"

def fetch(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                return json.load(r)
        except Exception as e:
            print("  retry", i, e, file=sys.stderr); time.sleep(2 * (i + 1))
    return None

def main():
    only = sys.argv[1:]  # optional subset of states
    for st in STATES:
        if only and st not in only: continue
        path = os.path.join(OUT, f"{st}_interstate_2024.json")
        if os.path.exists(path): print(st, "cached"); continue
        base = f"https://geo.dot.gov/server/rest/services/hosted/HPMS_FULL_{st}_2024/FeatureServer/0/query"
        feats, offset = [], 0
        while True:
            q = {"where": "f_system=1", "outFields": FIELDS, "outSR": 4326, "geometryPrecision": 4,
                 "maxAllowableOffset": 0.002, "resultOffset": offset, "resultRecordCount": 2000, "f": "json"}
            d = fetch(base + "?" + urllib.parse.urlencode(q))
            if not d or "features" not in d:
                print(st, "FAILED at offset", offset, (d or {}).get("error")); break
            feats.extend(d["features"])
            if not d.get("exceededTransferLimit") or not d["features"]: break
            offset += len(d["features"])
        with open(path, "w") as f: json.dump({"state": st, "features": feats}, f)
        print(st, len(feats), "segments", flush=True)

if __name__ == "__main__":
    main()
