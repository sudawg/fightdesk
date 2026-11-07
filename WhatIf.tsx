import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Delta, Panel, Seg } from "@/components/bits";
import { cn } from "@/lib/utils";
import { last, money, ord, pct } from "@/lib/format";
import { useView } from "./shared";

type Pick = { w: "a" | "b" | null; m: 0 | 1 | 2 | null };

export function WhatIf() {
  const { r, cid } = useView();
  const [pick, setPick] = useState<Record<number, Pick>>({});
  const W = r?.whatif;
  const keep = useMemo(() => {
    if (!W) return null;
    const k = new Uint8Array(W.N).fill(1);
    W.fights.forEach((f, i) => {
      const p = pick[f.bout]; if (!p || (p.w == null && p.m == null)) return;
      const c = W.codes[i];
      for (let s = 0; s < W.N; s++) { if (!k[s]) continue; const v = c[s]; if ((p.w === "a" && v >= 3) || (p.w === "b" && v < 3) || (p.m != null && v % 3 !== p.m)) k[s] = 0; }
    });
    return k;
  }, [W, pick]);
  if (!r || !W || !keep) return null;
  const n = keep.reduce((t, v) => t + v, 0);
  const active = Object.values(pick).some((p) => p.w != null || p.m != null);
  const stat = (e: (typeof W.entries)[number], only: boolean) => {
    let cnt = 0, cash = 0, win = 0, ev = 0; const rk: number[] = [];
    for (let s = 0; s < W.N; s++) { if (only && !keep[s]) continue; cnt++; const pz = e.prizes[s]; ev += pz; if (pz > 0) cash++; if (e.ranks[s] === 1) win++; rk.push(e.ranks[s]); }
    rk.sort((a, b) => a - b);
    return cnt ? { cash: cash / cnt, win: win / cnt, ev: ev / cnt, med: rk[Math.floor((rk.length - 1) / 2)] } : null;
  };
  const anyStat = (only: boolean) => { let cnt = 0, any = 0, tot = 0; for (let s = 0; s < W.N; s++) { if (only && !keep[s]) continue; cnt++; let t = 0; W.entries.forEach((e) => { t += e.prizes[s]; }); tot += t; if (t > 0) any++; } return cnt ? { any: any / cnt, ev: tot / cnt } : null; };
  const b0 = anyStat(false), b1 = active ? anyStat(true) : b0;
  const set = (bout: number, patch: Partial<Pick>) => setPick((p) => ({ ...p, [bout]: { w: null, m: null, ...p[bout], ...patch } }));
  const contests = [cid, ...new Set(W.entries.map((e) => e.contestId))].filter((c, i, a) => a.indexOf(c) === i);
  const names = new Map(r.summaries.map((s) => [s.contestId, s.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">Pick a winner, a method, or both. Every number keeps only the simulations where those results happen, so it updates instantly; the small numbers compare with all simulations.</p>
        <button type="button" onClick={() => setPick({})} className="press hit-sm inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
      </div>
      {!W.fights.length && <p className="text-sm text-muted-foreground">Every fight is final.</p>}
      <Panel className="divide-y">
        {W.fights.map((f) => {
          const p = pick[f.bout] ?? { w: null, m: null };
          return (
            <div key={f.bout} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">{last(f.a)} vs {last(f.b)}{f.live && <span className="rounded-full bg-brand/10 px-1.5 text-[11px] font-semibold text-brand">LIVE</span>}</div>
              <div className="flex flex-wrap gap-2">
                <Seg<"a" | "b" | null> label={`Winner of ${f.a} vs ${f.b}`} value={p.w} onChange={(v) => set(f.bout, { w: v })} options={[{ v: null, label: "Either" }, { v: "a", label: `${last(f.a)} ${Math.round(f.pa * 100)}%` }, { v: "b", label: `${last(f.b)} ${Math.round((1 - f.pa) * 100)}%` }]} />
                <Seg<0 | 1 | 2 | null> label="Method" value={p.m} onChange={(v) => set(f.bout, { m: v })} options={[{ v: null, label: "Any" }, { v: 0, label: "KO" }, { v: 1, label: "SUB" }, { v: 2, label: "DEC" }]} />
              </div>
            </div>
          );
        })}
      </Panel>
      <p className={cn("rounded-md px-3 py-2 text-sm", active && n < 30 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")}>
        {!active ? `No results picked — all ${W.N.toLocaleString()} simulations.` : n < 30 ? `Only ${n} simulations match — too few to read much into.` : `${n.toLocaleString()} of ${W.N.toLocaleString()} simulations match (${pct(n / W.N)}).`}
      </p>
      {b1 && b0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border [&>div]:bg-card">
          <div className="p-4"><div className="text-xs text-muted-foreground">Any entry cashes</div><div className="num text-2xl font-semibold">{pct(b1.any)}{active && <Delta base={b0.any * 100} now={b1.any * 100} fmt={(x) => x.toFixed(1)} />}</div></div>
          <div className="p-4"><div className="text-xs text-muted-foreground">Expected payout, all contests</div><div className="num text-2xl font-semibold">{money(b1.ev)}{active && <Delta base={b0.ev} now={b1.ev} fmt={money} />}</div></div>
        </div>
      )}
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead><tr className="border-b text-xs text-muted-foreground"><th className="px-4 py-2 text-left font-medium">Lineup</th><th className="px-3 py-2 text-right font-medium">Cash</th><th className="px-3 py-2 text-right font-medium">Win</th><th className="px-3 py-2 text-right font-medium">Exp. payout</th><th className="px-4 py-2 text-right font-medium">Median rank</th></tr></thead>
          {contests.map((c) => (
            <tbody key={c}>
              <tr><td colSpan={5} className="px-4 pb-1 pt-3 text-xs font-semibold">{names.get(c) ?? c}</td></tr>
              {W.entries.filter((e) => e.contestId === c).map((e) => {
                const s0 = stat(e, false), s1 = active ? stat(e, true) : s0;
                return (
                  <tr key={c + e.label} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2">{e.label} <span className="num text-xs text-muted-foreground">now {ord(e.rank)}</span></td>
                    <td className="num px-3 py-2 text-right text-xs">{s1 ? pct(s1.cash) : "—"}{s0 && s1 && active && <Delta base={s0.cash * 100} now={s1.cash * 100} fmt={(x) => x.toFixed(0)} />}</td>
                    <td className="num px-3 py-2 text-right text-xs">{s1 ? pct(s1.win) : "—"}</td>
                    <td className="num px-3 py-2 text-right text-xs">{s1 ? money(s1.ev) : "—"}{s0 && s1 && active && <Delta base={s0.ev} now={s1.ev} fmt={money} />}</td>
                    <td className="num px-4 py-2 text-right text-xs">{s1 ? ord(s1.med) : "—"}{s0 && s1 && active && <Delta base={s0.med} now={s1.med} fmt={(x) => x.toLocaleString()} invert />}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </Panel>
    </div>
  );
}
