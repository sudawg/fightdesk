import { norm } from "./parse";
import type { AppData, Contest } from "./types";

export interface SimEntry {
  contestId: string;
  entryId: string;
  entryName: string;
  rank: number;
  points: number;
  pmr: number;
  proj: number;
  win: number;
  cash: number;
  top10: number;
  ev: number;
  dupes: number;
  shared: number;
  mine: boolean;
  lineup: string[];
}

export interface FighterLine {
  name: string;
  status: string;
  result: "W" | "L" | "";
  method: string;
  round: number | null;
  fpts: number;
  salary: number;
  mean: number;
  p90: number;
  pWin: number;
}

export interface PathStep { w: string; l: string; m: string; r: number }

export interface MyLineup extends SimEntry {
  label: string;
  contestName: string;
  fee: number;
  field: number;
  paidN: number;
  firstPrize: number;
  nowPrize: number;
  p10: number;
  p50: number;
  p90: number;
  hist: number[];
  remaining: number;
  needNow: number | null;
  needCash: number;
  needWin: number;
  remMean: number;
  remCeil: number;
  fighters: FighterLine[];
  allWin: Cond | null;
  allLose: Cond | null;
  best: { rank: number; pts: number; path: PathStep[] };
  worst: { rank: number; pts: number; path: PathStep[] };
  avgOwn: number;
  unique: number;
}

export interface Cond { share: number; cash: number; win: number; pts: number; medRank: number }

export interface Summary {
  contestId: string;
  name: string;
  field: number;
  entries: number;
  fee: number;
  pool: number;
  paidN: number;
  first: number;
  bestRank: number | null;
  bestLabel: string;
  anyCash: number;
  anyWin: number;
  ev: number;
  nowWin: number;
  fees: number;
  net: number;
  pmr: number;
  pmrField: number;
  lineNow: number | null;
  lineP50: number;
  winP50: number;
  bins: { lo: number; hi: number; label: string; paid: boolean }[];
}

export interface RootRow {
  contestId: string; // "all" for every contest together
  bout: number;
  live: boolean;
  a: string;
  b: string;
  cashA: number;
  cashB: number;
  evA: number;
  evB: number;
  rootFor: string;
  swing: number;
  byLineup: { label: string; a: number; b: number }[];
}

export interface Threat {
  contestId: string;
  entryName: string;
  rank: number;
  points: number;
  pmr: number;
  win: number;
  top10: number;
  ahead: number;
  cost: number;
  threat: number;
  shared: number;
  fades: string[];
  lineup: string[];
}

export interface Alert {
  contestId: string;
  order: number;
  kind: "in" | "out" | "up" | "down" | "live" | "next" | "big" | "close";
  text: string;
}

export interface WhatIf {
  N: number;
  fights: { bout: number; a: string; b: string; live: boolean; pa: number }[];
  codes: Uint8Array[];
  entries: { contestId: string; label: string; rank: number; fee: number; ranks: Int32Array; prizes: Float32Array }[];
}

export interface SimResult {
  N: number;
  ms: number;
  summaries: Summary[];
  all: { entries: number; anyCash: number; anyWin: number; ev: number; nowWin: number; fees: number; net: number; pmr: number };
  board: SimEntry[];
  mine: MyLineup[];
  rooting: RootRow[];
  threats: Threat[];
  alerts: Alert[];
  whatif: WhatIf;
  fighterStats: Record<string, { mean: number; p90: number; pWin: number }>;
}

const WB = [0, 90, 70, 45, 40, 40];
const RD3 = [0.45, 0.3, 0.25];
const RD5 = [0.36, 0.24, 0.18, 0.12, 0.1];
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const q = (arr: ArrayLike<number>, p: number) => {
  const a = Array.from(arr).sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))] : 0;
};
const last = (n: string) => String(n).split(" ").slice(-1)[0];
export const lineupLabel = (nm: string) => { const m = /\((\d+)\s*\/\s*\d+\)/.exec(nm); return "Lineup " + (m ? m[1] : "1"); };

interface F2 {
  name: string; opp: string; bout: number; rounds: number; p: number; fin: number; pw: number; pl: number;
  status: string; fpts: number; cur: number; el: number; result: "W" | "L" | ""; method: string; round: number | null; salary: number; i: number;
}

export function runSim(data: AppData, N = 3000): SimResult {
  const t0 = performance.now();
  const ME = data.username.trim().toLowerCase();
  let seed = 1107;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

  // ---- fighters with live state ----
  const F = new Map<string, F2>();
  data.card.forEach((c, i) => {
    const b = data.bouts[c.bout] ?? { status: "upcoming" };
    const isFav = data.card.find((o) => norm(o.name) === norm(c.opponent))?.winProb ?? 0;
    let p = c.winProb;
    if (b.status === "live" && b.liveWinProb != null) p = c.winProb >= isFav ? b.liveWinProb : 1 - b.liveWinProb;
    F.set(norm(c.name), {
      name: c.name, opp: c.opponent, bout: c.bout, rounds: c.rounds, p, fin: c.finishProb, pw: c.ppmWin, pl: c.ppmLoss,
      status: b.status, fpts: b.status === "upcoming" ? 0 : data.fpts[norm(c.name)] ?? 0, cur: data.fpts[norm(c.name)] ?? 0, el: b.status === "live" ? b.elapsed ?? 0 : 0,
      result: b.status === "final" ? (b.winner && norm(b.winner) === norm(c.name) ? "W" : "L") : "",
      method: b.status === "final" && b.winner && norm(b.winner) === norm(c.name) ? b.method ?? "" : "",
      round: b.round ?? null, salary: c.salary, i,
    });
  });
  const nF = data.card.length;
  const fights: { bout: number; a: F2; b: F2; live: boolean }[] = [];
  const seenB = new Set<number>();
  for (const f of F.values()) {
    if (f.status === "final" || seenB.has(f.bout)) continue;
    const o = F.get(norm(f.opp)); if (!o) continue; seenB.add(f.bout);
    const [a, b] = f.p >= o.p ? [f, o] : [o, f];
    fights.push({ bout: f.bout, a, b, live: f.status === "live" });
  }
  fights.sort((x, y) => x.bout - y.bout);
  const isMine = (nm: string) => nm.split(" (")[0].trim().toLowerCase() === ME;

  // ---- contests ----
  const C = data.contests.filter((c) => c.rows.length).map((ct: Contest) => {
    const rows = ct.rows; const E = rows.length;
    const prize = new Float64Array(E + 2); let paidN = 0, pool = 0;
    for (const p of ct.payouts) { const b = Math.min(p.to, E); for (let k = p.from; k <= b; k++) { prize[k] = p.prize; pool += p.prize; } paidN = Math.max(paidN, b); }
    const cum = new Float64Array(E + 2); for (let k = 1; k <= E + 1; k++) cum[k] = cum[k - 1] + prize[k];
    const ents = rows.map((r) => {
      const rem: number[] = []; let curRem = 0;
      for (const n of r.lineup) { const f = F.get(norm(n)); if (f && f.status !== "final") { rem.push(f.i); curRem += f.cur; } }
      return { ...r, key: r.lineup.map(norm).sort().join("|"), rem, base: r.points - curRem, mine: isMine(r.entryName) };
    });
    const dup = new Map<string, number>(); ents.forEach((e) => dup.set(e.key, (dup.get(e.key) || 0) + 1));
    const mineIdx: number[] = []; ents.forEach((e, i) => { if (e.mine) mineIdx.push(i); });
    return {
      ct, E, prize, cum, paidN, pool, ents, dup, mineIdx,
      win: new Float64Array(E), cash: new Float64Array(E), top10: new Float64Array(E), ev: new Float64Array(E), sc: new Float64Array(E),
      my10: new Float64Array(E), ahead: new Float64Array(E), rk: new Int32Array(E), myTotSum: 0,
      scores: new Float64Array(E), sorted: new Float64Array(E),
      myRank: mineIdx.map(() => new Int32Array(N)), myPrize: mineIdx.map(() => new Float32Array(N)),
      cond: mineIdx.map(() => ({ w: { n: 0, cash: 0, win: 0, pts: 0, ranks: [] as number[] }, l: { n: 0, cash: 0, win: 0, pts: 0, ranks: [] as number[] } })),
      best: mineIdx.map(() => ({ rank: Infinity, pts: 0, path: [] as PathStep[] })), worst: mineIdx.map(() => ({ rank: -1, pts: 0, path: [] as PathStep[] })),
      root: fights.map(() => ({ na: 0, nb: 0, ca: 0, cb: 0, eva: 0, evb: 0, pa: mineIdx.map(() => 0), pb: mineIdx.map(() => 0) })),
      cashLine: new Float64Array(N), topScore: new Float64Array(N), anyCash: 0, anyWin: 0,
    };
  });
  const rootAll = fights.map(() => ({ na: 0, nb: 0, ca: 0, cb: 0, eva: 0, evb: 0 }));
  let allAnyCash = 0, allAnyWin = 0;
  const fp = new Float64Array(nF), won = new Uint8Array(nF), fSum = new Float64Array(nF), fWins = new Float64Array(nF);
  const fSamples = new Map<number, Float32Array>(fights.flatMap((ft) => [[ft.a.i, new Float32Array(N)], [ft.b.i, new Float32Array(N)]] as [number, Float32Array][]));
  const outc: PathStep[] = fights.map(() => ({ w: "", l: "", m: "", r: 0 }));
  const codes = fights.map(() => new Uint8Array(N));

  for (let s = 0; s < N; s++) {
    fights.forEach((ft, k) => {
      const { a, b } = ft; const el = Math.max(a.el, b.el);
      let w = a, end = 0, r = 0, m = "DEC", tries = 0;
      do {
        w = rnd() < a.p / (a.p + b.p) ? a : b;
        if (rnd() < a.fin) {
          const d = a.rounds === 5 ? RD5 : RD3; let u = rnd(), rr = 0;
          while (rr < d.length - 1 && u > d[rr]) { u -= d[rr]; rr++; }
          r = rr + 1; end = rr * 5 + 0.3 + rnd() * 4.7; m = rnd() < 0.65 ? "KO/TKO" : "SUB";
        } else { r = 0; end = a.rounds * 5; m = "DEC"; }
        tries++;
      } while (end <= el && tries < 50);
      if (end <= el) { r = 0; end = a.rounds * 5; m = "DEC"; }
      for (const f of [a, b]) {
        const iw = f === w;
        fp[f.i] = f.fpts + (iw ? f.pw : f.pl) * (end - el) * Math.exp(gauss() * 0.3 - 0.045) + (iw ? (r ? WB[r] : 30) : 0);
        won[f.i] = iw ? 1 : 0; fSum[f.i] += fp[f.i]; if (iw) fWins[f.i]++;
        fSamples.get(f.i)![s] = fp[f.i];
      }
      outc[k] = { w: w.name, l: (w === a ? b : a).name, m, r: r || a.rounds };
      codes[k][s] = (w === a ? 0 : 3) + (m === "KO/TKO" ? 0 : m === "SUB" ? 1 : 2);
    });
    let allTot = 0, allAny = false, allW = false;
    for (const c of C) {
      const { E, ents, scores, sorted, cum } = c;
      for (let e = 0; e < E; e++) { let v = ents[e].base; for (const i of ents[e].rem) v += fp[i]; scores[e] = v; }
      sorted.set(scores); sorted.sort();
      const ub = (x: number) => { let lo = 0, hi = E; while (lo < hi) { const mm = (lo + hi) >> 1; if (sorted[mm] <= x) lo = mm + 1; else hi = mm; } return lo; };
      const lb = (x: number) => { let lo = 0, hi = E; while (lo < hi) { const mm = (lo + hi) >> 1; if (sorted[mm] < x) lo = mm + 1; else hi = mm; } return lo; };
      const place = (x: number) => { const u = ub(x), l = lb(x); const g = E - u, t = u - l; return { rk: g + 1, t, pz: (cum[Math.min(g + t, E)] - cum[Math.min(g, E)]) / t }; };
      c.topScore[s] = sorted[E - 1]; c.cashLine[s] = c.paidN ? sorted[E - c.paidN] : 0;
      for (let e = 0; e < E; e++) { const P = place(scores[e]); c.rk[e] = P.rk; c.sc[e] += scores[e]; c.ev[e] += P.pz; if (P.pz > 0) c.cash[e]++; if (P.rk === 1) c.win[e] += 1 / P.t; if (P.rk <= 10) c.top10[e]++; }
      let myTot = 0, myAny = false, myW = false, myMax = -Infinity;
      c.mineIdx.forEach((e, j) => {
        const x = scores[e], P = place(x), en = ents[e];
        if (x > myMax) myMax = x;
        c.myRank[j][s] = P.rk; c.myPrize[j][s] = P.pz; myTot += P.pz; if (P.pz > 0) myAny = true; if (P.rk === 1) myW = true;
        if (en.rem.length) {
          const aw = en.rem.every((i) => won[i]), al = en.rem.every((i) => !won[i]);
          for (const [flag, cc] of [[aw, c.cond[j].w], [al, c.cond[j].l]] as const) if (flag) { cc.n++; cc.pts += x; cc.ranks.push(P.rk); if (P.pz > 0) cc.cash++; if (P.rk === 1) cc.win++; }
        }
        if (P.rk < c.best[j].rank || (P.rk === c.best[j].rank && x > c.best[j].pts)) c.best[j] = { rank: P.rk, pts: x, path: outc.map((o) => ({ ...o })) };
        if (P.rk > c.worst[j].rank || (P.rk === c.worst[j].rank && x < c.worst[j].pts)) c.worst[j] = { rank: P.rk, pts: x, path: outc.map((o) => ({ ...o })) };
        fights.forEach((ft, k) => { if (P.pz > 0) { if (outc[k].w === ft.a.name) c.root[k].pa[j]++; else c.root[k].pb[j]++; } });
      });
      if (myAny) c.anyCash++; if (myW) c.anyWin++;
      c.myTotSum += myTot;
      for (let e = 0; e < E; e++) { if (c.rk[e] <= 10) c.my10[e] += myTot; if (c.mineIdx.length && scores[e] > myMax) c.ahead[e]++; }
      fights.forEach((ft, k) => { const R = c.root[k]; if (outc[k].w === ft.a.name) { R.na++; if (myAny) R.ca++; R.eva += myTot; } else { R.nb++; if (myAny) R.cb++; R.evb += myTot; } });
      allTot += myTot; if (myAny) allAny = true; if (myW) allW = true;
    }
    if (allAny) allAnyCash++; if (allW) allAnyWin++;
    fights.forEach((ft, k) => { const R = rootAll[k]; if (outc[k].w === ft.a.name) { R.na++; if (allAny) R.ca++; R.eva += allTot; } else { R.nb++; if (allAny) R.cb++; R.evb += allTot; } });
  }

  // ---- outputs ----
  const fighterStats: Record<string, { mean: number; p90: number; pWin: number }> = {};
  fSamples.forEach((arr, i) => { fighterStats[norm(data.card[i].name)] = { mean: r1(fSum[i] / N), p90: r1(q(arr, 0.9)), pWin: r4(fWins[i] / N) }; });
  const fInfo = (n: string): FighterLine => {
    const f = F.get(norm(n));
    if (!f) return { name: n, status: "final", result: "", method: "", round: null, fpts: 0, salary: 0, mean: 0, p90: 0, pWin: 0 };
    const st = fighterStats[norm(n)];
    return { name: f.name, status: f.status, result: f.result, method: f.method, round: f.round, fpts: f.fpts, salary: f.salary, mean: st ? st.mean : f.fpts, p90: st ? st.p90 : f.fpts, pWin: st ? st.pWin : f.result === "W" ? 1 : 0 };
  };
  const sumC = (c: { n: number; cash: number; win: number; pts: number; ranks: number[] }): Cond | null => (c.n ? { share: r4(c.n / N), cash: r4(c.cash / c.n), win: r4(c.win / c.n), pts: r1(c.pts / c.n), medRank: q(c.ranks, 0.5) } : null);
  const ownMap = new Map<string, number>();
  data.contests.forEach((ct) => ct.own.forEach((o) => { if (!ownMap.has(norm(o.player))) ownMap.set(norm(o.player), o.drafted); }));
  const ownScore = (lu: string[]) => lu.reduce((t, n) => t + Math.log(Math.max(0.002, ownMap.get(norm(n)) || 0.002)), 0);

  const board: SimEntry[] = [], mine: MyLineup[] = [], rooting: RootRow[] = [], summaries: Summary[] = [], threats: Threat[] = [];
  let allEv = 0, allFees = 0, allEntries = 0, allPmr = 0, allNow = 0;
  for (const c of C) {
    const id = c.ct.id;
    const mySets = c.mineIdx.map((e) => new Set(c.ents[e].lineup.map(norm)));
    const sharedOf = (lu: string[]) => (mySets.length ? Math.max(...mySets.map((S) => lu.filter((n) => S.has(norm(n))).length)) : 0);
    const lineP50 = r1(q(c.cashLine, 0.5)), winP50 = r1(q(c.topScore, 0.5));
    const byPts = c.ents.slice().sort((x, y) => y.points - x.points);
    const lineNow = c.paidN && byPts[c.paidN - 1] ? byPts[c.paidN - 1].points : null;
    c.ents.forEach((en, e) => board.push({
      contestId: id, entryId: en.entryId, entryName: en.entryName, rank: en.rank, points: en.points, pmr: en.pmr, proj: r1(c.sc[e] / N),
      win: r4(c.win[e] / N), cash: r4(c.cash[e] / N), top10: r4(c.top10[e] / N), ev: r2(c.ev[e] / N), dupes: (c.dup.get(en.key) ?? 1) - 1,
      shared: sharedOf(en.lineup), mine: en.mine, lineup: en.lineup,
    }));
    const edges = [1, 2, 6, 11, 26, 51, 101, c.paidN + 1, Math.round((c.paidN + c.E) / 2) + 1, c.E + 1].sort((x, y) => x - y).filter((v, i, a) => v <= c.E + 1 && (i === 0 || v > a[i - 1]));
    const bins = edges.slice(0, -1).map((lo, i) => { const hi = edges[i + 1] - 1; return { lo, hi, label: lo === hi ? (lo === 1 ? "1st" : "#" + lo) : `${lo}–${hi}`, paid: hi <= c.paidN }; });
    const scoresAll = c.ents.map((en) => ownScore(en.lineup)).sort((a, b) => a - b);
    const cm: MyLineup[] = c.mineIdx.map((e, j) => {
      const en = c.ents[e], rk = c.myRank[j];
      const hist = bins.map((b) => { let n = 0; for (let s = 0; s < N; s++) if (rk[s] >= b.lo && rk[s] <= b.hi) n++; return r4(n / N); });
      const fighters = en.lineup.map(fInfo); const rem = fighters.filter((f) => f.status !== "final");
      const g = c.ents.filter((o) => o.points > en.points).length, t = c.ents.filter((o) => o.points === en.points).length;
      const os = ownScore(en.lineup); let below = 0; while (below < scoresAll.length && scoresAll[below] < os) below++;
      return {
        ...board[board.length - c.E + e], label: lineupLabel(en.entryName), contestName: c.ct.name, fee: c.ct.fee, field: c.E, paidN: c.paidN, firstPrize: c.prize[1],
        nowPrize: r2((c.cum[Math.min(g + t, c.E)] - c.cum[Math.min(g, c.E)]) / Math.max(1, t)),
        p10: q(rk, 0.1), p50: q(rk, 0.5), p90: q(rk, 0.9), hist, remaining: en.rem.length,
        needNow: lineNow == null ? null : r1(Math.max(0, lineNow - en.points)), needCash: r1(Math.max(0, lineP50 - en.points)), needWin: r1(Math.max(0, winP50 - en.points)),
        remMean: r1(rem.reduce((tt, f) => tt + (f.mean - f.fpts), 0)), remCeil: r1(rem.reduce((tt, f) => tt + (f.p90 - f.fpts), 0)),
        fighters, allWin: sumC(c.cond[j].w), allLose: sumC(c.cond[j].l),
        best: { rank: c.best[j].rank, pts: r1(c.best[j].pts), path: c.best[j].path }, worst: { rank: c.worst[j].rank, pts: r1(c.worst[j].pts), path: c.worst[j].path },
        avgOwn: r4(en.lineup.reduce((tt, n) => tt + (ownMap.get(norm(n)) || 0), 0) / Math.max(1, en.lineup.length)), unique: r4(1 - below / Math.max(1, scoresAll.length)),
      };
    }).sort((x, y) => x.rank - y.rank);
    mine.push(...cm);
    fights.forEach((ft, k) => {
      const R = c.root[k]; const cashA = R.na ? R.ca / R.na : 0, cashB = R.nb ? R.cb / R.nb : 0, evA = R.na ? R.eva / R.na : 0, evB = R.nb ? R.evb / R.nb : 0;
      rooting.push({
        contestId: id, bout: ft.bout, live: ft.live, a: ft.a.name, b: ft.b.name, cashA: r4(cashA), cashB: r4(cashB), evA: r2(evA), evB: r2(evB), rootFor: evA >= evB ? ft.a.name : ft.b.name, swing: r2(Math.abs(evA - evB)),
        byLineup: c.mineIdx.map((e, j) => ({ label: lineupLabel(c.ents[e].entryName), a: R.na ? r4(R.pa[j] / R.na) : 0, b: R.nb ? r4(R.pb[j] / R.nb) : 0 })),
      });
    });
    // threats
    const myRemOpp = new Set<string>(); c.mineIdx.forEach((e) => c.ents[e].lineup.forEach((n) => { const f = F.get(norm(n)); if (f && f.status !== "final") myRemOpp.add(norm(f.opp)); }));
    const th: Threat[] = [];
    c.ents.forEach((en, e) => {
      if (en.mine || c.top10[e] < 10 || !c.mineIdx.length) return;
      const t10 = c.top10[e] / N, withThem = c.my10[e] / c.top10[e], without = (c.myTotSum - c.my10[e]) / Math.max(1, N - c.top10[e]);
      const cost = without - withThem; if (cost <= 0) return;
      th.push({ contestId: id, entryName: en.entryName, rank: en.rank, points: en.points, pmr: en.pmr, win: r4(c.win[e] / N), top10: r4(t10), ahead: r4(c.ahead[e] / N), cost: r2(cost), threat: r2(t10 * cost), shared: sharedOf(en.lineup), fades: en.lineup.filter((n) => myRemOpp.has(norm(n))).map((n) => F.get(norm(n))?.name ?? n), lineup: en.lineup });
    });
    threats.push(...th.sort((a, b) => b.threat - a.threat).slice(0, 10));
    const evTot = cm.reduce((tt, m) => tt + m.ev, 0), nowTot = cm.reduce((tt, m) => tt + m.nowPrize, 0);
    summaries.push({
      contestId: id, name: c.ct.name, field: c.E, entries: cm.length, fee: c.ct.fee, pool: c.pool, paidN: c.paidN, first: c.prize[1],
      bestRank: cm[0]?.rank ?? null, bestLabel: cm[0]?.label ?? "", anyCash: r4(c.anyCash / N), anyWin: r4(c.anyWin / N),
      ev: r2(evTot), nowWin: r2(nowTot), fees: c.ct.fee * cm.length, net: r2(evTot - c.ct.fee * cm.length),
      pmr: cm.reduce((tt, m) => tt + m.pmr, 0), pmrField: r1(c.ents.reduce((tt, e) => tt + e.pmr, 0) / Math.max(1, c.E)),
      lineNow, lineP50, winP50, bins,
    });
    allEv += evTot; allFees += c.ct.fee * cm.length; allEntries += cm.length; allPmr += cm.reduce((tt, m) => tt + m.pmr, 0); allNow += nowTot;
  }
  fights.forEach((ft, k) => {
    const R = rootAll[k]; const evA = R.na ? R.eva / R.na : 0, evB = R.nb ? R.evb / R.nb : 0;
    rooting.push({ contestId: "all", bout: ft.bout, live: ft.live, a: ft.a.name, b: ft.b.name, cashA: r4(R.na ? R.ca / R.na : 0), cashB: r4(R.nb ? R.cb / R.nb : 0), evA: r2(evA), evB: r2(evB), rootFor: evA >= evB ? ft.a.name : ft.b.name, swing: r2(Math.abs(evA - evB)), byLineup: [] });
  });
  rooting.sort((x, y) => y.swing - x.swing);

  const alerts = buildAlerts(data, C.map((c) => ({ id: c.ct.id, name: c.ct.name, paidN: c.paidN, rows: c.ct.rows })), rooting, mine, isMine, F);
  return {
    N, ms: Math.round(performance.now() - t0), summaries,
    all: { entries: allEntries, anyCash: r4(allAnyCash / N), anyWin: r4(allAnyWin / N), ev: r2(allEv), nowWin: r2(allNow), fees: allFees, net: r2(allEv - allFees), pmr: allPmr },
    board, mine, rooting, threats, alerts, fighterStats,
    whatif: {
      N, fights: fights.map((ft) => ({ bout: ft.bout, a: ft.a.name, b: ft.b.name, live: ft.live, pa: r4(ft.a.p / (ft.a.p + ft.b.p)) })), codes,
      entries: C.flatMap((c) => c.mineIdx.map((e, j) => ({ contestId: c.ct.id, label: lineupLabel(c.ents[e].entryName), rank: c.ents[e].rank, fee: c.ct.fee, ranks: c.myRank[j], prizes: c.myPrize[j] }))),
    },
  };
}

/** Replays finished fights in the order they ended to find cash-line crossings and big moves. */
function buildAlerts(data: AppData, contests: { id: string; name: string; paidN: number; rows: Contest["rows"] }[], rooting: RootRow[], mine: MyLineup[], isMine: (n: string) => boolean, F: Map<string, F2>): Alert[] {
  const out: Alert[] = [];
  const finals = Object.entries(data.bouts).filter(([, b]) => b.status === "final" || b.status === "live")
    .map(([k, b]) => ({ bout: Number(k), b })).sort((x, y) => (x.b.finishedAt ?? 0) - (y.b.finishedAt ?? 0) || y.bout - x.bout);
  for (const ct of contests) {
    const done = new Set<number>(); const was = new Map<string, { inCash: boolean; rank: number }>();
    finals.forEach(({ bout, b }, si) => {
      done.add(bout);
      const sc = ct.rows.map((r) => ({ r, pts: r.lineup.reduce((t, n) => { const f = F.get(norm(n)); return t + (f && done.has(f.bout) ? f.fpts : 0); }, 0) })).sort((x, y) => y.pts - x.pts);
      let rk = 0; const ranks = new Map<string, number>(); sc.forEach((x, i) => { if (i === 0 || x.pts !== sc[i - 1].pts) rk = i + 1; ranks.set(x.r.entryName, rk); });
      const pair = data.card.filter((c) => c.bout === bout); const w = b.winner ?? "";
      const after = b.status === "live" ? `${last(pair[0]?.name ?? "")} vs ${last(pair[1]?.name ?? "")} (live)` : w ? `${w} won` : `bout ${bout}`;
      ct.rows.filter((r) => isMine(r.entryName)).forEach((r) => {
        const rank = ranks.get(r.entryName) ?? 0, inCash = rank <= ct.paidN, prev = was.get(r.entryName), lab = lineupLabel(r.entryName);
        if (prev && prev.inCash !== inCash) out.push({ contestId: ct.id, order: si, kind: inCash ? "in" : "out", text: `${ct.name} · ${lab} ${inCash ? "moved into" : "dropped out of"} the cash (#${prev.rank} → #${rank}) after ${after}` });
        else if (prev && Math.abs(prev.rank - rank) >= 100) out.push({ contestId: ct.id, order: si, kind: rank < prev.rank ? "up" : "down", text: `${ct.name} · ${lab} ${rank < prev.rank ? "jumped" : "fell"} #${prev.rank} → #${rank} after ${after}` });
        was.set(r.entryName, { inCash, rank });
      });
    });
  }
  const all = rooting.filter((r) => r.contestId === "all");
  const live = all.find((r) => r.live), nextUp = all.filter((r) => !r.live).sort((a, b) => b.bout - a.bout)[0], big = all.slice().sort((a, b) => b.swing - a.swing)[0];
  const O = 999;
  const fmt = (x: number) => "$" + x.toFixed(2);
  if (live) out.push({ contestId: "all", order: O, kind: "live", text: `Live: ${live.a} vs ${live.b} — root for ${live.rootFor} (${fmt(live.swing)} swing)` });
  if (nextUp) out.push({ contestId: "all", order: O + 1, kind: "next", text: `Up next: ${nextUp.a} vs ${nextUp.b} — root for ${nextUp.rootFor} (${fmt(nextUp.swing)} swing)` });
  if (big && big !== nextUp && big !== live) out.push({ contestId: "all", order: O + 2, kind: "big", text: `Biggest fight left for you: ${big.a} vs ${big.b} — root for ${big.rootFor} (${fmt(big.swing)} swing)` });
  mine.forEach((m) => { if (m.rank > m.paidN && m.needNow != null && m.needNow <= 50 && m.remaining) out.push({ contestId: m.contestId, order: O + 3, kind: "close", text: `${m.contestName} · ${m.label} is ${m.needNow.toFixed(1)} pts from today's cash line (#${m.rank})` }); });
  return out.sort((a, b) => b.order - a.order);
}
