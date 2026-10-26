"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadGrid, type Grid, cellSpeciesValue } from "@/lib/grid";
import { loadPhenology, type PhenologyFile, MONTHS, seasonalCurve } from "@/lib/phenology";
import { computeNational, topCandidates, US_EVENING_TEMP_C } from "@/lib/national";
import { SPECIES, SPECIES_BY_CODE, FLAGSHIPS } from "@/lib/species";
import { fTemp, fMoon, fTime } from "@/lib/model";
import { ACTIVITY, LIGHT, PRIORITY, TRAFFIC, cssRamp } from "@/lib/colors";
import { Chip, Legend, Slider } from "@/components/ui";
import type { MapMode, Layers } from "@/components/NationalMap";
import { fmtInt, fmtPct } from "@/lib/format";

const NationalMap = dynamic(() => import("@/components/NationalMap"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-muted">Loading map…</div> });

const MODES: { id: MapMode; label: string; desc: string }[] = [
  { id: "activity", label: "Bat activity", desc: "Layer 1 baseline x nightly modifiers" },
  { id: "priority", label: "Black Corridor priority", desc: "activity x light pollution, interstate cells only" },
  { id: "light", label: "Light pollution", desc: "VIIRS night-light radiance" },
  { id: "traffic", label: "Traffic", desc: "FHWA 2024 interstate AADT" },
];

export default function Explorer() {
  const router = useRouter();
  const [grid, setGrid] = useState<Grid | null>(null);
  const [ph, setPh] = useState<PhenologyFile | null>(null);
  const [month, setMonth] = useState(new Date().getMonth());
  const [hour, setHour] = useState(1.5);
  const [temp, setTemp] = useState<number | null>(null);
  const [moon, setMoon] = useState(0.5);
  const [mode, setMode] = useState<MapMode>("activity");
  const [layers, setLayers] = useState<Layers>({ cells: true, roads: true, blackMarble: false, corridors: true });
  const [enabled, setEnabled] = useState<Set<string>>(new Set(SPECIES.map((s) => s.code)));
  const [useWeights, setUseWeights] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<{ lon: number; lat: number; zoom?: number } | null>(null);
  const [applyNight, setApplyNight] = useState(false);

  useEffect(() => { loadGrid().then(setGrid); loadPhenology().then(setPh); }, []);
  const tempC = temp ?? US_EVENING_TEMP_C[month];

  const field = useMemo(() => (grid && ph ? computeNational(grid, ph, month, enabled, useWeights) : null), [grid, ph, month, enabled, useWeights]);
  const nightFactor = applyNight ? fTime(hour, 10, undefined) * fTemp(tempC) * fMoon(moon) : 1;
  const candidates = useMemo(() => (grid && field ? topCandidates(grid, field, 10) : []), [grid, field]);

  const onHover = useCallback((i: number | null) => setHover(i), []);
  const onClickCorridor = useCallback((id: string) => router.push(`/corridors/${id}`), [router]);
  const toggleSpecies = (c: string) => setEnabled((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });

  const hovered = grid && field && ph && hover !== null ? describeCell(grid, field, ph, hover, month) : null;

  return (
    <div className="grid h-[calc(100vh-49px)] grid-cols-1 lg:grid-cols-[380px_1fr]">
      <aside className="order-2 overflow-y-auto border-r border-line p-4 lg:order-1">
        <h1 className="text-lg font-semibold">Where bats and highway lights collide</h1>
        <p className="mt-1 text-sm text-muted">Every 10 km cell in the lower 48 states, scored from USGS bat monitoring, GBIF sightings, NASA/NOAA night lights, and FHWA traffic counts. Pick a month, pick a lens, hover a cell.</p>

        <div className="mt-4 space-y-4">
          <div>
            <div className="label mb-1">Map lens</div>
            <div className="grid grid-cols-2 gap-1.5">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)} className="rounded-lg border px-2.5 py-1.5 text-left text-sm" style={{ borderColor: mode === m.id ? "rgba(245,179,66,0.6)" : "var(--line)", background: mode === m.id ? "rgba(245,179,66,0.12)" : "transparent" }}>
                  <div>{m.label}</div><div className="text-[11px] leading-tight text-muted">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Slider label="Month" value={month} min={0} max={11} onChange={setMonth} format={(v) => MONTHS[v]} hint="Layer 1: seasonal baseline from GBIF phenology x NABat occupancy" />

          <div className="panel p-3">
            <label className="flex items-center justify-between text-sm"><span>Apply tonight&apos;s modifiers (Layer 2)</span><input type="checkbox" checked={applyNight} onChange={(e) => setApplyNight(e.target.checked)} /></label>
            {applyNight && (
              <div className="mt-2 space-y-2">
                <Slider label="Hours after sunset" value={hour} min={0} max={10} step={0.5} onChange={setHour} format={(v) => `${v} h`} />
                <Slider label="Evening temperature" value={tempC} min={-10} max={35} onChange={setTemp} format={(v) => `${v} °C`} hint="Default is a typical US evening for the month; corridor pages use local climate" />
                <Slider label="Moon illumination" value={moon} min={0} max={1} step={0.05} onChange={setMoon} format={(v) => fmtPct(v)} />
                <div className="text-xs text-muted">Combined modifier: <b className="text-fg">{fmtPct(nightFactor)}</b> of baseline</div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between"><span className="label">Species</span>
              <span className="flex gap-2 text-[11px]"><button className="text-accent-2" onClick={() => setEnabled(new Set(SPECIES.map((s) => s.code)))}>all</button><button className="text-accent-2" onClick={() => setEnabled(new Set(FLAGSHIPS))}>flagships</button><button className="text-accent-2" onClick={() => setEnabled(new Set(SPECIES.filter((s) => s.status).map((s) => s.code)))}>listed</button></span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SPECIES.map((s) => <Chip key={s.code} on={enabled.has(s.code)} onClick={() => toggleSpecies(s.code)} color={`rgb(${s.color.join(",")})`}>{s.common}</Chip>)}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={useWeights} onChange={(e) => setUseWeights(e.target.checked)} />Weight listed species higher</label>
          </div>

          <div>
            <div className="label mb-1">Layers</div>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={layers.cells} onClick={() => setLayers({ ...layers, cells: !layers.cells })}>Grid cells</Chip>
              <Chip on={layers.roads} onClick={() => setLayers({ ...layers, roads: !layers.roads })}>Interstates</Chip>
              <Chip on={layers.blackMarble} onClick={() => setLayers({ ...layers, blackMarble: !layers.blackMarble })}>NASA Black Marble imagery</Chip>
              <Chip on={layers.corridors} onClick={() => setLayers({ ...layers, corridors: !layers.corridors })}>Deep-dive corridors</Chip>
            </div>
          </div>

          {mode === "activity" && <Legend title="Bat activity index" gradient={cssRamp(ACTIVITY)} left="none" right="peak" />}
          {mode === "priority" && <Legend title="Black Corridor priority" gradient={cssRamp(PRIORITY)} left="low" right="high" />}
          {mode === "light" && <Legend title={field?.calibrated ? "Radiance (nW/cm²/sr, log)" : "Night brightness (proxy, log)"} gradient={cssRamp(LIGHT)} left="dark" right="bright" />}
          {mode === "traffic" && <Legend title="Interstate AADT" gradient={cssRamp(TRAFFIC)} left="0" right="150k+" />}

          <div className="panel min-h-[150px] p-3">
            <div className="label mb-1">{hovered ? `Cell ${hovered.grts} · ${hovered.state}` : "Hover a cell"}</div>
            {hovered ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted">Baseline activity ({MONTHS[month]})</span><b className="stat">{fmtPct(hovered.baseline)}</b></div>
                <div className="flex justify-between"><span className="text-muted">Night light (2025)</span><b className="stat">{hovered.lightLabel}</b></div>
                {hovered.trend && <div className="flex justify-between"><span className="text-muted">Change since 2022</span><b className="stat" style={{ color: hovered.trend > 0.05 ? "#fb7185" : hovered.trend < -0.05 ? "#4ade80" : undefined }}>{hovered.trend > 0 ? "+" : ""}{Math.round(100 * hovered.trend)}%</b></div>}
                <div className="flex justify-between"><span className="text-muted">Interstate</span><b className="stat">{hovered.routes.length ? `I-${hovered.routes.join(", I-")} · ${fmtInt(hovered.aadt)} AADT` : "none"}</b></div>
                <div className="flex justify-between"><span className="text-muted">Priority</span><b className="stat">{hovered.priority > 0 ? fmtPct(hovered.priority) : "—"}</b></div>
                <div className="label mt-2">Top species this month</div>
                {hovered.species.slice(0, 5).map((s) => (
                  <div key={s.code} className="flex items-center gap-2 text-xs">
                    <span className="w-36 truncate">{SPECIES_BY_CODE[s.code].common}</span>
                    <div className="h-1.5 flex-1 rounded bg-white/10"><div className="h-full rounded" style={{ width: `${100 * s.value}%`, background: `rgb(${SPECIES_BY_CODE[s.code].color.join(",")})` }} /></div>
                    <span className="stat w-10 text-right text-muted">{fmtPct(s.value)}</span>
                  </div>
                ))}
                {hovered.species.length === 0 && <div className="text-xs text-muted">No modeled species in this cell for the selected set.</div>}
              </div>
            ) : <div className="text-xs text-muted">Cell values combine NABat occupancy (USGS, 2017-2019), GBIF monthly phenology, VIIRS night lights and FHWA traffic. See Methodology.</div>}
          </div>

          <div>
            <div className="label mb-1">Top candidate Black Corridors · {MONTHS[month]}</div>
            <ol className="space-y-1 text-sm">
              {candidates.map((c, k) => (
                <li key={c.grts}><button className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-white/5" onClick={() => setFlyTo({ lon: c.lon, lat: c.lat, zoom: 7.5 })}>
                  <span><span className="text-muted">{k + 1}.</span> I-{c.routes[0] ?? "?"} · {c.state}</span><span className="stat text-xs text-muted">act {fmtPct(c.baseline)} · light {fmtPct(c.light)}</span></button></li>
              ))}
              {!candidates.length && <li className="text-xs text-muted">Loading…</li>}
            </ol>
          </div>
        </div>
      </aside>
      <div className="order-1 relative min-h-[420px] lg:order-2">
        <NationalMap grid={grid} field={field} mode={mode} layers={layers} nightFactor={nightFactor} onHover={onHover} onClickCorridor={onClickCorridor} flyTo={flyTo} />
        {!grid && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">Loading 74,000 grid cells…</div>}
      </div>
    </div>
  );
}

function describeCell(g: Grid, f: ReturnType<typeof computeNational>, ph: PhenologyFile, i: number, month: number) {
  const state = g.states[g.state[i]];
  const species = SPECIES.map((s) => { const v = cellSpeciesValue(g, i, s.code); return v === null ? null : { code: s.code, value: v * seasonalCurve(ph, s.code, state)[month] }; }).filter((x): x is { code: string; value: number } => !!x).sort((a, b) => b.value - a.value);
  const lightLabel = f.calibrated ? `${g.light[i].toFixed(1)} nW/cm²/sr` : `${Math.round(g.light[i])} / 255 (proxy)`;
  const y0 = g.lightYears["2022"], y1 = g.lightYears["2025"];
  const trend = y0 && y1 && y0[i] > 0.5 ? (y1[i] - y0[i]) / y0[i] : null;
  return { grts: g.grts[i], state, baseline: f.baseline[i], priority: f.priority[i], lightLabel, trend, routes: g.routes[i], aadt: g.aadt[i], species };
}
