/**
 * Layer 1 of the two-layer model: the historical seasonal baseline.
 * Monthly GBIF occurrence counts per species, per state (fallback: national), normalized to the
 * species' own peak month, so the curve expresses *when* a species is present, not how many
 * records exist. Hibernating species get a torpor mask (Nov-Mar), because their winter GBIF
 * records are dominated by hibernacula surveys of torpid bats, which are not flight activity.
 */
import { SPECIES_BY_CODE } from "./species";

export interface PhenologyFile {
  [code: string]: { key: number; name: string; common: string; total: number; national: number[]; states: Record<string, number[]> };
}

let cache: Promise<PhenologyFile> | null = null;
export function loadPhenology(): Promise<PhenologyFile> {
  if (!cache) cache = fetch("/data/phenology.json").then((r) => r.json());
  return cache;
}

/** Torpor mask by month index (0 = January) for cave-hibernating species. */
export const TORPOR_MASK = [0.03, 0.03, 0.15, 0.7, 1, 1, 1, 1, 1, 0.8, 0.2, 0.03];
const MIN_STATE_RECORDS = 120;

/** Smooth a 12-month series with a circular 3-point kernel (0.25, 0.5, 0.25). */
function smooth(v: number[]): number[] {
  return v.map((_, i) => 0.25 * v[(i + 11) % 12] + 0.5 * v[i] + 0.25 * v[(i + 1) % 12]);
}

/** Normalized 0-1 seasonal curve for a species in a state (12 values, Jan..Dec). */
export function seasonalCurve(ph: PhenologyFile, code: string, state?: string): number[] {
  const rec = ph[code];
  if (!rec) return new Array(12).fill(1);
  let raw = rec.national;
  if (state && rec.states[state] && rec.states[state].reduce((a, b) => a + b, 0) >= MIN_STATE_RECORDS) raw = rec.states[state];
  const eco = SPECIES_BY_CODE[code]?.ecology;
  let v = smooth(raw.map((x) => x + 0.5));
  if (eco === "hibernator") v = v.map((x, i) => x * TORPOR_MASK[i]);
  const max = Math.max(...v);
  return v.map((x) => (max > 0 ? x / max : 0));
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
