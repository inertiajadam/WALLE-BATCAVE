/**
 * The Black Corridor model.
 *
 * Layer 1 (historical baseline): where and when bats are present.
 *   baseline(cell, species, month) = spatial(cell, species) x seasonal(species, state, month)
 *   spatial  = NABat summer occupancy probability (USGS, 2017-2019 mean) or GBIF density
 *   seasonal = normalized GBIF monthly occurrence curve (see phenology.ts)
 *
 * Layer 2 (nightly modifiers): how active they are on a given night and hour.
 *   f_time(hours after sunset)  peak 1-2 h after sunset, decaying through the night, small pre-dawn bump
 *   f_temp(C)                   logistic around 10 C (activity rises steeply with evening temperature)
 *   f_moon(illumination)        up to -25% on bright moonlit nights
 *
 * Bat Activity Index (BAI, 0-100) = 100 x weighted mean over species of baseline x modifiers.
 * Dimming decision per hour follows FHWA adaptive-lighting criteria (traffic reduced >=50% from
 * peak hourly volume) combined with BAI thresholds, bounded by a safety floor.
 */
import { SPECIES, SPECIES_BY_CODE } from "./species";
import { hourlyVolume, peakHourlyVolume } from "./traffic";
import type { Grid } from "./grid";
import { cellSpeciesValue } from "./grid";
import { seasonalCurve, type PhenologyFile } from "./phenology";

export interface NightConditions {
  /** Evening temperature in C (about 1 h after sunset). */
  tempC: number;
  /** Fraction of the moon illuminated, 0-1. */
  moon: number;
  /** Cloud cover 0-1 (reduces the moon effect). */
  cloud?: number;
}

export interface ModelWeights {
  tempMidC: number; tempSlope: number; moonPenalty: number; peakHour: number; dawnBump: number;
}
export const DEFAULT_WEIGHTS: ModelWeights = { tempMidC: 10, tempSlope: 3.5, moonPenalty: 0.25, peakHour: 1.5, dawnBump: 0.25 };

/** Activity vs hours after sunset, 0-1. Gamma-shaped peak near `peakHour`, plus a pre-dawn bump. */
export function fTime(hoursAfterSunset: number, nightLength: number, w = DEFAULT_WEIGHTS): number {
  if (hoursAfterSunset < 0 || hoursAfterSunset > nightLength) return 0;
  const h = hoursAfterSunset / w.peakHour;
  const main = h * Math.exp(1 - h);
  const toDawn = nightLength - hoursAfterSunset;
  const dawn = w.dawnBump * Math.exp(-0.5 * ((toDawn - 1) / 0.8) ** 2);
  return Math.min(1, main + dawn);
}

export function fTemp(tempC: number, w = DEFAULT_WEIGHTS): number {
  return 1 / (1 + Math.exp(-(tempC - w.tempMidC) / w.tempSlope));
}

export function fMoon(moon: number, cloud = 0, w = DEFAULT_WEIGHTS): number {
  return 1 - w.moonPenalty * moon * (1 - 0.8 * cloud);
}

export interface CellBaseline { bai: number; perSpecies: { code: string; value: number }[]; nSpecies: number }

/** Layer 1 for one cell and month: weighted community presence (0-1) and the per-species breakdown. */
export function cellBaseline(g: Grid, ph: PhenologyFile, i: number, month: number, enabled?: Set<string>, useWeights = true): CellBaseline {
  const state = g.states[g.state[i]];
  let num = 0, den = 0, n = 0;
  const per: { code: string; value: number }[] = [];
  for (const sp of SPECIES) {
    if (enabled && !enabled.has(sp.code)) continue;
    const spatial = cellSpeciesValue(g, i, sp.code);
    if (spatial === null) continue;
    const season = seasonalCurve(ph, sp.code, state)[month];
    const v = spatial * season;
    const w = useWeights ? sp.weight : 1;
    num += w * v; den += w; n++;
    per.push({ code: sp.code, value: v });
  }
  per.sort((a, b) => b.value - a.value);
  return { bai: den ? num / den : 0, perSpecies: per, nSpecies: n };
}

/** Layer 2 applied to a baseline: 0-100 index for a specific hour of a specific night. */
export function activityIndex(baseline: number, hoursAfterSunset: number, nightLength: number, c: NightConditions, w = DEFAULT_WEIGHTS): number {
  return 100 * baseline * fTime(hoursAfterSunset, nightLength, w) * fTemp(c.tempC, w) * fMoon(c.moon, c.cloud ?? 0, w);
}

// ---------------------------------------------------------------- dimming + energy

export interface DimmingPolicy {
  /** BAI at or above which lights go to the deep-dim level. */
  baiHigh: number;
  /** BAI at or above which lights go to the moderate-dim level. */
  baiLow: number;
  /** Fraction of full output removed at each tier (0.5 = lights at 50%). */
  deepDim: number; moderateDim: number; baseDim: number;
  /** Safety floor: lights never drop below this fraction of full output. */
  floor: number;
  /** FHWA adaptive criterion: hourly volume must be below this fraction of the peak hour. */
  trafficRatio: number;
  /** Fraction of the deep-dim tier applied regardless of traffic within 300 m of a known roost (roost zones). */
  roostZone: boolean;
}
export const DEFAULT_POLICY: DimmingPolicy = { baiHigh: 35, baiLow: 15, deepDim: 0.5, moderateDim: 0.3, baseDim: 0.15, floor: 0.4, trafficRatio: 0.5, roostZone: true };

export interface EnergyAssumptions {
  fixturesPerMile: number; wattsPerFixture: number; pricePerKWh: number; co2KgPerKWh: number;
}
/** Defaults: DOE MSSLC inventory and IES RP-8 spacing typical of a lit freeway (two sides, ~50 m spacing);
 *  150 W LED cobra head; EIA 2024 US commercial average price; EPA eGRID 2022 US average emission factor. */
export const DEFAULT_ENERGY: EnergyAssumptions = { fixturesPerMile: 42, wattsPerFixture: 150, pricePerKWh: 0.1275, co2KgPerKWh: 0.39 };

export interface HourResult {
  hour: number; hoursAfterSunset: number; dark: boolean; bai: number; traffic: number; trafficRatio: number; lowTraffic: boolean; dim: number; tier: "full" | "base" | "moderate" | "deep";
}

/** 24-hour schedule for one segment-night. `hour` is local clock hour 0-23 starting at 12:00 noon ordering. */
export function nightSchedule(
  baseline: number, aadt: number, sunsetHour: number, sunriseHour: number, c: NightConditions,
  policy = DEFAULT_POLICY, w = DEFAULT_WEIGHTS, kFactor?: number,
): HourResult[] {
  const nightLength = ((sunriseHour - sunsetHour) + 24) % 24;
  const peak = peakHourlyVolume(aadt, kFactor);
  const out: HourResult[] = [];
  for (let k = 0; k < 24; k++) {
    const hour = (12 + k) % 24; // start the day at noon so the night is contiguous
    const mid = hour + 0.5;
    let has = ((mid - sunsetHour) + 24) % 24;
    const dark = has < nightLength;
    if (!dark) has = -1;
    const bai = dark ? activityIndex(baseline, has, nightLength, c, w) : 0;
    const traffic = hourlyVolume(aadt, hour, kFactor);
    const ratio = peak > 0 ? traffic / peak : 1;
    const lowTraffic = ratio <= policy.trafficRatio;
    let dim = 0; let tier: HourResult["tier"] = "full";
    if (dark && lowTraffic) {
      if (bai >= policy.baiHigh) { dim = policy.deepDim; tier = "deep"; }
      else if (bai >= policy.baiLow) { dim = policy.moderateDim; tier = "moderate"; }
      else { dim = policy.baseDim; tier = "base"; }
    }
    dim = Math.min(dim, 1 - policy.floor);
    out.push({ hour, hoursAfterSunset: has, dark, bai, traffic, trafficRatio: ratio, lowTraffic, dim, tier });
  }
  return out;
}

export interface NightEnergy { kWhSaved: number; kWhBaseline: number; dollars: number; co2Kg: number; dimHours: number; deepHours: number; batBenefit: number }

/** Energy for one night over `miles` of lit road given a schedule. batBenefit = sum of BAI x dim over dark hours. */
export function nightEnergy(sched: HourResult[], miles: number, e: EnergyAssumptions): NightEnergy {
  const kW = (miles * e.fixturesPerMile * e.wattsPerFixture) / 1000;
  let saved = 0, base = 0, dimHours = 0, deep = 0, benefit = 0;
  for (const h of sched) {
    if (!h.dark) continue;
    base += kW; saved += kW * h.dim;
    if (h.dim > 0) dimHours++; if (h.tier === "deep") deep++;
    benefit += (h.bai / 100) * h.dim;
  }
  return { kWhSaved: saved, kWhBaseline: base, dollars: saved * e.pricePerKWh, co2Kg: saved * e.co2KgPerKWh, dimHours, deepHours: deep, batBenefit: benefit };
}

/** Priority score for ranking national cells: activity x light x interstate presence x nightly low-traffic window. */
export function corridorPriority(baseline: number, light01: number, hasInterstate: boolean): number {
  return hasInterstate ? baseline * light01 : 0;
}

/** Map a night-light value to 0-1 using a log scale. Works for both calibrated radiance (nW/cm2/sr, cap 60) and the 0-255 proxy. */
export function light01(v: number, calibrated: boolean): number {
  return calibrated ? Math.min(1, Math.log1p(Math.max(0, v)) / Math.log1p(60)) : Math.min(1, Math.log1p(Math.max(0, v)) / Math.log1p(255));
}

export const SPECIES_LIST = SPECIES; export { SPECIES_BY_CODE };
