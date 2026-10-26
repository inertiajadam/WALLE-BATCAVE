import corridorsJson from "./corridors.json";

export interface Roost { name: string; lat: number; lon: number; species: string; est: number; note: string; source: string }
export interface Corridor {
  id: string; name: string; state: string; routeNumbers: number[]; fSystems: number[];
  bbox: [number, number, number, number]; roosts: Roost[]; temperaturePoint: { lat: number; lon: number };
}
export const CORRIDORS: Corridor[] = Object.entries(corridorsJson).map(([id, c]) => ({ id, ...(c as Omit<Corridor, "id">) }));
export const CORRIDOR_BY_ID: Record<string, Corridor> = Object.fromEntries(CORRIDORS.map((c) => [c.id, c]));

export interface RoadFeature {
  type: "Feature";
  properties: { route_id: string; routenumber: number; routename?: string; f_system: number; aadt: number; through_lanes?: number; begin_point: number; end_point: number; urban_id?: number; k_factor?: number; dir_factor?: number; speed_limit?: number; facility_type?: number; access_control?: number };
  geometry: { type: "LineString" | "MultiLineString"; coordinates: number[][] | number[][][] };
}
export interface RoadsFile { type: "FeatureCollection"; corridor: string; source: string; features: RoadFeature[] }
export interface GbifFile { corridor: string; source: string; species: Record<string, string>; points: [number, number, number, number | null, number][] }
export interface ClimateFile { source: string; monthly: Record<string, (number | null)[]> }

const cache = new Map<string, Promise<unknown>>();
function get<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.json()));
  return cache.get(url) as Promise<T>;
}
export const loadRoads = (id: string) => get<RoadsFile>(`/data/corridors/${id}_roads.geojson`);
export const loadGbif = (id: string) => get<GbifFile>(`/data/corridors/${id}_gbif.json`);
export const loadClimate = () => get<ClimateFile>(`/data/corridors/climate.json`);

/** Length in miles of a LineString in lon/lat. */
export function lineMiles(coords: number[][]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1], [x2, y2] = coords[i];
    const dx = (x2 - x1) * Math.cos(((y1 + y2) / 2) * Math.PI / 180) * 111.32, dy = (y2 - y1) * 110.57;
    m += Math.hypot(dx, dy);
  }
  return m * 0.621371;
}
export function featureMiles(f: RoadFeature): number {
  if (f.geometry.type === "LineString") return lineMiles(f.geometry.coordinates as number[][]);
  return (f.geometry.coordinates as number[][][]).reduce((a, c) => a + lineMiles(c), 0);
}
export function featureCenter(f: RoadFeature): [number, number] {
  const c = f.geometry.type === "LineString" ? (f.geometry.coordinates as number[][]) : (f.geometry.coordinates as number[][][])[0];
  const p = c[Math.floor(c.length / 2)];
  return [p[0], p[1]];
}
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180) * 111.32, dy = (lat2 - lat1) * 110.57;
  return Math.hypot(dx, dy);
}
