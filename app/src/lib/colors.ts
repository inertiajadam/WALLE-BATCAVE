export type RGBA = [number, number, number, number];

function lerp(a: number[], b: number[], t: number) { return a.map((x, i) => x + (b[i] - x) * t); }
export function ramp(stops: number[][], t: number): RGBA {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const c = lerp(stops[i], stops[i + 1], x - i);
  return [c[0], c[1], c[2], c[3] ?? 255] as RGBA;
}

/** Bat activity: night-purple to warm amber. */
export const ACTIVITY = [[30, 20, 60, 30], [84, 40, 150, 140], [170, 60, 170, 200], [250, 120, 90, 230], [255, 215, 120, 255]];
/** Night lights: transparent to white-gold. */
export const LIGHT = [[0, 0, 0, 0], [60, 80, 160, 120], [140, 170, 230, 190], [255, 235, 160, 240], [255, 255, 255, 255]];
/** Conflict / priority: transparent to hot red. */
export const PRIORITY = [[0, 0, 0, 0], [120, 30, 60, 120], [220, 60, 40, 210], [255, 140, 40, 240], [255, 240, 160, 255]];
/** Traffic: teal to cyan-white. */
export const TRAFFIC = [[10, 50, 60, 120], [20, 140, 160, 190], [60, 220, 240, 230], [220, 255, 255, 255]];

export const cssRamp = (stops: number[][]) => `linear-gradient(90deg, ${stops.map((s) => `rgba(${s[0]},${s[1]},${s[2]},${(s[3] ?? 255) / 255})`).join(",")})`;
