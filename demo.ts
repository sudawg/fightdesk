import { parseCard, parseCSV, parseEntries, parseStandings } from "./parse";
import type { AppData, BoutState, Contest } from "./types";
import demoCard from "@/data/ufc-card-odds-sample.csv?raw";
import demoMain from "@/data/contest-standings-sample.csv?raw";
import demoSE from "@/data/contest-standings-se-sample.csv?raw";
import demo3 from "@/data/contest-standings-3max-sample.csv?raw";
import demoPay from "@/data/contest-payouts-sample.csv?raw";
import demoEntries from "@/data/DKEntries-sample.csv?raw";


export function demoData(username = "mattpecce"): AppData {
  const { card, state } = parseCard(demoCard);
  const bouts: Record<number, BoutState> = {};
  const fpts: Record<string, number> = {};
  Object.entries(state).forEach(([b, s]) => {
    const bout = Number(b);
    bouts[bout] = { status: s.status as BoutState["status"], winner: s.winner, method: s.method as BoutState["method"], round: s.round, elapsed: s.elapsed, finishedAt: s.status === "final" ? 1000 - bout : undefined };
    Object.assign(fpts, s.fpts);
  });
  const pay = parseCSV(demoPay); const ph = pay.shift() ?? [];
  const pcol = (n: string) => ph.indexOf(n);
  const bands = (id: string) => pay.filter((r) => r[pcol("contest_id")] === id).map((r) => ({ from: Number(r[pcol("rank_from")]), to: Number(r[pcol("rank_to")]), prize: Number(r[pcol("prize")]) }));
  const meta = (id: string) => { const r = pay.find((x) => x[pcol("contest_id")] === id); return { name: r?.[pcol("contest")] ?? id, fee: Number(r?.[pcol("entry_fee")] ?? 0) }; };
  const mk = (id: string, text: string, file: string): Contest => { const { rows, own } = parseStandings(text); return { id, ...meta(id), fileName: file, importedAt: Date.now(), rows, own, payouts: bands(id) }; };
  const { entries, pool } = parseEntries(demoEntries);
  const contests = [mk("main", demoMain, "contest-standings-sample.csv"), mk("se", demoSE, "contest-standings-se-sample.csv"), mk("3max", demo3, "contest-standings-3max-sample.csv")];
  const ids = ["184022311", "184022467", "184022590"]; contests.forEach((c, i) => { c.dkContestId = ids[i]; });
  return { username, card, bouts, fpts, contests, entries, pool, demo: true, savedAt: Date.now() };
}

