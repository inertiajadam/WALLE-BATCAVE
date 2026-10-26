export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtUSD = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const fmtPct = (n: number, d = 0) => `${(100 * n).toFixed(d)}%`;
export const fmtNum = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d });
export const fmtCompact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Dual-unit formatters: every measurement is shown in metric and imperial.
export const fmtTemp = (c: number, d = 0) => `${c.toFixed(d)} °C / ${(c * 9 / 5 + 32).toFixed(d)} °F`;
export const fmtMiles = (mi: number, d = 0) => `${fmtNum(mi, d)} mi / ${fmtNum(mi * 1.609344, d)} km`;
export const fmtKm = (km: number, d = 1) => `${fmtNum(km, d)} km / ${fmtNum(km / 1.609344, d)} mi`;
export const fmtTonnes = (kg: number) => `${fmtCompact(kg / 1000)} t / ${fmtCompact(kg * 0.00110231)} short tons`;
export const fmtMeters = (m: number) => `${fmtNum(m, 0)} m / ${fmtNum(m * 3.28084, 0)} ft`;
