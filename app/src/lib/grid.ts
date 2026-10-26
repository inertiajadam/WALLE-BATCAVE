/** Loader for public/data/grid.json produced by pipeline/build_grid.py. */
export interface Grid {
  n: number;
  species: string[];
  grts: Int32Array;
  lon: Float32Array;
  lat: Float32Array;
  /** 0-250 occupancy (x/250), 255 = not modeled for that species. Keyed by species code. */
  occ: Record<string, Uint8Array>;
  /** 0-1 relative occurrence density for GBIF-derived species (TABR, LABO, MYSO). */
  density: Record<string, Float32Array>;
  light: Float32Array;
  lightSource: string;
  /** Calibrated radiance per year (e.g. "2022".."2025") when the EOG VNL pipeline has run. */
  lightYears: Record<string, Float32Array>;
  aadt: Float32Array;
  interstateKm: Float32Array;
  routes: number[][];
  state: Uint8Array;
  states: string[];
  sources: Record<string, string>;
}

function decode<T extends ArrayBufferView>(b64: string, Ctor: new (buf: ArrayBuffer) => T): T {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return new Ctor(buf);
}

let cache: Promise<Grid> | null = null;

export function loadGrid(): Promise<Grid> {
  if (!cache) {
    cache = fetch("/data/grid.json").then(async (r) => {
      const j = await r.json();
      const occ: Record<string, Uint8Array> = {};
      for (const sp of j.species) occ[sp] = decode(j.occ[sp], Uint8Array);
      const density: Record<string, Float32Array> = {};
      for (const sp of Object.keys(j.density ?? {})) density[sp] = decode(j.density[sp], Float32Array);
      const lightYears: Record<string, Float32Array> = {};
      for (const y of Object.keys(j.lightYears ?? {})) lightYears[y] = decode(j.lightYears[y], Float32Array);
      return {
        n: j.n, species: j.species,
        grts: decode(j.grts, Int32Array), lon: decode(j.lon, Float32Array), lat: decode(j.lat, Float32Array),
        occ, density, light: decode(j.light, Float32Array), lightSource: j.lightSource, lightYears,
        aadt: decode(j.aadt, Float32Array), interstateKm: decode(j.interstateKm, Float32Array),
        routes: j.routes, state: decode(j.state, Uint8Array), states: j.states, sources: j.sources,
      } as Grid;
    });
  }
  return cache;
}

/** Occupancy or density for a species in a cell, 0-1, or null if the species is not modeled there. */
export function cellSpeciesValue(g: Grid, i: number, code: string): number | null {
  if (g.occ[code]) { const v = g.occ[code][i]; return v === 255 ? null : v / 250; }
  if (g.density[code]) { const v = g.density[code][i]; return v > 0 ? v : null; }
  return null;
}
