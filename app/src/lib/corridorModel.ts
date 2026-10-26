/** Corridor-level computations shared by the corridor page, the utility dashboard, the Tonight page, and the API. */
import { CORRIDOR_BY_ID, featureCenter, featureMiles, distanceKm, type RoadsFile, type Corridor, type ClimateFile } from "./corridors";
import { cellSpeciesValue, type Grid } from "./grid";
import { seasonalCurve, type PhenologyFile, MONTH_DAYS } from "./phenology";
import { SPECIES, SPECIES_BY_CODE } from "./species";
import { nightSchedule, nightEnergy, DEFAULT_POLICY, DEFAULT_ENERGY, type DimmingPolicy, type EnergyAssumptions, type NightConditions, type HourResult, type NightEnergy } from "./model";
import { nightWindow, midMonthDate } from "./sun";

export interface Segment {
  idx: number; routeId: string; route: number; aadt: number; kFactor?: number; miles: number; center: [number, number];
  /** Baseline activity (0-1) for each month, from the nearest grid cell + roost proximity bonus. */
  baseline: number[]; nearestRoostKm: number; roostName?: string; cell: number;
}

/** Nearest grid cell index to a lon/lat (brute force over a bbox-prefiltered subset). */
function nearestCell(g: Grid, lon: number, lat: number, bbox: [number, number, number, number]): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < g.n; i++) {
    const x = g.lon[i], y = g.lat[i];
    if (x < bbox[0] - 0.2 || x > bbox[2] + 0.2 || y < bbox[1] - 0.2 || y > bbox[3] + 0.2) continue;
    const d = (x - lon) ** 2 + (y - lat) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Roost influence: 1 at the roost, decaying to 0 by ~15 km (free-tailed bats commute much farther, but lights near the colony matter most). */
export function roostFactor(km: number): number { return Math.exp(-0.5 * (km / 6) ** 2); }

export function buildSegments(c: Corridor, roads: RoadsFile, g: Grid, ph: PhenologyFile, enabled?: Set<string>): Segment[] {
  const state = c.state === "TX" ? "Texas" : c.state === "KY" ? "Kentucky" : c.state === "NM" ? "New Mexico" : undefined;
  const curves = new Map<string, number[]>();
  const curve = (code: string) => { let v = curves.get(code); if (!v) { v = seasonalCurve(ph, code, state); curves.set(code, v); } return v; };
  const cellCache = new Map<number, number[]>();
  const segs: Segment[] = [];
  roads.features.forEach((f, idx) => {
    const center = featureCenter(f);
    const cell = nearestCell(g, center[0], center[1], c.bbox);
    if (cell < 0) return;
    let base = cellCache.get(cell);
    if (!base) {
      base = new Array(12).fill(0);
      let den = 0;
      for (const sp of SPECIES) {
        if (enabled && !enabled.has(sp.code)) continue;
        const v = cellSpeciesValue(g, cell, sp.code); if (v === null) continue;
        const cv = curve(sp.code);
        for (let m = 0; m < 12; m++) base[m] += sp.weight * v * cv[m];
        den += sp.weight;
      }
      if (den) base = base.map((x) => x / den);
      cellCache.set(cell, base);
    }
    // roost proximity: blend toward the roost species' seasonal curve, scaled by colony size
    let nearestRoostKm = Infinity, roostName: string | undefined, roostBoost = new Array(12).fill(0);
    for (const r of c.roosts) {
      const km = distanceKm(center[1], center[0], r.lat, r.lon);
      if (km < nearestRoostKm) { nearestRoostKm = km; roostName = r.name; }
      const size = Math.min(1, Math.log10(Math.max(r.est, 1000)) / 7); // 10^7 bats -> 1
      const rf = roostFactor(km) * size;
      if (rf > 0.01 && (!enabled || enabled.has(r.species))) { const cv = curve(r.species); roostBoost = roostBoost.map((x, m) => Math.max(x, rf * cv[m])); }
    }
    const baseline = base.map((x, m) => Math.min(1, x + roostBoost[m] * (1 - x)));
    segs.push({ idx, routeId: f.properties.route_id, route: f.properties.routenumber, aadt: f.properties.aadt, kFactor: f.properties.k_factor, miles: featureMiles(f), center, baseline, nearestRoostKm, roostName, cell });
  });
  return segs;
}

export interface CorridorNight { month: number; date: Date; sunset: Date; sunrise: Date; conditions: NightConditions; schedule: HourResult[]; energy: NightEnergy; miles: number; meanBaseline: number }

/** One representative night for the whole corridor, mileage-weighted. */
export function corridorNight(c: Corridor, segs: Segment[], month: number, climate: ClimateFile | null, policy = DEFAULT_POLICY, energy = DEFAULT_ENERGY, overrides?: Partial<NightConditions> & { date?: Date }): CorridorNight {
  const date = overrides?.date ?? midMonthDate(month);
  const nw = nightWindow(date, c.temperaturePoint.lat, c.temperaturePoint.lon);
  const tempC = overrides?.tempC ?? climate?.monthly[c.id]?.[month] ?? 15;
  const conditions: NightConditions = { tempC, moon: overrides?.moon ?? nw.moonIllumination, cloud: overrides?.cloud ?? 0 };
  const miles = segs.reduce((a, s) => a + s.miles, 0);
  const meanBaseline = miles ? segs.reduce((a, s) => a + s.baseline[month] * s.miles, 0) / miles : 0;
  const aadt = miles ? segs.reduce((a, s) => a + s.aadt * s.miles, 0) / miles : 0;
  const sunsetH = nw.sunset.getHours() + nw.sunset.getMinutes() / 60, sunriseH = nw.sunrise.getHours() + nw.sunrise.getMinutes() / 60;
  const schedule = nightSchedule(meanBaseline, aadt, sunsetH, sunriseH, conditions, policy);
  return { month, date, sunset: nw.sunset, sunrise: nw.sunrise, conditions, schedule, energy: nightEnergy(schedule, miles, energy), miles, meanBaseline };
}

/** Schedule for one segment on a given night (used for the map coloring and the API). */
export function segmentNight(c: Corridor, s: Segment, month: number, conditions: NightConditions, policy = DEFAULT_POLICY, date?: Date) {
  const nw = nightWindow(date ?? midMonthDate(month), s.center[1], s.center[0]);
  const sunsetH = nw.sunset.getHours() + nw.sunset.getMinutes() / 60, sunriseH = nw.sunrise.getHours() + nw.sunrise.getMinutes() / 60;
  return nightSchedule(s.baseline[month], s.aadt, sunsetH, sunriseH, conditions, policy, undefined, s.kFactor);
}

export interface AnnualSummary { kWh: number; dollars: number; co2Kg: number; dimHours: number; deepHours: number; batBenefit: number; months: CorridorNight[]; miles: number; baselineKWh: number }

export function annualSummary(c: Corridor, segs: Segment[], climate: ClimateFile | null, policy = DEFAULT_POLICY, energy = DEFAULT_ENERGY): AnnualSummary {
  const months = Array.from({ length: 12 }, (_, m) => corridorNight(c, segs, m, climate, policy, energy));
  const sum = (f: (n: CorridorNight) => number) => months.reduce((a, n, m) => a + f(n) * MONTH_DAYS[m], 0);
  return { kWh: sum((n) => n.energy.kWhSaved), dollars: sum((n) => n.energy.dollars), co2Kg: sum((n) => n.energy.co2Kg), dimHours: sum((n) => n.energy.dimHours), deepHours: sum((n) => n.energy.deepHours), batBenefit: sum((n) => n.energy.batBenefit), months, miles: months[0].miles, baselineKWh: sum((n) => n.energy.kWhBaseline) };
}

export { CORRIDOR_BY_ID, SPECIES_BY_CODE, DEFAULT_POLICY, DEFAULT_ENERGY };
export type { DimmingPolicy, EnergyAssumptions };
