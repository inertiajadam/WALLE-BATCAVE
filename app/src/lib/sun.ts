import * as SunCalc from "suncalc";

export interface NightWindow { sunset: Date; sunrise: Date; moonIllumination: number; moonPhase: number; }

/** Sunset of `date` and sunrise of the following morning, plus moon illumination at midnight. */
export function nightWindow(date: Date, lat: number, lon: number): NightWindow {
  const d = new Date(date); d.setHours(12, 0, 0, 0);
  const t = SunCalc.getTimes(d, lat, lon);
  const next = new Date(d); next.setDate(next.getDate() + 1);
  const t2 = SunCalc.getTimes(next, lat, lon);
  const mid = new Date(d); mid.setHours(24, 0, 0, 0);
  const m = SunCalc.getMoonIllumination(mid);
  const fallbackSunset = new Date(d); fallbackSunset.setHours(19, 30, 0, 0);
  const fallbackSunrise = new Date(next); fallbackSunrise.setHours(6, 30, 0, 0);
  return { sunset: t.sunset ?? fallbackSunset, sunrise: t2.sunrise ?? fallbackSunrise, moonIllumination: m.fraction, moonPhase: m.phase };
}

/** Representative date for a month index (15th), in the current year. */
export function midMonthDate(month: number, year = new Date().getFullYear()): Date {
  return new Date(year, month, 15, 12, 0, 0);
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
