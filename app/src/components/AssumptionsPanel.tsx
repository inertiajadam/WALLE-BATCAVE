"use client";
import { Slider } from "./ui";
import type { DimmingPolicy, EnergyAssumptions } from "@/lib/model";
import { fmtPct } from "@/lib/format";

export function PolicyControls({ policy, onChange }: { policy: DimmingPolicy; onChange: (p: DimmingPolicy) => void }) {
  const set = (k: keyof DimmingPolicy) => (v: number) => onChange({ ...policy, [k]: v });
  return (
    <div className="space-y-3">
      <Slider label="Deep-dim trigger (bat activity index)" value={policy.baiHigh} min={5} max={80} onChange={set("baiHigh")} />
      <Slider label="Moderate-dim trigger" value={policy.baiLow} min={0} max={60} onChange={set("baiLow")} />
      <Slider label="Deep dim (output removed)" value={policy.deepDim} min={0.1} max={0.7} step={0.05} onChange={set("deepDim")} format={fmtPct} />
      <Slider label="Moderate dim" value={policy.moderateDim} min={0.05} max={0.5} step={0.05} onChange={set("moderateDim")} format={fmtPct} />
      <Slider label="Base adaptive dim (no bats)" value={policy.baseDim} min={0} max={0.4} step={0.05} onChange={set("baseDim")} format={fmtPct} hint="What a conventional adaptive-lighting system does on any low-traffic night" />
      <Slider label="Safety floor (minimum output)" value={policy.floor} min={0.2} max={0.8} step={0.05} onChange={set("floor")} format={fmtPct} hint="Lights never go below this fraction of full output" />
      <Slider label="Low-traffic threshold (share of peak hour)" value={policy.trafficRatio} min={0.2} max={0.8} step={0.05} onChange={set("trafficRatio")} format={fmtPct} hint="FHWA adaptive criteria use a 50% reduction from peak hourly volume" />
    </div>
  );
}

export function EnergyControls({ energy, onChange }: { energy: EnergyAssumptions; onChange: (e: EnergyAssumptions) => void }) {
  const set = (k: keyof EnergyAssumptions) => (v: number) => onChange({ ...energy, [k]: v });
  return (
    <div className="space-y-3">
      <Slider label="Fixtures per mile" value={energy.fixturesPerMile} min={10} max={100} onChange={set("fixturesPerMile")} hint="Continuous freeway lighting, both sides, ~50 m spacing ≈ 42 per mile" />
      <Slider label="Watts per fixture" value={energy.wattsPerFixture} min={60} max={400} step={10} onChange={set("wattsPerFixture")} hint="150 W LED cobra head; legacy 250 W HPS draws ~300 W with ballast" />
      <Slider label="Electricity price" value={energy.pricePerKWh} min={0.05} max={0.35} step={0.005} onChange={set("pricePerKWh")} format={(v) => `$${v.toFixed(3)}/kWh`} hint="EIA 2024 US commercial average: $0.1275/kWh" />
      <Slider label="Grid emission factor" value={energy.co2KgPerKWh} min={0.1} max={0.8} step={0.01} onChange={set("co2KgPerKWh")} format={(v) => `${v.toFixed(2)} kg CO₂/kWh`} hint="EPA eGRID US average ≈ 0.39" />
    </div>
  );
}
