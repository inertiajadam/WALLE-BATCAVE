/**
 * Hour-of-day traffic distribution. FHWA's Traffic Monitoring Guide (Appendix J) publishes
 * example hourly patterns rather than a national table; this is a typical rural/suburban freeway
 * weekday shape (fraction of daily traffic per hour, sums to 1). When a segment reports a
 * K-factor (design-hour share of AADT) in HPMS, the profile is rescaled so its peak equals it.
 */
export const HOURLY_PROFILE_RAW = [1.0, 0.7, 0.6, 0.6, 0.9, 1.8, 3.6, 5.5, 5.6, 5.2, 5.4, 5.8, 6.0, 6.1, 6.5, 7.2, 7.8, 7.6, 5.8, 4.3, 3.4, 2.8, 2.1, 1.5];
const SUM = HOURLY_PROFILE_RAW.reduce((a, b) => a + b, 0);
export const HOURLY_PROFILE = HOURLY_PROFILE_RAW.map((x) => x / SUM);

export function hourlyVolume(aadt: number, hour: number, kFactor?: number): number {
  const peak = Math.max(...HOURLY_PROFILE);
  const k = kFactor && kFactor > 3 && kFactor < 25 ? kFactor / 100 : peak;
  return aadt * HOURLY_PROFILE[((hour % 24) + 24) % 24] * (k / peak);
}

export function peakHourlyVolume(aadt: number, kFactor?: number): number {
  return Math.max(...HOURLY_PROFILE.map((_, h) => hourlyVolume(aadt, h, kFactor)));
}
