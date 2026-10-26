export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtUSD = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const fmtPct = (n: number, d = 0) => `${(100 * n).toFixed(d)}%`;
export const fmtNum = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d });
export const fmtCompact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
