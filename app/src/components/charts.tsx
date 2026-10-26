"use client";
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, LineChart } from "recharts";
import type { HourResult } from "@/lib/model";
import { MONTHS } from "@/lib/phenology";
import { fmtInt } from "@/lib/format";

const tooltipStyle = { background: "rgba(12,17,32,0.96)", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 8, fontSize: 12, color: "#e6e9f2" };
const hLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;

/** One night: light output (bars), bat activity index (line) and traffic as share of peak hour (line). */
export function NightChart({ schedule, height = 240 }: { schedule: HourResult[]; height?: number }) {
  const data = schedule.map((h) => ({ hour: hLabel(h.hour), output: Math.round(100 * (1 - h.dim)), bai: Math.round(h.bai), traffic: Math.round(100 * h.trafficRatio), dark: h.dark ? 100 : 0, tier: h.tier }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
        <XAxis dataKey="hour" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={1} />
        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`${v}%`, name === "output" ? "Light output" : name === "bai" ? "Bat activity index" : name === "traffic" ? "Traffic (share of peak hour)" : "Night"]} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "output" ? "Light output %" : v === "bai" ? "Bat activity index" : v === "traffic" ? "Traffic % of peak hour" : "Night")} />
        <Area dataKey="dark" fill="rgba(30,20,60,0.45)" stroke="none" type="step" />
        <Bar dataKey="output" fill="#f5b342" radius={[3, 3, 0, 0]} />
        <Line dataKey="bai" stroke="#c084fc" strokeWidth={2} dot={false} type="monotone" />
        <Line dataKey="traffic" stroke="#7dd3fc" strokeWidth={2} dot={false} type="monotone" strokeDasharray="4 3" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ values, label, color = "#4ade80", format = fmtInt, height = 180 }: { values: number[]; label: string; color?: string; format?: (n: number) => string; height?: number }) {
  const data = values.map((v, i) => ({ m: MONTHS[i], v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
        <XAxis dataKey="m" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => format(v)} width={56} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [format(Number(v)), label]} />
        <Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PhenologyLines({ series, height = 200 }: { series: { name: string; color: string; values: number[] }[]; height?: number }) {
  const data = MONTHS.map((m, i) => Object.fromEntries([["m", m], ...series.map((s) => [s.name, Math.round(100 * s.values[i])])]));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
        <XAxis dataKey="m" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => <Line key={s.name} dataKey={s.name} stroke={s.color} strokeWidth={2} dot={false} type="monotone" />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
