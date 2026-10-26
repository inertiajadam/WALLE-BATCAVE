"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadGrid, type Grid } from "@/lib/grid";
import { loadPhenology, type PhenologyFile, MONTHS } from "@/lib/phenology";
import { loadRoads, loadClimate, CORRIDORS, type RoadsFile, type ClimateFile } from "@/lib/corridors";
import { buildSegments, annualSummary, corridorNight } from "@/lib/corridorModel";
import { DEFAULT_POLICY, DEFAULT_ENERGY, type DimmingPolicy, type EnergyAssumptions } from "@/lib/model";
import { Section, Stat } from "@/components/ui";
import { PolicyControls, EnergyControls } from "@/components/AssumptionsPanel";
import { MonthlyBars } from "@/components/charts";
import { fmtInt, fmtUSD, fmtPct, fmtNum, fmtCompact, fmtTemp, fmtMiles } from "@/lib/format";
import { fmtTimeTz } from "@/lib/sun";

export default function UtilityDashboard() {
  const [grid, setGrid] = useState<Grid | null>(null); const [ph, setPh] = useState<PhenologyFile | null>(null); const [climate, setClimate] = useState<ClimateFile | null>(null);
  const [roads, setRoads] = useState<Record<string, RoadsFile>>({});
  const [policy, setPolicy] = useState<DimmingPolicy>(DEFAULT_POLICY); const [energy, setEnergy] = useState<EnergyAssumptions>(DEFAULT_ENERGY);
  const [showAssumptions, setShowAssumptions] = useState(false);

  useEffect(() => {
    loadGrid().then(setGrid); loadPhenology().then(setPh); loadClimate().then(setClimate);
    Promise.all(CORRIDORS.map((c) => loadRoads(c.id).then((r) => [c.id, r] as const))).then((rs) => setRoads(Object.fromEntries(rs)));
  }, []);

  const rows = useMemo(() => {
    if (!grid || !ph || !climate) return [];
    return CORRIDORS.filter((c) => roads[c.id]).map((c) => {
      const segs = buildSegments(c, roads[c.id], grid, ph);
      const annual = annualSummary(c, segs, climate, policy, energy);
      const tonight = corridorNight(c, segs, new Date().getMonth(), climate, policy, energy, { date: new Date() });
      const aadt = segs.reduce((a, s) => a + s.aadt * s.miles, 0) / Math.max(annual.miles, 1e-6);
      return { c, annual, tonight, aadt, segments: segs.length };
    });
  }, [grid, ph, climate, roads, policy, energy]);

  const total = rows.reduce((a, r) => ({ kWh: a.kWh + r.annual.kWh, dollars: a.dollars + r.annual.dollars, co2: a.co2 + r.annual.co2Kg, miles: a.miles + r.annual.miles, deep: a.deep + r.annual.deepHours, base: a.base + r.annual.baselineKWh }), { kWh: 0, dollars: 0, co2: 0, miles: 0, deep: 0, base: 0 });
  const monthly = Array.from({ length: 12 }, (_, m) => rows.reduce((a, r) => a + r.annual.months[m].energy.kWhSaved, 0));

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Utility dashboard</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">What a power company or roadway-lighting operator would see: projected savings from running a Black Corridor schedule on the four pilot corridors, tonight&apos;s setpoints, and the public notice that goes with them. The schedule endpoint at <code className="rounded bg-white/10 px-1">/api/schedule</code> simulates the feed a lighting controller would poll.</p>
        </div>
        <button onClick={() => setShowAssumptions(!showAssumptions)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white/5">{showAssumptions ? "Hide" : "Edit"} assumptions</button>
      </div>
      {showAssumptions && (
        <div className="grid gap-3 md:grid-cols-2">
          <Section title="Dimming policy"><PolicyControls policy={policy} onChange={setPolicy} /></Section>
          <Section title="Energy and cost"><EnergyControls energy={energy} onChange={setEnergy} /></Section>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Lit road under schedule" value={fmtMiles(total.miles)} sub={`${rows.reduce((a, r) => a + r.segments, 0)} HPMS segments`} />
        <Stat label="Annual energy saved" value={`${fmtCompact(total.kWh)} kWh`} sub={total.base ? `${fmtPct(total.kWh / total.base)} of lighting load` : ""} accent="#4ade80" />
        <Stat label="Annual savings" value={fmtUSD(total.dollars)} sub={`$${energy.pricePerKWh.toFixed(3)}/kWh`} accent="#f5b342" />
        <Stat label="CO₂ avoided per year" value={`${fmtCompact(total.co2 / 1000)} t`} sub={`${fmtCompact(total.co2 * 2.20462)} lb`} />
        <Stat label="Bat-protected hours" value={fmtInt(total.deep)} sub="deep-dim hours per year" accent="#c084fc" />
      </div>

      <Section title="Pilot corridors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-3">Corridor</th><th className="pr-3">Lit mi / km</th><th className="pr-3">Mean AADT</th><th className="pr-3">kWh / yr</th><th className="pr-3">$ / yr</th><th className="pr-3">Deep-dim h / yr</th><th className="pr-3">Tonight</th><th></th></tr></thead>
            <tbody>
              {rows.map(({ c, annual, tonight, aadt }) => {
                const dark = tonight.schedule.filter((h) => h.dark); const deep = dark.filter((h) => h.tier === "deep"); const anyDim = dark.filter((h) => h.dim > 0);
                const span = (hs: typeof dark) => (hs.length ? `${((hs[0].hour + 11) % 12) + 1}${hs[0].hour < 12 ? "am" : "pm"}–${((hs[hs.length - 1].hour + 12) % 12) + 1}${hs[hs.length - 1].hour + 1 < 12 || hs[hs.length - 1].hour + 1 === 24 ? "am" : "pm"}` : "none");
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2 pr-3 font-medium">{c.name}</td><td className="stat pr-3">{fmtNum(annual.miles, 0)} / {fmtNum(annual.miles * 1.609344, 0)}</td><td className="stat pr-3">{fmtInt(aadt)}</td>
                    <td className="stat pr-3 text-ok">{fmtCompact(annual.kWh)}</td><td className="stat pr-3 text-accent">{fmtUSD(annual.dollars)}</td><td className="stat pr-3 text-bat">{fmtInt(annual.deepHours)}</td>
                    <td className="pr-3 text-xs text-muted">sunset {fmtTimeTz(tonight.sunset, c.tz)} · dim {span(anyDim)}{deep.length ? ` · deep ${span(deep)}` : ""} · {fmtTemp(tonight.conditions.tempC)} · moon {fmtPct(tonight.conditions.moon)}</td>
                    <td><Link className="text-accent-2" href={`/corridors/${c.id}`}>open</Link></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="py-4 text-center text-muted">Loading corridor data…</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Energy saved per night across pilots, by month"><MonthlyBars values={monthly} label="kWh / night" /></Section>
        <Section title="Deep-dim hours per night (bats protected), by corridor">
          <div className="space-y-2">
            {rows.map(({ c, annual }) => (
              <div key={c.id}>
                <div className="mb-1 flex justify-between text-xs"><span>{c.name}</span><span className="text-muted">{fmtInt(annual.deepHours)} h / yr</span></div>
                <div className="grid grid-cols-12 gap-0.5">
                  {annual.months.map((n, m) => <div key={m} title={`${MONTHS[m]}: ${n.energy.deepHours} deep-dim h/night`} className="h-5 rounded-sm" style={{ background: `rgba(192,132,252,${0.12 + 0.88 * Math.min(1, n.energy.deepHours / 9)})` }} />)}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-12 gap-0.5 text-center text-[10px] text-muted">{MONTHS.map((m) => <span key={m}>{m[0]}</span>)}</div>
          </div>
        </Section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="Public notice (auto-generated for tonight)">
          {rows[0] ? (() => { const r = rows.find((x) => x.tonight.schedule.some((h) => h.tier === "deep")) ?? rows[0]; const dark = r.tonight.schedule.filter((h) => h.dim > 0); const first = dark[0], last = dark[dark.length - 1]; return (
            <blockquote className="rounded-lg border border-line bg-white/[0.03] p-3 text-sm leading-relaxed text-fg">
              Tonight, {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, highway lighting on <b>{r.c.name}</b> will run at reduced output {first ? <>from <b>{((first.hour + 11) % 12) + 1}:00 {first.hour < 12 ? "am" : "pm"}</b> to <b>{((last.hour + 12) % 12) + 1}:00 {last.hour + 1 < 12 || last.hour === 23 ? "am" : "pm"}</b></> : "for part of the night"}, never below {fmtPct(policy.floor)} of normal. This is the bat season for {r.c.roosts[0].name}; dimming when traffic is light reduces disturbance to {Intl.NumberFormat("en-US", { notation: "compact" }).format(r.c.roosts.reduce((a, x) => a + x.est, 0))} bats and saves about {fmtInt(r.tonight.energy.kWhSaved)} kWh. Lights return to full output automatically if traffic rises.
            </blockquote>
          ); })() : <div className="text-sm text-muted">Loading…</div>}
          <p className="mt-2 text-xs text-muted">Residents and local governments see the same schedule on the <Link className="text-accent-2" href="/tonight">Tonight</Link> page.</p>
        </Section>
        <Section title="Grid integration (simulated)">
          <p className="text-sm text-muted">A lighting control system would poll a nightly feed of per-segment setpoints. The prototype exposes exactly that:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-accent-2">GET /api/schedule?corridor=tx-i35&amp;date={new Date().toISOString().slice(0, 10)}</pre>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Returns sunset, sunrise, evening conditions, the policy in force, and an hourly output % per HPMS road segment.</li>
            <li>Inputs a real deployment would add: live traffic from count stations, a weather feed, and a roost-emergence sensor or acoustic detector to confirm activity.</li>
            <li>Nothing here is connected to a grid. It is a demonstration of the interface.</li>
          </ul>
          <a className="mt-2 inline-block text-sm text-accent-2" href={`/api/schedule?corridor=tx-i35`} target="_blank" rel="noreferrer">Open the live JSON →</a>
        </Section>
      </div>
    </div>
  );
}
