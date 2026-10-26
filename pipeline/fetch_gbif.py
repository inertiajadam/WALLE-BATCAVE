"""Pull bat occurrence phenology from GBIF (no API key needed).

Outputs data/raw/gbif/phenology.json:
  { species: { key, name, common, national: [12 monthly counts], states: { "Texas": [12], ... } } }
Counts are research-grade + other georeferenced records for the US. Effort bias (more observers in
summer) is acknowledged in the methodology page; the model normalizes each species/region curve to its
own peak so the *shape* (arrival, peak, departure) is what drives the seasonal baseline.

Source: GBIF.org occurrence API, https://api.gbif.org/v1/occurrence/search
"""
import json, os, sys, time, urllib.parse, urllib.request

SPECIES = {
  # NABat code : (GBIF speciesKey, scientific, common)
  "EPFU": (2432352, "Eptesicus fuscus", "Big brown bat"),
  "TABR": (2433011, "Tadarida brasiliensis", "Mexican free-tailed bat"),
  "MYLU": (2432406, "Myotis lucifugus", "Little brown bat"),
  "LABO": (5218543, "Lasiurus borealis", "Eastern red bat"),
  "COTO": (2432479, "Corynorhinus townsendii", "Townsend's big-eared bat"),
  "ANPA": (2432339, "Antrozous pallidus", "Pallid bat"),
  "PESU": (7665644, "Perimyotis subflavus", "Tricolored bat"),
  "MYYU": (2432461, "Myotis yumanensis", "Yuma myotis"),
  "MYVE": (2432386, "Myotis velifer", "Cave myotis"),
  "PAHE": (4589 and 8397398, "Parastrellus hesperus", "Canyon bat"),
  "LANO": (2432341, "Lasionycteris noctivagans", "Silver-haired bat"),
  "LACI": (11138256, "Aeorestes cinereus", "Hoary bat"),
  "MYCA": (2432425, "Myotis californicus", "California myotis"),
  "MYVO": (2432411, "Myotis volans", "Long-legged myotis"),
  "MYGR": (2432432, "Myotis grisescens", "Gray bat"),
  "NYHU": (2432314, "Nycticeius humeralis", "Evening bat"),
  "MYAU": (2432451, "Myotis austroriparius", "Southeastern myotis"),
  "MYTH": (2432399, "Myotis thysanodes", "Fringed myotis"),
  "MYCI": (2432456, "Myotis ciliolabrum", "Western small-footed myotis"),
  "MYEV": (2432413, "Myotis evotis", "Long-eared myotis"),
  "MYSO": (2432418, "Myotis sodalis", "Indiana bat"),
  "MYSE": (2432436, "Myotis septentrionalis", "Northern long-eared bat"),
  "MYLE": (2432456, "Myotis leibii", "Eastern small-footed myotis"),
  "LASE": (5218539, "Lasiurus seminolus", "Seminole bat"),
}
# fix two keys written loosely above
SPECIES["PAHE"] = (8397398, "Parastrellus hesperus", "Canyon bat")
SPECIES["MYLE"] = (2432457, "Myotis leibii", "Eastern small-footed myotis")

API = "https://api.gbif.org/v1/occurrence/search?"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "gbif", os.environ.get("GBIF_OUT", "phenology.json"))

def get(params, tries=4):
    url = API + urllib.parse.urlencode(params, doseq=True)
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r: return json.load(r)
        except Exception as e:
            print("  retry", i, e, file=sys.stderr); time.sleep(2 * (i + 1))
    raise SystemExit("GBIF unreachable")

def main():
    out = {}
    for code, (key, sci, common) in SPECIES.items():
        # verify key resolves to the expected name
        with urllib.request.urlopen(f"https://api.gbif.org/v1/species/{key}", timeout=60) as r:
            sp = json.load(r)
        if sp.get("canonicalName") != sci:
            # search by name instead
            with urllib.request.urlopen("https://api.gbif.org/v1/species/match?" + urllib.parse.urlencode({"name": sci}), timeout=60) as r:
                m = json.load(r)
            key = m.get("usageKey", key); print("  resolved", sci, "->", key)
        base = {"taxonKey": key, "country": "US", "hasCoordinate": "true", "limit": 0}
        if os.environ.get("GBIF_BASIS"): base["basisOfRecord"] = os.environ["GBIF_BASIS"]
        d = get({**base, "facet": "month", "facetLimit": 12})
        nat = [0] * 12
        for c in d["facets"][0]["counts"]: nat[int(c["name"]) - 1] = c["count"]
        states = {}
        for m in range(1, 13):
            d = get({**base, "month": m, "facet": "stateProvince", "facetLimit": 60})
            for c in d["facets"][0]["counts"]:
                states.setdefault(c["name"], [0] * 12)[m - 1] = c["count"]
        out[code] = {"key": key, "name": sci, "common": common, "total": sum(nat), "national": nat, "states": states}
        print(code, sci, sum(nat), nat, flush=True)
    with open(OUT, "w") as f: json.dump(out, f)

if __name__ == "__main__":
    main()
