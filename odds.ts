import { norm } from "./parse";
import type { AppData } from "./types";

export interface OddsFight { a: string; b: string; pa: number; pb: number; books: number; start: string }
export interface OddsFeed { fetchedAt: number; remaining: string | null; fights: OddsFight[] }

export async function fetchOdds(): Promise<OddsFeed | "unavailable"> {
  let res: Response;
  try { res = await fetch("/api/odds", { cache: "no-store" }); } catch { throw new Error("No connection."); }
  const type = res.headers.get("content-type") ?? "";
  if (res.status === 503 || res.status === 404 || !type.includes("json")) return "unavailable";
  if (!res.ok) throw new Error("The odds feed is having trouble — try again in a few minutes.");
  return (await res.json()) as OddsFeed;
}

/** Writes live odds into fights that haven't started; returns what changed. */
export function applyOdds(d: AppData, feed: OddsFeed): { data: AppData; changed: string[] } {
  const changed: string[] = [];
  const byPair = new Map<string, OddsFight>();
  feed.fights.forEach((f) => byPair.set([norm(f.a), norm(f.b)].sort().join("|"), f));
  const card = d.card.map((c) => {
    if ((d.bouts[c.bout]?.status ?? "upcoming") !== "upcoming") return c;
    const f = byPair.get([norm(c.name), norm(c.opponent)].sort().join("|"));
    if (!f) return c;
    const p = norm(f.a) === norm(c.name) ? f.pa : f.pb;
    if (!Number.isFinite(p) || p <= 0.01 || p >= 0.99) return c;
    if (Math.abs(p - c.winProb) >= 0.005) changed.push(`${c.name} ${Math.round(c.winProb * 100)}→${Math.round(p * 100)}%`);
    return { ...c, winProb: Math.round(p * 1000) / 1000, oddsSource: `Live (${f.books} books)` };
  });
  return { data: { ...d, card }, changed };
}
