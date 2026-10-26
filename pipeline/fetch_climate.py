"""Monthly mean temperature at ~1 hour after sunset for each corridor, from the Open-Meteo
historical archive (ERA5 reanalysis, free, no key). Used as the default temperature input
for the nightly modifier when no live forecast is loaded.
Output: app/public/data/corridors/climate.json  { id: [12 monthly mean evening temps C] }
"""
import json, os, urllib.parse, urllib.request, datetime
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "app", "public", "data", "corridors", "climate.json")

def main():
    cfg = json.load(open(os.path.join(HERE, "corridors.json")))
    out = {}
    for cid, c in cfg.items():
        p = c["temperaturePoint"]
        q = {"latitude": p["lat"], "longitude": p["lon"], "start_date": "2023-01-01", "end_date": "2024-12-31",
             "hourly": "temperature_2m", "daily": "sunset", "timezone": "auto"}
        with urllib.request.urlopen("https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(q), timeout=120) as r:
            d = json.load(r)
        hourly = dict(zip(d["hourly"]["time"], d["hourly"]["temperature_2m"]))
        sums, ns = [0.0]*12, [0]*12
        for day, sunset in zip(d["daily"]["time"], d["daily"]["sunset"]):
            t = datetime.datetime.fromisoformat(sunset) + datetime.timedelta(hours=1)
            key = t.strftime("%Y-%m-%dT%H:00")
            v = hourly.get(key)
            if v is None: continue
            m = int(day[5:7]) - 1; sums[m] += v; ns[m] += 1
        out[cid] = [round(sums[i]/ns[i], 1) if ns[i] else None for i in range(12)]
        print(cid, out[cid])
    json.dump({"source": "Open-Meteo ERA5 archive, 2023-2024, temperature 1h after sunset", "monthly": out}, open(OUT, "w"))

if __name__ == "__main__": main()
