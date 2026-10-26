"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadGrid, type Grid } from "@/lib/grid";
import { loadPhenology, type PhenologyFile, MONTHS, seasonalCurve } from "@/lib/phenology";
import { loadRoads, loadGbif, loadClimate, type Corridor, type RoadsFile, type GbifFile, type ClimateFile } from "@/lib/corridors";
import { buildSegments, corridorNight, annualSummary, segmentNight, STATE_NAME } from "@/lib/corridorModel";
import { DEFAULT_POLICY, DEFAULT_ENERGY, type DimmingPolicy, type EnergyAssumptions } from "@/lib/model";
import { SPECIES_BY_CODE } from "@/lib/species";
import { Chip, Section, Slider, Stat } from "@/components/ui";
import { NightChart, MonthlyBars, PhenologyLines } from "@/components/charts";
import { PolicyControls, EnergyControls } from "@/components/AssumptionsPanel";
import { fmtInt, fmtUSD, fmtPct, fmtNum, fmtCompact, fmtTemp, fmtMiles, fmtKm } from "@/lib/format";
import { fmtTimeTz } from "@/lib/sun";

const CorridorMap = dynamic(() => import("@/components/CorridorMap"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-muted">Loading map…</div> });

export default function CorridorView({ corridor }: { corridor: Corridor }) {
  const [grid, setGrid] = useState<Grid | null>(null); const [ph, setPh] = useState<PhenologyFile | null>(null);
  const [roads, setRoads] = useState<RoadsFile | null>(null); const [gbif, setGbif] = useState<GbifFile | null>(null); const [climate, setClimate] = useState<ClimateFile | null>(null);
  const [month, setMonth] = useState(() => { const m = new Date().getMonth(); return m; });
  const [hourIdx, setHourIdx] = useState(2);
  const [policy, setPolicy] = useState<DimmingPolicy>(DEFAULT_POLICY); const [energy, setEnergy] = useState<EnergyAssumptions>(DEFAULT_ENERGY);
  const [showLights, setShowLights] = useState(true); const [showSightings, setShowSightings] = useState(true);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null); const [tab, setTab] = useState<"night" | "year" | "assumptions">("night");
  const [tempOverride, setTempOverride] = useState<number | null>(null);

  useEffect(() => { loadGrid().then(setGrid); loadPhenology().then(setPh); loadRoads(corridor.id).then(setRoads); loadGbif(corridor.id).then(setGbif); loadClimate().then(setClimate); }, [corridor.id]);

  const segs = useMemo(() => (grid && ph && roads ? buildSegments(corridor, roads, grid, ph) : []), [grid, ph, roads, corridor]);
  const night = useMemo(() => (segs.length ? corridorNight(corridor, segs, month, climate, policy, energy, tempOverride !== null ? { tempC: tempOverride } : undefined) : null), [segs, month, climate, policy, energy, corridor, tempOverride]);
  const annual = useMemo(() => (segs.length ? annualSummary(corridor, segs, climate, policy, energy) : null), [segs, climate, policy, energy, corridor]);
  const darkHours = night ? night.schedule.filter((h) => h.dark) : [];
  const sel = darkHours[Math.min(hourIdx, Math.max(darkHours.length - 1, 0))];

  const dimByIdx = useMemo(() => {
    if (!night || !sel || !roads) return null;
    const arr = new Float32Array(roads.features.length);
    for (const s of segs) { const sc = segmentNight(corridor, s, month, night.conditions, policy); const h = sc.find((x) => x.hour === sel.hour); arr[s.idx] = h ? h.dim : 0; }
    return arr;
  }, [night, sel, roads, segs, corridor, month, policy]);

  const onHoverSegment = useCallback((i: number | null) => setHoverSeg(i), []);
  const hovered = hoverSeg !== null ? segs.find((s) => s.idx === hoverSeg) : undefined;
  const roostSpecies = Array.from(new Set(corridor.roosts.map((r) => r.species)));
  const phenSeries = ph ? roostSpecies.concat(["LACI", "EPFU"].filter((c) => !roostSpecies.includes(c))).map((code) => ({ name: SPECIES_BY_CODE[code].common, color: `rgb(${SPECIES_BY_CODE[code].color.join(",")})`, values: seasonalCurve(ph, code, STATE_NAME[corridor.state]) })) : [];
  const dimmedMiles = dimByIdx && roads ? segs.reduce((a, s) => a + (dimByIdx[s.idx] > 0 ? s.miles : 0), 0) : 0;

  return (
    <div className="grid min-h-[calc(100vh-49px)] grid-cols-1 xl:grid-cols-[1fr_460px]">
      <div className="relative min-h-[460px] xl:h-[calc(100vh-49px)]">
        <CorridorMap corridor={corridor} roads={roads} gbif={gbif} month={month} dimByIdx={dimByIdx} showLights={showLights} showSightings={showSightings} onHoverSegment={onHoverSegment} />
        <div className="pointer-events-none absolute left-3 top-3 flex max-w-[420px] flex-col gap-2">
          <div className="panel pointer-events-auto p-3">
            <div className="label">Corridor</div>
            <h1 className="text-base font-semibold leading-tight">{corridor.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip on={showLights} onClick={() => setShowLights(!showLights)}>Night lights (NASA)</Chip>
              <Chip on={showSightings} onClick={() => setShowSightings(!showSightings)}>GBIF sightings ({MONTHS[month]})</Chip>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
              <span><i className="mr-1 inline-block h-2 w-4 rounded bg-[#ffdc78]" />full</span><span><i className="mr-1 inline-block h-2 w-4 rounded bg-[#ffaa3c]" />base dim</span><span><i className="mr-1 inline-block h-2 w-4 rounded bg-[#c85ac8]" />moderate</span><span><i className="mr-1 inline-block h-2 w-4 rounded bg-[#5a3cc8]" />deep (bats)</span>
            </div>
          </div>
          {hovered && (
            <div className="panel pointer-events-auto p-3 text-sm">
              <div className="label">Segment · route {hovered.route}</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span className="text-muted">AADT</span><b className="stat">{fmtInt(hovered.aadt)}</b>
                <span className="text-muted">Length</span><b className="stat">{fmtMiles(hovered.miles, 2)}</b>
                <span className="text-muted">Baseline activity ({MONTHS[month]})</span><b className="stat">{fmtPct(hovered.baseline[month])}</b>
                <span className="text-muted">Nearest roost</span><b className="truncate">{hovered.roostName} · {fmtKm(hovered.nearestRoostKm)}</b>
                <span className="text-muted">Output at {sel ? `${((sel.hour + 11) % 12) + 1}${sel.hour < 12 ? "am" : "pm"}` : "—"}</span><b className="stat">{dimByIdx ? fmtPct(1 - dimByIdx[hovered.idx]) : "—"}</b>
              </div>
            </div>
          )}
        </div>
        {night && sel && (
          <div className="panel absolute bottom-3 left-3 right-3 p-3 xl:right-auto xl:w-[480px]">
            <Slider label={`Night of ${MONTHS[month]} 15 · sunset ${fmtTimeTz(night.sunset, corridor.tz)} · sunrise ${fmtTimeTz(night.sunrise, corridor.tz)}`} value={Math.min(hourIdx, darkHours.length - 1)} min={0} max={Math.max(darkHours.length - 1, 0)} onChange={setHourIdx} format={(v) => { const h = darkHours[v]; return h ? `${((h.hour + 11) % 12) + 1}:00 ${h.hour < 12 ? "am" : "pm"}` : ""; }} />
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>Bat activity <b className="stat text-fg">{Math.round(sel.bai)}</b></span>
              <span>Traffic <b className="stat text-fg">{fmtPct(sel.trafficRatio)}</b> of peak</span>
              <span>Lights at <b className="stat text-fg">{fmtPct(1 - sel.dim)}</b></span>
              <span>Dimmed <b className="stat text-fg">{fmtNum(dimmedMiles, 0)}</b> of {fmtMiles(night.miles)} lit</span>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-3 overflow-y-auto border-l border-line p-4 xl:h-[calc(100vh-49px)]">
        <Slider label="Month" value={month} min={0} max={11} onChange={(m) => { setMonth(m); setTempOverride(null); }} format={(v) => MONTHS[v]} />
        {annual && (
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Annual energy saved" value={`${fmtCompact(annual.kWh)} kWh`} sub={`${fmtPct(annual.kWh / annual.baselineKWh)} of lighting load · ${fmtMiles(annual.miles)} lit`} accent="#4ade80" />
            <Stat label="Annual savings" value={fmtUSD(annual.dollars)} sub={`at $${energy.pricePerKWh.toFixed(3)}/kWh`} accent="#f5b342" />
            <Stat label="CO₂ avoided" value={`${fmtCompact(annual.co2Kg / 1000)} t`} sub={`${fmtCompact(annual.co2Kg * 2.20462)} lb · EPA eGRID factor`} />
            <Stat label="Bat-protected hours" value={fmtInt(annual.deepHours)} sub={`deep-dim hours per year · ${fmtInt(annual.dimHours)} total dimmed`} accent="#c084fc" />
          </div>
        )}
        <div className="flex gap-1">
          {(["night", "year", "assumptions"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className="rounded-lg border px-3 py-1 text-sm capitalize" style={{ borderColor: tab === t ? "rgba(245,179,66,0.6)" : "var(--line)", background: tab === t ? "rgba(245,179,66,0.12)" : "transparent" }}>{t === "night" ? "Tonight's schedule" : t === "year" ? "Through the year" : "Assumptions"}</button>)}
        </div>
        {tab === "night" && night && (
          <>
            <Section title={`Dimming schedule · ${MONTHS[month]}`}>
              <NightChart schedule={night.schedule} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><div className="label">Evening temp</div><div className="stat">{fmtTemp(night.conditions.tempC)}</div></div>
                <div><div className="label">Moon</div><div className="stat">{fmtPct(night.conditions.moon)}</div></div>
                <div><div className="label">Saved tonight</div><div className="stat">{fmtInt(night.energy.kWhSaved)} kWh · {fmtUSD(night.energy.dollars)}</div></div>
              </div>
              <Slider label="Override evening temperature" value={tempOverride ?? night.conditions.tempC} min={-10} max={38} onChange={setTempOverride} format={(v) => fmtTemp(v)} hint="Default is the ERA5 mean at one hour after sunset for this month (Open-Meteo)" />
            </Section>
            <Section title="Why these lights, why now">
              <ul className="space-y-1.5 text-sm text-muted">
                {corridor.roosts.map((r) => <li key={r.name}><b className="text-fg">{r.name}</b>: {r.note} <a className="text-accent-2" href={r.source} target="_blank" rel="noreferrer">source</a></li>)}
                <li>Dimming only happens when hourly traffic falls below {fmtPct(policy.trafficRatio)} of the peak hour, the FHWA adaptive-lighting criterion, and never below {fmtPct(policy.floor)} output.</li>
              </ul>
            </Section>
          </>
        )}
        {tab === "year" && annual && ph && (
          <>
            <Section title="Energy saved per night, by month"><MonthlyBars values={annual.months.map((n) => n.energy.kWhSaved)} label="kWh / night" /></Section>
            <Section title="Deep-dim hours per night (bats protected)"><MonthlyBars values={annual.months.map((n) => n.energy.deepHours)} label="hours" color="#c084fc" /></Section>
            <Section title={`Seasonal presence · ${STATE_NAME[corridor.state]} (Layer 1)`}><PhenologyLines series={phenSeries} /><p className="mt-1 text-[11px] text-muted">GBIF monthly records normalized to each species&apos; peak; hibernators masked Nov–Mar.</p></Section>
          </>
        )}
        {tab === "assumptions" && (
          <>
            <Section title="Dimming policy"><PolicyControls policy={policy} onChange={setPolicy} /></Section>
            <Section title="Energy and cost"><EnergyControls energy={energy} onChange={setEnergy} /></Section>
            <p className="text-xs text-muted">Changes apply instantly to the map, the schedule and the annual totals. See <Link className="text-accent-2" href="/methodology">Methodology</Link> for sources.</p>
          </>
        )}
      </aside>
    </div>
  );
}
