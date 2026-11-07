import type { DKEntry, Fighter, OwnRow, PoolPlayer, PrizeBand, StandingRow } from "./types";

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') { f += '"'; i++; } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export const norm = (x: string) =>
  String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const num = (x: unknown) => {
  const v = Number(String(x ?? "").replace(/[%,$\s]/g, ""));
  return Number.isFinite(v) ? v : 0;
};

export type FileKind = "standings" | "entries" | "payouts" | "card" | "unknown";

export function detectKind(text: string): FileKind {
  const head = parseCSV(text.split(/\r?\n/).slice(0, 1).join("\n"))[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  if (head.includes("entryid") && head.includes("lineup")) return "standings";
  if (head.includes("entry id") && head.includes("contest id")) return "entries";
  if (head.includes("fighter") && head.includes("win_prob")) return "card";
  if (head.some((h) => h.includes("prize"))) return "payouts";
  return "unknown";
}

/** DraftKings contest standings export: entries on the left, fighter ownership on the right. */
export function parseStandings(text: string): { rows: StandingRow[]; own: OwnRow[] } {
  const all = parseCSV(text);
  const head = (all.shift() ?? []).map((h) => h.trim());
  const ix = (n: string) => head.indexOf(n);
  const rows: StandingRow[] = all
    .filter((r) => r[ix("EntryId")])
    .map((r) => ({
      rank: num(r[ix("Rank")]),
      entryId: String(r[ix("EntryId")]).trim(),
      entryName: String(r[ix("EntryName")]).trim(),
      pmr: num(r[ix("TimeRemaining")]),
      points: num(r[ix("Points")]),
      lineup: String(r[ix("Lineup")] || "").replace(/^\s*[A-Z]+\s+/, "").split(/\s+(?:F|FLEX|CPT)\s+/).map((s) => s.trim()).filter(Boolean),
    }));
  const p = ix("Player");
  const own: OwnRow[] = p < 0 ? [] : all
    .filter((r) => r[p])
    .map((r) => ({ player: r[p].trim(), drafted: num(r[ix("%Drafted")]) / 100, fpts: num(r[ix("FPTS")]) }));
  return { rows, own };
}

/** DraftKings lineup export (DKEntries.csv): your entries and the player pool. */
export function parseEntries(text: string): { entries: DKEntry[]; pool: PoolPlayer[] } {
  const all = parseCSV(text);
  const head = (all[0] ?? []).map((h) => h.trim());
  const ix = (n: string) => head.indexOf(n);
  const slots: number[] = [];
  for (let i = ix("Entry Fee") + 1; i < head.length && head[i]; i++) slots.push(i);
  const strip = (x: string) => String(x || "").replace(/\s*\(\d+\)\s*$/, "").trim();
  const entries = all.slice(1)
    .filter((r) => /^\d+$/.test(String(r[ix("Entry ID")] || "").trim()))
    .map((r) => ({
      entryId: r[ix("Entry ID")].trim(),
      contest: r[ix("Contest Name")],
      contestId: r[ix("Contest ID")],
      fee: num(r[ix("Entry Fee")]),
      lineup: slots.map((i) => strip(r[i])).filter(Boolean),
    }));
  let at: [number, number] | null = null;
  all.forEach((r, ri) => { if (at) return; const ci = r.findIndex((x) => x.trim() === "Name + ID"); if (ci >= 0) at = [ri, ci]; });
  const pool: PoolPlayer[] = [];
  if (at) {
    const [ri] = at as [number, number];
    const hd = all[ri].map((x) => x.trim());
    const j = (n: string) => hd.indexOf(n);
    all.slice(ri + 1).forEach((r) => {
      if (!r[j("Name")]) return;
      pool.push({ name: r[j("Name")].trim(), id: r[j("ID")], salary: num(r[j("Salary")]), gameInfo: r[j("Game Info")] || "", avg: num(r[j("AvgPointsPerGame")]) });
    });
  }
  return { entries, pool };
}

/**
 * Prize table from pasted text or CSV. Accepts lines like
 * "1st $1,000", "2 400", "6-10 50", "11 - 15: $35" or a CSV with rank_from,rank_to,prize.
 */
export function parsePayouts(text: string): PrizeBand[] {
  const bands: PrizeBand[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const l of lines) {
    const m = /^(\d[\d,]*)(?:st|nd|rd|th)?\s*(?:[-–—to]+\s*(\d[\d,]*)(?:st|nd|rd|th)?)?\s*[,:\t ]+\s*\$?\s*([\d,]+(?:\.\d+)?)/i.exec(l);
    if (!m) continue;
    const from = num(m[1]);
    const to = m[2] ? num(m[2]) : from;
    const prize = num(m[3]);
    if (from > 0 && to >= from && prize > 0) bands.push({ from, to, prize });
  }
  return bands.sort((a, b) => a.from - b.from);
}

export function parseCard(text: string): { card: Fighter[]; state: Record<number, { status: string; fpts: Record<string, number>; winner?: string; method?: string; round?: number; elapsed?: number }> } {
  const all = parseCSV(text);
  const head = (all.shift() ?? []).map((h) => h.trim());
  const ix = (n: string) => head.indexOf(n);
  const card: Fighter[] = [];
  const state: Record<number, { status: string; fpts: Record<string, number>; winner?: string; method?: string; round?: number; elapsed?: number }> = {};
  all.filter((r) => r[ix("fighter")]).forEach((r) => {
    const f: Fighter = {
      name: r[ix("fighter")], opponent: r[ix("opponent")], bout: num(r[ix("bout")]), rounds: num(r[ix("rounds")]) || 3,
      winProb: num(r[ix("win_prob")]), finishProb: num(r[ix("finish_prob")]), ppmWin: num(r[ix("ppm_win")]), ppmLoss: num(r[ix("ppm_loss")]),
      salary: num(r[ix("salary")]), proj: num(r[ix("proj")]), oddsSource: r[ix("odds_source")] || "",
    };
    card.push(f);
    const st = state[f.bout] ?? (state[f.bout] = { status: r[ix("status")] || "upcoming", fpts: {} });
    st.fpts[norm(f.name)] = num(r[ix("fpts")]);
    if (r[ix("result")] === "W") { st.winner = f.name; st.method = r[ix("method")]; st.round = num(r[ix("end_round")]); }
    if (st.status === "live") st.elapsed = num(r[ix("elapsed_min")]);
  });
  return { card, state };
}
