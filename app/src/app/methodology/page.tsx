import Link from "next/link";

const SOURCES: { name: string; use: string; url: string; license: string }[] = [
  { name: "USGS NABat Summer Occupancy Analysis 2010-2019", use: "Per-cell (10 km / 6 mi) occupancy probability for 12 species (Layer 1 spatial term). Mean of 2017-2019 posterior means.", url: "https://www.sciencebase.gov/catalog/item/620e6f3bd34e6c7e83baa603", license: "USGS data release, doi:10.5066/P92JGACB" },
  { name: "USGS NABat CONUS 10x10 km master sample grid", use: "The grid every layer is aggregated to.", url: "https://www.sciencebase.gov/catalog/item/5b7753bde4b0f5d578820455", license: "Public domain (USGS)" },
  { name: "GBIF occurrence API", use: "Monthly occurrence counts per species per state (Layer 1 seasonal term); point density for Mexican free-tailed, eastern red, Indiana, evening and southeastern myotis bats; sightings on corridor maps.", url: "https://www.gbif.org/developer/occurrence", license: "Per-dataset CC0 / CC BY / CC BY-NC" },
  { name: "Earth Observation Group, Annual VNL V2 (2022-2025)", use: "Calibrated night-light radiance per cell (nW/cm²/sr). Light-pollution lens and the priority score.", url: "https://eogdata.mines.edu/products/vnl/", license: "CC BY 4.0. Elvidge et al. 2021, Remote Sensing 13(5):922" },
  { name: "NASA GIBS, VIIRS Black Marble (2016)", use: "Night-lights imagery drawn under the maps (visual only).", url: "https://gibs.earthdata.nasa.gov", license: "NASA open data" },
  { name: "FHWA Highway Performance Monitoring System 2024", use: "AADT, K-factor, lanes and route for every interstate segment (national) and every segment in the pilot corridors.", url: "https://www.fhwa.dot.gov/policyinformation/hpms.cfm", license: "US DOT open data" },
  { name: "Natural Earth 10 m roads and 50 m states", use: "Interstate centerlines for the national view; state assignment for phenology.", url: "https://www.naturalearthdata.com", license: "Public domain" },
  { name: "Open-Meteo ERA5 archive and forecast", use: "Monthly mean temperature one hour after sunset at each corridor; tonight's forecast temperature and cloud cover.", url: "https://open-meteo.com", license: "CC BY 4.0" },
  { name: "FHWA Design Criteria for Adaptive Roadway Lighting (FHWA-HRT-14-051)", use: "The low-traffic trigger: hourly volume reduced by 50% from peak.", url: "https://www.fhwa.dot.gov/publications/research/safety/14051/001.cfm", license: "US DOT" },
  { name: "DOE Solid-State Lighting, adaptive lighting field studies", use: "Dimming savings envelope (36-55% measured; 4 h full / 8 h at 50% ≈ 53% added savings).", url: "https://www.energy.gov/cmei/ssl/articles/adaptive-lighting-streets-and-residential-areas", license: "US DOE" },
  { name: "EIA Electric Power Annual, Table 4 (2024)", use: "Default electricity price: 12.75 ¢/kWh commercial average.", url: "https://www.eia.gov/electricity/sales_revenue_price/pdf/table_4.pdf", license: "US EIA" },
  { name: "DOE Municipal Solid-State Street Lighting Consortium inventory", use: "Context: 26.5 million US streetlights, about $2 billion/yr electricity (2013 survey).", url: "https://www1.eere.energy.gov/buildings/ssl/pdfs/msslc_inventory-phase1.pdf", license: "US DOE" },
  { name: "USGS acoustic survey guidance (TM 2-C2)", use: "Peak activity within ~2 h after sunset (Layer 2 time curve).", url: "https://pubs.usgs.gov/publication/tm2C2/full", license: "USGS" },
  { name: "Bat activity vs temperature and time since sunset (USGS, temperate coastal site)", use: "Temperature and hours-after-sunset as the strongest hourly predictors (Layer 2 temperature curve).", url: "https://pubs.usgs.gov/publication/70227259", license: "USGS" },
  { name: "Displacement effects of artificial light at night in a North American bat community", use: "Little brown bats displaced ≥75 m (250 ft) by LED lighting; big brown bats ≤25 m (80 ft) (species weights and the premise).", url: "https://www.sciencedirect.com/science/article/pii/S2351989423003645", license: "Global Ecology and Conservation, 2023" },
  { name: "Roads and bats: meta-analysis of vehicle collisions and barrier effects (Fensome & Mathews 2016)", use: "Road barrier and mortality evidence; call for research on lighting's contribution.", url: "https://onlinelibrary.wiley.com/doi/10.1111/mam.12072", license: "Mammal Review" },
  { name: "Road-killed bats, highway design, and the commuting ecology of bats (Russell et al.)", use: "26,442 crossings and 29 road-killed bats on US 22, Pennsylvania, including an endangered Indiana bat.", url: "https://zenodo.org/records/13429385", license: "Open access" },
  { name: "Artificial lighting reduces the effectiveness of wildlife-crossing structures for bats", use: "Lit underpasses push bats onto the road surface.", url: "https://www.sciencedirect.com/science/article/abs/pii/S0301479720302486", license: "Journal of Environmental Management, 2020" },
];

export default function Methodology() {
  return (
    <div className="prose-dark mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Methodology</h1>
      <p>Black Corridor is a student prototype of a decision-support tool for bat-aware adaptive highway lighting. It is built entirely from nationally recognized open data and a transparent two-layer model whose every term can be inspected and changed in the interface. It does not connect to any power grid.</p>

      <h2>The idea</h2>
      <p>Green corridors give wildlife safe passage across human landscapes. A Black Corridor does the same with darkness: along stretches of highway where bats are active and light pollution is high, lights are dimmed during the hours when bats are flying and traffic is light. Utilities save energy, bats keep their commuting routes, and the public knows in advance when and why their lights are dimmer.</p>

      <h2>Layer 1: historical baseline (where and when)</h2>
      <p>For each 10 km (6 mi) grid cell <code>c</code>, species <code>s</code> and month <code>m</code>:</p>
      <p><code>baseline(c, s, m) = spatial(c, s) × seasonal(s, state(c), m)</code></p>
      <ul>
        <li><b>spatial</b> is the USGS NABat summer occupancy probability (mean of 2017-2019) for the 12 species NABat models. For five species NABat does not model in summer (Mexican free-tailed, eastern red, Indiana, evening and southeastern myotis bats) it is a GBIF point density: log counts per cell, smoothed with a 1.5-cell Gaussian, scaled so the 98th percentile equals 1.</li>
        <li><b>seasonal</b> is the species&apos; monthly GBIF record count in the cell&apos;s state (national when the state has fewer than 120 records), smoothed with a 3-month kernel and normalized to its peak month. For cave-hibernating species a torpor mask (Nov-Mar near zero, ramping through April and October) is applied, because their winter records are hibernacula surveys of torpid bats, not flight activity.</li>
        <li>The community baseline combines species as <code>0.7 × max + 0.3 × weighted mean</code>: the dominant species sets the level and the others add to it, so a cell with one huge colony is not diluted by nine sparse species. Listed species are weighted higher (Endangered ×2, proposed ×2, under review ×1.2-1.5); weights can be switched off.</li>
        <li>In the pilot corridors a <b>roost term</b> is added: segments near a documented colony take on that colony species&apos; seasonal curve, scaled by colony size (<code>log10(colony)/7</code>) and distance (<code>exp(-½(km/σ)²)</code> with <code>σ = 6 km (3.7 mi) × (1 + log10(colony/10,000))</code>, about 25 km (16 mi) for Bracken Cave&apos;s 15 million bats).</li>
      </ul>
      <p>Why historical? Bat migration is not tracked live at scale. Programs such as NABat and the Motus radio network model movement from years of surveys, and the seasonal calendar they reveal is stable from year to year. The baseline captures that calendar; the second layer adds the night.</p>

      <h2>Layer 2: nightly modifiers (how active tonight)</h2>
      <p><code>BAI = 100 × baseline × f_time(h) × f_temp(T) × f_moon(φ)</code></p>
      <ul>
        <li><b>f_time</b>: activity peaks 1-2 hours after sunset and decays through the night (<code>(h/1.5)·e^(1−h/1.5)</code>), with a small pre-dawn bump. USGS survey guidance and a Montana acoustic study report roughly half of all passes within two hours of sunset.</li>
        <li><b>f_temp</b>: a logistic curve centred on 10 °C (50 °F) with slope 3.5 °C (6.3 °F), so a 4 °C (39 °F) evening gives ~15% of warm-night activity and 20 °C (68 °F) gives ~95%. Evening temperature is the ERA5 mean one hour after sunset for the corridor and month, or tonight&apos;s Open-Meteo forecast.</li>
        <li><b>f_moon</b>: <code>1 − 0.25 × illumination × (1 − 0.8 × cloud)</code>, following a decade-long North Carolina acoustic study that found lower and later activity on bright moonlit nights.</li>
      </ul>

      <h2>Dimming rule</h2>
      <p>For every dark hour of every segment: traffic is estimated as AADT × a typical freeway hour-of-day share (rescaled so the peak hour equals the segment&apos;s HPMS K-factor when reported). Following FHWA&apos;s adaptive lighting criteria, an hour qualifies as low traffic when its volume is at or below 50% of the peak hour. In qualifying hours, lights go to the deep tier (−50% output) when BAI ≥ 35, the moderate tier (−30%) when BAI ≥ 15, and otherwise the base adaptive tier (−15%) that a conventional system would apply anyway. Output never drops below the safety floor (40% of full). All thresholds are sliders.</p>

      <h2>Energy and cost</h2>
      <p><code>kWh saved = lit miles × fixtures/mile × watts × Σ dim(h) / 1000</code>, with defaults of 42 fixtures per mile (26 per km; two sides at ~50 m / 165 ft), 150 W LED, $0.1275/kWh and 0.39 kg (0.86 lb) CO₂/kWh. Annual figures multiply the representative mid-month night by the days in each month. &ldquo;Bat-protected hours&rdquo; counts deep-tier hours. The national streetlight inventory (26.5 million lights, ~$2 billion/yr) gives a sense of scale but is not used in any calculation.</p>

      <h2>Priority score (national map)</h2>
      <p><code>priority(c) = baseline(c) × light01(c)</code> for cells that contain an interstate, where <code>light01</code> is log-scaled VIIRS radiance capped at 60 nW/cm²/sr (radiance has no imperial equivalent). It ranks places where bats and bright highway lighting coincide; the candidate list keeps one entry per route and state.</p>

      <h2>Known limitations</h2>
      <ul>
        <li>NABat&apos;s continental models cover the summer maternity season. Winter and migration-period spatial patterns come from GBIF, which follows where people look.</li>
        <li>GBIF monthly counts carry observer-effort bias (more people outdoors in summer). Normalizing each curve to its own peak keeps the shape, not the magnitude, and the torpor mask corrects the worst artefact (winter hibernacula counts).</li>
        <li>The hour-of-day traffic profile is a typical weekday shape; a deployment would use continuous count stations.</li>
        <li>Lighting inventories are assumed, not measured. Many rural interstate miles (kilometres) are unlit; the savings apply to lit road only.</li>
        <li>Light exposure uses annual average radiance, not the spectrum or height of individual luminaires. Species respond differently; the weights are a coarse proxy.</li>
        <li>No grid integration exists. <code>/api/schedule</code> demonstrates the interface a controller would consume.</li>
      </ul>

      <h2>Data provenance</h2>
      <table>
        <thead><tr><th>Source</th><th>Used for</th><th>License</th></tr></thead>
        <tbody>{SOURCES.map((s) => <tr key={s.name}><td><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></td><td>{s.use}</td><td>{s.license}</td></tr>)}</tbody>
      </table>
      <p>The full pipeline (download, aggregation to the NABat grid, VIIRS cell statistics) is in the repository under <code>pipeline/</code>, and every derived file in <code>app/public/data/</code> records its source. Re-running the pipeline with a newer VNL year or HPMS release updates the app without code changes.</p>
      <p><Link href="/">Back to the map</Link></p>
    </div>
  );
}
