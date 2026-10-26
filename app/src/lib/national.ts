/** Per-cell computations for the national map, memoized per (month, species set). */
import type { Grid } from "./grid";
import { cellSpeciesValue } from "./grid";
import { SPECIES } from "./species";
import { seasonalCurve, type PhenologyFile } from "./phenology";
import { light01 } from "./model";

export interface NationalField { baseline: Float32Array; priority: Float32Array; light: Float32Array; calibrated: boolean }

export function computeNational(g: Grid, ph: PhenologyFile, month: number, enabled: Set<string>, useWeights: boolean): NationalField {
  const curves = new Map<string, number[]>(); // key: code|state
  const baseline = new Float32Array(g.n), priority = new Float32Array(g.n), light = new Float32Array(g.n);
  const calibrated = /nW/.test(g.lightSource);
  const active = SPECIES.filter((s) => enabled.has(s.code));
  for (let i = 0; i < g.n; i++) {
    const st = g.states[g.state[i]];
    let num = 0, den = 0;
    for (const sp of active) {
      const spatial = cellSpeciesValue(g, i, sp.code);
      if (spatial === null) continue;
      const key = sp.code + "|" + st;
      let c = curves.get(key);
      if (!c) { c = seasonalCurve(ph, sp.code, st); curves.set(key, c); }
      const w = useWeights ? sp.weight : 1;
      num += w * spatial * c[month]; den += w;
    }
    baseline[i] = den ? num / den : 0;
    light[i] = light01(g.light[i], calibrated);
    priority[i] = g.interstateKm[i] > 0 ? baseline[i] * light[i] : 0;
  }
  return { baseline, priority, light, calibrated };
}

export interface Candidate { i: number; grts: number; score: number; routes: number[]; state: string; aadt: number; lon: number; lat: number; baseline: number; light: number }

/** Top candidate Black Corridor cells, de-duplicated so one route per state does not dominate. */
export function topCandidates(g: Grid, f: NationalField, n = 12): Candidate[] {
  const idx = Array.from({ length: g.n }, (_, i) => i).filter((i) => f.priority[i] > 0).sort((a, b) => f.priority[b] - f.priority[a]);
  const seen = new Set<string>(); const out: Candidate[] = [];
  for (const i of idx) {
    const key = g.states[g.state[i]] + ":" + (g.routes[i][0] ?? "x");
    if (seen.has(key)) continue; seen.add(key);
    out.push({ i, grts: g.grts[i], score: f.priority[i], routes: g.routes[i], state: g.states[g.state[i]], aadt: g.aadt[i], lon: g.lon[i], lat: g.lat[i], baseline: f.baseline[i], light: f.light[i] });
    if (out.length >= n) break;
  }
  return out;
}

/** Typical evening (1 h after sunset) temperature for the contiguous US by month, used when no local climate is loaded. */
export const US_EVENING_TEMP_C = [2, 4, 9, 14, 19, 24, 26, 25, 21, 15, 8, 3];
