"""Georeferenced bat occurrence points inside each corridor bbox (GBIF), for the detail map.
Output: app/public/data/corridors/<id>_gbif.json  [[lon,lat,month,year,speciesKey], ...]
"""
import json, os, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "app", "public", "data", "corridors"); os.makedirs(OUT, exist_ok=True)

def get(params):
    url = "https://api.gbif.org/v1/occurrence/search?" + urllib.parse.urlencode(params)
    for i in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r: return json.load(r)
        except Exception as e: print("retry", e, file=sys.stderr); time.sleep(2*(i+1))

def main():
    cfg = json.load(open(os.path.join(HERE, "corridors.json")))
    for cid, c in cfg.items():
        w, s, e, n = c["bbox"]
        pts, names, offset = [], {}, 0
        while offset < 6000:
            d = get({"taxonKey": 734, "country": "US", "hasCoordinate": "true", "hasGeospatialIssue": "false",
                     "decimalLongitude": f"{w},{e}", "decimalLatitude": f"{s},{n}", "limit": 300, "offset": offset})
            if not d: break
            for o in d["results"]:
                if "month" not in o: continue
                k = o.get("speciesKey"); names[k] = o.get("species")
                pts.append([round(o["decimalLongitude"], 4), round(o["decimalLatitude"], 4), o["month"], o.get("year"), k])
            offset += 300
            if d.get("endOfRecords"): break
        json.dump({"corridor": cid, "source": "GBIF.org occurrence download via API", "species": names, "points": pts}, open(os.path.join(OUT, f"{cid}_gbif.json"), "w"))
        print(cid, len(pts), "points", flush=True)

if __name__ == "__main__": main()
