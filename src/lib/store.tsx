import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { norm, parseCard, parseEntries, parsePayouts, parseStandings } from "./parse";
import type { AppData, BoutState, Contest } from "./types";
import type { SimResult } from "./sim";
import { useOdds, useSync, type OddsState } from "./live";
import type { SyncState } from "./sync";
import cardClean from "@/data/card-ufc-nov7.csv?raw";
const KEY = "fightdesk:v1";

export function freshData(username = "mattpecce"): AppData {
  const { card } = parseCard(cardClean);
  const bouts: Record<number, BoutState> = {};
  card.forEach((f) => { bouts[f.bout] = { status: "upcoming" }; });
  return { username, card, bouts, fpts: {}, contests: [], entries: [], pool: [], demo: false, savedAt: Date.now() };
}

function load(): AppData | null {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as AppData; } catch { /* ignore */ }
  return null;
}

/** Demo files load on demand so the app itself stays small. */
export const loadDemo = (username?: string) => import("./demo").then((m) => m.demoData(username));

/** Points per fighter from the most recent standings export that lists them. */
export function fptsFromContests(contests: Contest[]): Record<string, number> {
  const out: Record<string, number> = {};
  contests.slice().sort((a, b) => a.importedAt - b.importedAt).forEach((c) => c.own.forEach((o) => { out[norm(o.player)] = o.fpts; }));
  return out;
}

/**
 * Fights the user hasn't marked yet but that already have points in an export:
 * a clear points gap with a win-bonus-sized total reads as final, anything else as live.
 */
export function inferBouts(d: AppData): { data: AppData; n: number } {
  const bouts = { ...d.bouts }; let n = 0; let t = Date.now();
  [...new Set(d.card.map((c) => c.bout))].sort((a, b) => b - a).forEach((b) => {
    const st = bouts[b] ?? { status: "upcoming" as const };
    if (st.status !== "upcoming") return;
    const fs = d.card.filter((c) => c.bout === b).map((c) => ({ c, p: d.fpts[norm(c.name)] ?? 0 })).sort((x, y) => y.p - x.p);
    if (fs.length < 2 || (fs[0].p === 0 && fs[1].p === 0)) return;
    n++;
    if (fs[0].p >= 40 && fs[0].p - fs[1].p >= 25) bouts[b] = { status: "final", winner: fs[0].c.name, finishedAt: t++ };
    else bouts[b] = { status: "live", elapsed: 5, finishedAt: t++ };
  });
  return { data: { ...d, bouts }, n };
}

/** Which contest in the lineup export holds these lineups. */
export function matchContest(data: AppData, rows: Contest["rows"]) {
  const me = data.username.toLowerCase();
  const key = (l: string[]) => l.map(norm).sort().join("|");
  const myKeys = rows.filter((r) => r.entryName.split(" (")[0].trim().toLowerCase() === me).map((r) => key(r.lineup));
  const groups = new Map<string, { name: string; id: string; fee: number; keys: string[] }>();
  data.entries.forEach((e) => { const k = e.contestId; if (!groups.has(k)) groups.set(k, { name: e.contest, id: e.contestId, fee: e.fee, keys: [] }); groups.get(k)!.keys.push(key(e.lineup)); });
  let best: { name: string; id: string; fee: number; score: number } | null = null;
  const taken = new Set(data.contests.map((c) => c.dkContestId).filter(Boolean));
  groups.forEach((g) => {
    if (taken.has(g.id)) return;
    const left = g.keys.slice(); let m = 0; myKeys.forEach((k) => { const i = left.indexOf(k); if (i >= 0) { m++; left.splice(i, 1); } });
    const score = m * 10 - Math.abs(g.keys.length - myKeys.length);
    if (m && (!best || score > best.score)) best = { name: g.name, id: g.id, fee: g.fee, score };
  });
  return best as { name: string; id: string; fee: number; score: number } | null;
}

interface Ctx {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  result: SimResult | null;
  running: boolean;
  contestId: string;
  setContestId: (id: string) => void;
  importFiles: (files: File[]) => Promise<string[]>;
  sync: { code: string; state: SyncState; connect: (code: string) => void; syncNow: () => void };
  odds: { state: OddsState; refresh: () => void };
}
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => load() ?? { ...freshData(), demo: true });
  useEffect(() => { if (!load()) loadDemo().then((d) => setData((cur) => (cur.demo && !cur.contests.length ? d : cur))); }, []);
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [contestId, setContestIdState] = useState<string>(() => { try { return localStorage.getItem(KEY + ":contest") || ""; } catch { return ""; } });
  const workerRef = useRef<Worker | null>(null);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const jobRef = useRef(0);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => ({ ...fn(d), savedAt: Date.now() })), []);
  const adopt = useCallback((d: AppData) => setData(d), []);
  const sync = useSync(data, dataRef, adopt);
  const odds = useOdds(dataRef, update);
  const setContestId = useCallback((id: string) => { setContestIdState(id); try { localStorage.setItem(KEY + ":contest", id); } catch { /* ignore */ } }, []);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ } }, [data]);

  useEffect(() => {
    if (!workerRef.current) workerRef.current = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    const w = workerRef.current; const job = ++jobRef.current;
    setRunning(true);
    const t = setTimeout(() => w.postMessage({ job, data }), 120);
    const onMsg = (e: MessageEvent<{ job: number; result: SimResult }>) => { if (e.data.job === jobRef.current) { setResult(e.data.result); setRunning(false); } };
    w.addEventListener("message", onMsg);
    return () => { clearTimeout(t); w.removeEventListener("message", onMsg); };
  }, [data]);

  const effectiveContest = data.contests.some((c) => c.id === contestId) ? contestId : data.contests[0]?.id ?? "";

  const importFiles = useCallback(async (files: File[]) => {
    const notes: string[] = [];
    const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    {
      const d0 = dataRef.current;
      let d: AppData = { ...d0, demo: false, savedAt: Date.now() };
      if (d0.demo) d = { ...freshData(d0.username) };
      for (const { name, text } of texts.sort((a) => (/entry id/i.test(a.text.slice(0, 200)) ? -1 : 1))) {
        const head = text.slice(0, 300).toLowerCase();
        if (head.includes("entry id") && head.includes("contest id")) {
          const { entries, pool } = parseEntries(text);
          d = { ...d, entries, pool };
          notes.push(`${name}: ${entries.length} of your entries across ${new Set(entries.map((e) => e.contestId)).size} contests, ${pool.length} fighters in the pool`);
          d = { ...d, contests: d.contests.map((c) => { if (c.dkContestId) return c; const m = matchContest({ ...d, contests: [] }, c.rows); return m ? { ...c, name: m.name, fee: m.fee, dkContestId: m.id } : c; }) };
        } else if (head.includes("entryid") && head.includes("lineup")) {
          const { rows, own } = parseStandings(text);
          const idFromFile = /(\d{6,})/.exec(name)?.[1];
          const existing = d.contests.find((c) => (idFromFile && c.dkContestId === idFromFile) || c.fileName === name);
          const m = existing ? null : matchContest(d, rows);
          const id = existing?.id ?? idFromFile ?? m?.id ?? "c" + Date.now().toString(36);
          const c: Contest = {
            id, name: existing?.name ?? m?.name ?? (idFromFile ? `Contest ${idFromFile}` : name.replace(/\.csv$/i, "")), fee: existing?.fee ?? m?.fee ?? 0,
            dkContestId: existing?.dkContestId ?? m?.id ?? idFromFile, fileName: name, importedAt: Date.now(), rows, own, payouts: existing?.payouts ?? [],
          };
          d = { ...d, contests: existing ? d.contests.map((x) => (x.id === existing.id ? c : x)) : [...d.contests, c] };
          d = { ...d, fpts: { ...d.fpts, ...fptsFromContests([c]) } };
          const guessed = inferBouts(d);
          if (guessed.n) { d = guessed.data; notes.push(`Set ${guessed.n} ${guessed.n === 1 ? "fight" : "fights"} live or final from the points in this export — check them in Fights.`); }
          const mineN = rows.filter((r) => r.entryName.split(" (")[0].trim().toLowerCase() === d.username.toLowerCase()).length;
          notes.push(`${name}: ${rows.length.toLocaleString()} entries, ${mineN} yours${existing ? " (updated)" : ""}${c.payouts.length ? "" : " — add its prize table"}`);
        } else if (head.includes("fighter") && head.includes("win_prob")) {
          const { card } = parseCard(text); d = { ...d, card }; notes.push(`${name}: card with ${card.length} fighters`);
        } else {
          const bands = parsePayouts(text);
          notes.push(bands.length ? `${name}: looks like a prize table — paste it on the contest instead` : `${name}: not a DraftKings file this app reads`);
        }
      }
      if (d0.demo) notes.unshift("Demo data cleared — now tracking your files.");
      setData(d);
    }
    return notes;
  }, []);

  const value = useMemo(() => ({ data, update, result, running, contestId: effectiveContest, setContestId, importFiles, sync, odds }), [data, update, result, running, effectiveContest, setContestId, importFiles, sync, odds]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
