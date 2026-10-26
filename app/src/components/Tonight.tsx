"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadGrid, type Grid } from "@/lib/grid";
import { loadPhenology, type PhenologyFile } from "@/lib/phenology";
import { loadRoads, loadClimate, CORRIDORS, distanceKm, type RoadsFile, type ClimateFile, type Corridor } from "@/lib/corridors";
import { buildSegments, corridorNight } from "@/lib/corridorModel";
import { DEFAULT_POLICY, DEFAULT_ENERGY } from "@/lib/model";
import { SPECIES_BY_CODE } from "@/lib/species";
import { fmtInt, fmtPct, fmtUSD, fmtTemp, fmtKm } from "@/lib/format";
import { fmtTimeTz } from "@/lib/sun";

interface Forecast { tempC: number; cloud: number; source: string }

async function fetchForecast(lat: number, lon: number, sunset: Date): Promise<Forecast | null> {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,cloud_cover&forecast_days=2&timezone=auto`;
    const d = await (await fetch(u)).json();
    const target = new Date(sunset.getTime() + 3600e3);
    const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}T${String(target.getHours()).padStart(2, "0")}:00`;
    const i = (d.hourly.time as string[]).indexOf(key);
    if (i < 0) return null;
    return { tempC: d.hourly.temperature_2m[i], cloud: d.hourly.cloud_cover[i] / 100, source: "Open-Meteo forecast" };
  } catch { return null; }
}

export default function Tonight() {
  const [grid, setGrid] = useState<Grid | null>(null); const [ph, setPh] = useState<PhenologyFile | null>(null); const [climate, setClimate] = useState<ClimateFile | null>(null);
  const [roadsById, setRoadsById] = useState<Record<string, RoadsFile>>({}); const [cid, setCid] = useState(CORRIDORS[0].id); const [forecast, setForecast] = useState<Forecast | null>(null);
  const [geo, setGeo] = useState<string | null>(null);
  const corridor: Corridor = CORRIDORS.find((c) => c.id === cid)!;

  useEffect(() => { loadGrid().then(setGrid); loadPhenology().then(setPh); loadClimate().then(setClimate); }, []);
  useEffect(() => { loadRoads(cid).then((r) => setRoadsById((m) => (m[cid] ? m : { ...m, [cid]: r }))); }, [cid]);
  const roads = roadsById[cid] ?? null;

  const segs = useMemo(() => (grid && ph && roads ? buildSegments(corridor, roads, grid, ph) : []), [grid, ph, roads, corridor]);
  const now = useMemo(() => new Date(), []);
  const base = useMemo(() => (segs.length ? corridorNight(corridor, segs, now.getMonth(), climate, DEFAULT_POLICY, DEFAULT_ENERGY, { date: now }) : null), [segs, corridor, climate, now]);
  useEffect(() => { if (base) fetchForecast(corridor.temperaturePoint.lat, corridor.temperaturePoint.lon, base.sunset).then(setForecast); }, [base, corridor]);
  const night = useMemo(() => (segs.length ? corridorNight(corridor, segs, now.getMonth(), climate, DEFAULT_POLICY, DEFAULT_ENERGY, { date: now, ...(forecast ? { tempC: forecast.tempC, cloud: forecast.cloud } : {}) }) : null), [segs, corridor, climate, now, forecast]);

  const locate = () => navigator.geolocation?.getCurrentPosition((p) => {
    const best = CORRIDORS.map((c) => ({ c, d: distanceKm(p.coords.latitude, p.coords.longitude, (c.bbox[1] + c.bbox[3]) / 2, (c.bbox[0] + c.bbox[2]) / 2) })).sort((a, b) => a.d - b.d)[0];
    setCid(best.c.id); setGeo(`Nearest pilot corridor is ${fmtKm(best.d, 0)} away`);
  }, () => setGeo("Location unavailable; pick a corridor below"));

  const dark = night?.schedule.filter((h) => h.dark) ?? []; const dim = dark.filter((h) => h.dim > 0); const deep = dark.filter((h) => h.tier === "deep");
  const hh = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "am" : "pm"}`;
  const topRoost = corridor.roosts[0]; const sp = SPECIES_BY_CODE[topRoost.species];
  const status = !night ? "loading" : deep.length ? "deep" : dim.length ? "dim" : "full";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Lights near me tonight</h1>
      <p className="mt-1 text-muted">For residents, drivers and local governments: what the highway lights will do tonight, and why.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={locate} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white/5">Use my location</button>
        <select value={cid} onChange={(e) => setCid(e.target.value)} className="rounded-lg border border-line bg-bg-2 px-3 py-1.5 text-sm">{CORRIDORS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        {geo && <span className="text-xs text-muted">{geo}</span>}
      </div>

      <div className="panel mt-5 p-5">
        <div className="label">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {corridor.name}</div>
        {night ? (
          <>
            <div className="mt-2 text-2xl font-semibold leading-snug">
              {status === "deep" && <>Lights will be <span className="text-bat">noticeably dimmer</span> from {hh(deep[0].hour)} to {hh((deep[deep.length - 1].hour + 1) % 24)}.</>}
              {status === "dim" && <>Lights will be <span className="text-accent">slightly dimmer</span> from {hh(dim[0].hour)} to {hh((dim[dim.length - 1].hour + 1) % 24)}.</>}
              {status === "full" && <>Lights will stay at <span className="text-accent">normal brightness</span> tonight.</>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><div className="label">Sunset</div>{fmtTimeTz(night.sunset, corridor.tz)}</div>
              <div><div className="label">Evening temp</div>{fmtTemp(night.conditions.tempC)} <span className="text-xs text-muted">{forecast ? "(forecast)" : "(climate)"}</span></div>
              <div><div className="label">Moon</div>{fmtPct(night.conditions.moon)} lit</div>
              <div><div className="label">Lowest output</div>{fmtPct(1 - Math.max(...dark.map((h) => h.dim), 0))}</div>
            </div>
            <div className="mt-4 flex h-6 overflow-hidden rounded-md border border-line">
              {dark.map((h) => <div key={h.hour} title={`${hh(h.hour)}: ${fmtPct(1 - h.dim)} output, bat index ${Math.round(h.bai)}`} className="flex-1 border-r border-black/40 last:border-r-0" style={{ background: h.tier === "deep" ? "#5a3cc8" : h.tier === "moderate" ? "#c85ac8" : h.tier === "base" ? "#ffaa3c" : "#ffdc78" }} />)}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{fmtTimeTz(night.sunset, corridor.tz)}</span><span>{fmtTimeTz(night.sunrise, corridor.tz)}</span></div>
          </>
        ) : <div className="mt-2 text-muted">Computing tonight&apos;s schedule…</div>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="panel p-4 text-sm">
          <div className="label mb-1">Why</div>
          <p className="text-muted"><b className="text-fg">{topRoost.name}</b> is home to {topRoost.est ? `about ${Intl.NumberFormat("en-US", { notation: "compact" }).format(topRoost.est)} ` : ""}{sp.common}s. {sp.note} Bats are most active in the first two hours after sunset, and highway lighting pushes them away from the roads they need to cross. {night && dim.length ? `Tonight traffic on this corridor drops below half its peak around ${hh(dim[0].hour)}, so lights can safely dim.` : ""}</p>
        </div>
        <div className="panel p-4 text-sm">
          <div className="label mb-1">Safety</div>
          <ul className="list-disc space-y-1 pl-4 text-muted">
            <li>Lights never go below {fmtPct(DEFAULT_POLICY.floor)} of normal output, within adaptive-lighting practice used by FHWA and the Illuminating Engineering Society.</li>
            <li>Dimming only applies while traffic is light; output returns to full automatically when volumes rise.</li>
            <li>Interchanges, work zones and crash hot spots would be excluded in a real deployment.</li>
            {night && <li>Tonight&apos;s schedule saves roughly {fmtInt(night.energy.kWhSaved)} kWh ({fmtUSD(night.energy.dollars)}) on this corridor alone.</li>}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">Prototype. Schedules come from the Black Corridor model, not from any utility. Details in <Link className="text-accent-2" href="/methodology">Methodology</Link>.</p>
    </div>
  );
}
