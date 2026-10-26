# Black Corridor

A prototype decision-support tool for **bat-aware adaptive highway lighting**. It stacks three national datasets on one 10 km (6 mi) grid, bats (USGS NABat and GBIF), light pollution (VIIRS night lights from the Earth Observation Group and NASA), and traffic (FHWA HPMS 2024), and runs a transparent two-layer model that predicts nightly bat activity, decides when highway lights can safely dim, and projects the energy, cost and CO₂ a utility would save.

Student project. Nothing here connects to a real power grid; `/api/schedule` demonstrates the feed a lighting controller would consume.

## Pages

| Route | What it shows |
| --- | --- |
| `/` | National map: every 10 km cell in the lower 48, with lenses for bat activity, Black Corridor priority, light pollution and interstate traffic; month slider; nightly modifiers; species filters; ranked candidate corridors |
| `/corridors/[id]` | Deep dives for I-35 (TX), I-65 (KY), US 62/180 (NM) and I-75 / US 441 at Gainesville (FL): segment-level dimming map, tonight's hourly schedule, annual savings, adjustable policy and energy assumptions |
| `/utility` | Utility dashboard: savings across pilots, tonight's setpoints, auto-generated public notice, simulated grid feed |
| `/tonight` | Public page: what the lights near you will do tonight and why, with a live weather forecast |
| `/methodology` | Model, formulas, limitations and full data provenance |

## Units

Every measurement in the app is shown in both metric and imperial (°C / °F, km / mi, t / lb). Energy is in kWh in both systems.

## The model

**Layer 1, historical baseline:** `baseline(cell, species, month) = NABat occupancy × GBIF seasonal curve`, weighted across species (listed species count more). Explains *where* and *when* bats are present.

**Layer 2, nightly modifiers:** `BAI = 100 × baseline × f_time(hours after sunset) × f_temp(evening °C) × f_moon(illumination)`. Explains *how active* they are tonight.

**Dimming rule:** in hours where traffic is below 50 % of the peak hour (FHWA adaptive-lighting criterion), lights dim by 50 % when BAI ≥ 35, by 30 % when BAI ≥ 15, otherwise by the base adaptive 15 %; never below a 40 % floor. All thresholds are sliders.

See `/methodology` in the app for sources and caveats.

## Repository layout

```
app/        Next.js 16 app (MapLibre + deck.gl + Recharts). Deploy root for Vercel.
pipeline/   Python scripts that download the public datasets and build app/public/data/.
data/raw/   Downloads (git-ignored; several GB).
```

## Running locally

```bash
cd app
npm install
npm run dev
```

Pre-built data files are committed under `app/public/data/`, so the app runs without the pipeline.

## Rebuilding the data

Requires Python 3.11+ with `rasterio numpy pyshp shapely pillow`.

```bash
cd pipeline
python3 fetch_hpms_national.py        # FHWA HPMS 2024 interstates, all states (~20 min)
python3 fetch_hpms_corridors.py       # full-detail segments for the four corridors
python3 fetch_gbif.py                 # monthly phenology per species per state
python3 fetch_gbif_density.py         # point density for TABR, LABO, MYSO, NYHU, MYAU (one species per run)
python3 fetch_gbif_points.py          # sightings inside each corridor
python3 fetch_climate.py              # ERA5 evening temperatures (Open-Meteo)
python3 sample_lights_gibs.py         # provisional night-light proxy (no login needed)
python3 process_viirs.py <VNL_*.average_masked.dat.tif.gz> [more years...]   # calibrated radiance (free EOG account)
python3 build_grid.py                 # -> app/public/data/grid.json
python3 build_roads.py                # -> app/public/data/interstates.geojson
```

The NABat grid and occupancy CSVs are fetched from USGS ScienceBase (see the script headers for item IDs).

## Deploying to Vercel

Import the repository, set the **root directory** to `app`, framework Next.js, defaults otherwise. No environment variables or API keys are required.

## Data sources

USGS NABat (grid, summer occupancy 2010-2019), GBIF, Earth Observation Group Annual VNL V2 (CC BY 4.0), NASA GIBS Black Marble, FHWA HPMS 2024, Natural Earth, Open-Meteo, FHWA-HRT-14-051, DOE SSL program, EIA, EPA eGRID. Full list with links in the app's Methodology page.
