"use client";
import type { ReactNode } from "react";

export function Slider({ label, value, min, max, step = 1, onChange, format, hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="stat text-sm text-fg">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </label>
  );
}

export function Chip({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <button type="button" className="chip" data-on={on} onClick={onClick}>
      {color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color, opacity: on ? 1 : 0.35 }} />}
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="label">{label}</div>
      <div className="stat mt-1 text-2xl font-semibold" style={{ color: accent }}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Legend({ gradient, left, right, title }: { gradient: string; left: string; right: string; title: string }) {
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <div className="h-2 w-full rounded" style={{ background: gradient }} />
      <div className="mt-0.5 flex justify-between text-[11px] text-muted"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{title}</h2>{right}</div>
      {children}
    </section>
  );
}
