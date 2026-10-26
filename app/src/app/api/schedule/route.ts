/**
 * Simulated grid-integration endpoint. A utility SCADA or smart-lighting controller would poll this
 * nightly to receive per-segment dimming setpoints. Everything is computed from the same model as the
 * UI; nothing here touches a real grid.
 *
 *   GET /api/schedule?corridor=tx-i35&date=2026-08-15&temp=27&moon=0.3
 */
import { NextResponse } from "next/server";
import { CORRIDOR_BY_ID, CORRIDORS } from "@/lib/corridors";
import { nightSchedule, DEFAULT_POLICY, DEFAULT_ENERGY, nightEnergy } from "@/lib/model";
import { nightWindow, localHour } from "@/lib/sun";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("corridor") ?? "tx-i35";
  const c = CORRIDOR_BY_ID[id];
  if (!c) return NextResponse.json({ error: "unknown corridor", corridors: CORRIDORS.map((x) => x.id) }, { status: 404 });
  const date = url.searchParams.get("date") ? new Date(url.searchParams.get("date") + "T12:00:00") : new Date();
  const month = date.getMonth();
  const climate = JSON.parse(await readFile(path.join(process.cwd(), "public/data/corridors/climate.json"), "utf8"));
  const roads = JSON.parse(await readFile(path.join(process.cwd(), `public/data/corridors/${id}_roads.geojson`), "utf8"));
  const tempC = Number(url.searchParams.get("temp") ?? climate.monthly[id][month] ?? 15);
  const nw = nightWindow(date, c.temperaturePoint.lat, c.temperaturePoint.lon);
  const moon = Number(url.searchParams.get("moon") ?? nw.moonIllumination);
  const sunsetH = localHour(nw.sunset, c.tz), sunriseH = localHour(nw.sunrise, c.tz);

  // Server-side we do not load the 4 MB grid; the API uses the corridor's roost-season baseline as a conservative proxy.
  const seasonal = [0.15, 0.3, 0.55, 0.8, 0.9, 1, 1, 1, 0.95, 0.7, 0.35, 0.15][month];
  const setpoints = roads.features.slice(0, 400).map((f: { properties: { route_id: string; aadt: number; k_factor?: number; begin_point: number; end_point: number } }) => {
    const s = nightSchedule(0.7 * seasonal, f.properties.aadt, sunsetH, sunriseH, { tempC, moon }, DEFAULT_POLICY, undefined, f.properties.k_factor);
    return { route_id: f.properties.route_id, from_mile: f.properties.begin_point, to_mile: f.properties.end_point, aadt: f.properties.aadt, hourly_output_pct: s.filter((h) => h.dark).map((h) => ({ hour: h.hour, output: Math.round(100 * (1 - h.dim)), tier: h.tier })) };
  });
  const corridorSched = nightSchedule(0.7 * seasonal, 90000, sunsetH, sunriseH, { tempC, moon }, DEFAULT_POLICY);
  const energy = nightEnergy(corridorSched, 60, DEFAULT_ENERGY);
  return NextResponse.json({
    corridor: id, name: c.name, timezone: c.tz, date: date.toISOString().slice(0, 10), sunset: nw.sunset.toISOString(), sunrise: nw.sunrise.toISOString(), hours_are_local: true,
    conditions: { tempC, moonIllumination: moon }, policy: DEFAULT_POLICY, segments: setpoints.length, estimated_night_kwh_saved: Math.round(energy.kWhSaved), setpoints,
    disclaimer: "Prototype output for demonstration. Not connected to any utility control system.",
  });
}
