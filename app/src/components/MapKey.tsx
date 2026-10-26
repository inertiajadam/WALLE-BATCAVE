"use client";
import { ACTIVITY, LIGHT, PRIORITY, TRAFFIC, cssRamp } from "@/lib/colors";
import type { MapMode, Layers } from "./NationalMap";

const LENS: Record<MapMode, { title: string; ramp: number[][]; stops: string[]; meaning: string }> = {
  activity: { title: "Bat activity index", ramp: ACTIVITY, stops: ["none", "low", "medium", "high", "peak"], meaning: "How many bats are likely flying in this 10 km (6 mi) square in the chosen month. Dark purple = few, bright amber = many." },
  priority: { title: "Black Corridor priority", ramp: PRIORITY, stops: ["none", "low", "medium", "high", "top"], meaning: "Squares with an interstate where bats are active AND the night sky is bright. The brighter the color, the better the case for dimming." },
  light: { title: "Light pollution", ramp: LIGHT, stops: ["dark", "faint", "lit", "bright", "city"], meaning: "Satellite-measured night-light radiance (nW/cm²/sr, log scale). Transparent = natural darkness, white = city core." },
  traffic: { title: "Interstate traffic", ramp: TRAFFIC, stops: ["0", "40k", "75k", "110k", "150k+"], meaning: "Average vehicles per day (AADT) on the interstate crossing this square, from FHWA 2024 counts." },
};

export default function MapKey({ mode, layers, calibrated }: { mode: MapMode; layers: Layers; calibrated: boolean }) {
  const l = LENS[mode];
  return (
    <div className="panel pointer-events-auto w-[260px] p-3 text-xs">
      <div className="mb-1 flex items-center justify-between"><span className="text-sm font-semibold">Map key</span><span className="label">{l.title}</span></div>
      {layers.cells && (
        <div className="mb-2">
          <div className="h-3 w-full rounded" style={{ background: cssRamp(l.ramp) }} />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted">{l.stops.map((s) => <span key={s}>{s}</span>)}</div>
          <p className="mt-1 leading-snug text-muted">{l.meaning}{mode === "light" && !calibrated ? " (provisional brightness proxy)" : ""}</p>
        </div>
      )}
      <ul className="space-y-1">
        {layers.roads && (
          <>
            <li className="flex items-center gap-2"><span className="inline-block h-[3px] w-6 rounded bg-[#78e6ff]" /><span>Interstate with traffic count; thicker = more traffic</span></li>
            <li className="flex items-center gap-2"><span className="inline-block h-[2px] w-6 rounded bg-[#7896be]" /><span>Interstate without a count in this cell</span></li>
          </>
        )}
        {layers.corridors && <li className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-[#f5b342]" /><span>Deep-dive corridor (click to open)</span></li>}
        {layers.blackMarble && <li className="flex items-center gap-2"><span className="inline-block h-3 w-6 rounded bg-[radial-gradient(circle,#fff3c4,#2a2400)]" /><span>NASA night-lights photo (2016)</span></li>}
        {!layers.cells && <li className="text-muted">Grid cells are hidden; turn on “Grid cells” under Layers.</li>}
      </ul>
      <p className="mt-2 text-[10px] text-muted">Hover any square for its numbers. Squares with no modeled bats and no interstate are left blank.</p>
    </div>
  );
}
