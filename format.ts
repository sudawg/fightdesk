export const pct = (x: number | null | undefined, digits = 1) =>
  x == null || Number.isNaN(x) ? "—" : x > 0 && x < 0.001 ? "<0.1%" : x > 0.999 && x < 1 ? ">99.9%" : `${(x * 100).toFixed(digits)}%`;
export const money = (x: number | null | undefined) =>
  x == null ? "—" : x.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money0 = (x: number | null | undefined) =>
  x == null ? "—" : x.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const signedMoney = (x: number) => `${x >= 0 ? "+" : "−"}${money(Math.abs(x))}`;
export const ord = (n: number | null | undefined) => (n == null ? "—" : `#${n.toLocaleString("en-US")}`);
export const pts = (x: number | null | undefined, d = 1) => (x == null ? "—" : x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
export const int = (x: number | null | undefined) => (x == null ? "—" : x.toLocaleString("en-US"));
export const last = (n: string) => String(n).split(" ").slice(-1)[0];
export const clock = (elapsed: number) => `R${Math.floor(elapsed / 5) + 1} ${Math.floor(elapsed % 5)}:${String(Math.round((elapsed % 1) * 60)).padStart(2, "0")}`;
