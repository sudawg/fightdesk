import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Panel, RangeBar, StatusDot } from "@/components/bits";
import { cn } from "@/lib/utils";
import { int, last, money, ord, pct, pts } from "@/lib/format";
import type { MyLineup } from "@/lib/sim";
import { inC, useView } from "./shared";

export function Lineups() {
  const { r, sum, cid } = useView();
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!r || !sum) return null;
  const mine = inC(r.mine, cid);
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{mine.length} {mine.length === 1 ? "lineup" : "lineups"} in {sum.name}. Tap one for fighters, points needed and best/worst case.</p>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="press hit min-h-8 rounded-md border px-2.5 text-xs font-medium hover:bg-muted" onClick={() => setOpen(new Set(mine.map((m) => m.entryId)))}>Expand all</button>
          <button type="button" className="press hit min-h-8 rounded-md border px-2.5 text-xs font-medium hover:bg-muted" onClick={() => setOpen(new Set())}>Collapse</button>
        </div>
      </div>
      <Panel className="divide-y overflow-hidden">
        <div className="hidden grid-cols-[1rem_minmax(6rem,1.2fr)_4rem_4.5rem_3.5rem_4rem_4rem_5rem_4rem_minmax(7rem,1.4fr)] gap-3 px-4 py-2 text-xs text-muted-foreground lg:grid">
          <span /><span>Lineup</span><span className="text-right">Rank</span><span className="text-right">Pts</span><span className="text-right">PMR</span><span className="text-right">Win</span><span className="text-right">Cash</span><span className="text-right">Exp. $</span><span className="text-right">To cash</span><span>Likely finish</span>
        </div>
        {mine.map((m) => (
          <LineupRow key={m.entryId} m={m} open={open.has(m.entryId)} onToggle={() => toggle(m.entryId)} />
        ))}
      </Panel>
    </div>
  );
}

function LineupRow({ m, open, onToggle }: { m: MyLineup; open: boolean; onToggle: () => void }) {
  const inCash = m.rank <= m.paidN;
  const own = new Set(m.fighters.map((f) => f.name));
  const verdict = m.needCash <= m.remMean ? { t: "On track — average results get there", c: "text-success" } : m.needCash <= m.remCeil ? { t: "Needs above-average nights", c: "text-warning" } : { t: "Needs everything to break right", c: "text-destructive" };
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 lg:grid-cols-[1rem_minmax(6rem,1.2fr)_4rem_4.5rem_3.5rem_4rem_4rem_5rem_4rem_minmax(7rem,1.4fr)]">
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="min-w-0">
          <span className="block font-medium">{m.label}</span>
          <span className="num block text-xs text-muted-foreground lg:hidden">{pts(m.points)} pts · {m.pmr} PMR · cash {pct(m.cash, 0)}</span>
        </span>
        <span className={cn("num text-right text-sm font-semibold", inCash ? "text-success" : "")}>{ord(m.rank)}</span>
        <span className="num text-right text-sm lg:hidden">{money(m.ev)}</span>
        <span className="num hidden text-right text-xs lg:block">{pts(m.points)}</span>
        <span className="num hidden text-right text-xs lg:block">{m.pmr}</span>
        <span className="num hidden text-right text-xs lg:block">{pct(m.win)}</span>
        <span className={cn("num hidden text-right text-xs lg:block", m.cash >= 0.5 && "text-success")}>{pct(m.cash)}</span>
        <span className="num hidden text-right text-xs lg:block">{money(m.ev)}</span>
        <span className={cn("num hidden text-right text-xs lg:block", m.needNow === 0 && "text-success")}>{m.needNow === 0 ? "in" : m.needNow == null ? "—" : `+${pts(m.needNow, 0)}`}</span>
        <span className="hidden lg:block"><RangeBar field={m.field} paidN={m.paidN} p10={m.p10} p50={m.p50} p90={m.p90} rank={m.rank} /></span>
      </button>
      {open && (
        <div className="grid gap-5 bg-muted/30 px-4 pb-5 pt-2 sm:grid-cols-2 lg:grid-cols-4 lg:pl-11">
          <div>
            <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Fighters</h4>
            <ul className="space-y-1.5 text-sm">
              {m.fighters.map((f) => (
                <li key={f.name} className="flex items-center gap-2">
                  <StatusDot status={f.status} result={f.result} />
                  <span className={cn("min-w-0 flex-1 truncate", f.result === "L" && "text-muted-foreground line-through")}>{f.name}</span>
                  <span className="num text-xs text-muted-foreground">{f.status === "final" ? `${f.result}${f.result === "W" && f.method ? " " + f.method : ""} · ${pts(f.fpts)}` : f.status === "live" ? `live ${pts(f.fpts)}` : `$${int(f.salary)}`}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 lg:hidden"><RangeBar field={m.field} paidN={m.paidN} p10={m.p10} p50={m.p50} p90={m.p90} rank={m.rank} /></div>
            <p className="num mt-1 text-xs text-muted-foreground">Likely finish {ord(m.p10)}–{ord(m.p90)}, median {ord(m.p50)}</p>
          </div>
          <div className="space-y-1 text-sm">
            <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Points needed</h4>
            <p>{m.needNow === 0 ? <span className="text-success">In the cash now</span> : <><span className="num font-medium">+{pts(m.needNow)}</span> to today’s cash line</>}</p>
            <p className="text-muted-foreground"><span className="num">+{pts(m.needCash)}</span> to projected cash line · <span className="num">+{pts(m.needWin)}</span> to win</p>
            <p className="text-muted-foreground">Fighters left: ~<span className="num">{pts(m.remMean, 0)}</span> expected, ~<span className="num">{pts(m.remCeil, 0)}</span> ceiling</p>
            {m.remaining > 0 && <p className={cn("font-medium", verdict.c)}>{verdict.t}</p>}
            {m.fighters.filter((f) => f.status !== "final").sort((a, b) => b.p90 - a.p90).map((f) => (
              <p key={f.name} className="text-xs text-muted-foreground">{last(f.name)}: win {pct(f.pWin, 0)}, ~{pts(f.mean - f.fpts, 0)} more, ceiling ~{pts(f.p90 - f.fpts, 0)}</p>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Outlook</h4>
            <p>Win <span className="num">{pct(m.win)}</span> · Top 10 <span className="num">{pct(m.top10)}</span></p>
            <p>Winning now <span className="num">{money(m.nowPrize)}</span> · expected <span className="num">{money(m.ev)}</span></p>
            {m.allWin && <p><span className="text-success">All {m.remaining} left win:</span> <span className="num">{pts(m.allWin.pts, 0)}</span> pts, median <span className="num">{ord(m.allWin.medRank)}</span>, cash <span className="num">{pct(m.allWin.cash, 0)}</span></p>}
            {m.allLose && <p><span className="text-destructive">All {m.remaining} left lose:</span> median <span className="num">{ord(m.allLose.medRank)}</span>, cash <span className="num">{pct(m.allLose.cash, 0)}</span></p>}
            <p className="text-muted-foreground">{m.dupes ? `${m.dupes} exact ${m.dupes === 1 ? "copy" : "copies"} — a win pays ${money(m.firstPrize / (m.dupes + 1))} each` : "No exact copies"} · avg ownership {pct(m.avgOwn, 0)} · more unique than {pct(m.unique, 0)} of the field</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-1">
            {[["Best case", m.best], ["Worst case", m.worst]].map(([t, c]) => {
              const cc = c as MyLineup["best"];
              return (
                <div key={t as string}>
                  <h4 className="text-xs font-medium text-muted-foreground">{t as string}</h4>
                  <p className="num font-semibold">{ord(cc.rank)} <span className="font-normal text-muted-foreground">· {pts(cc.pts)} pts</span></p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {cc.path.map((p) => { const w = own.has(p.w), l = own.has(p.l); return <li key={p.w + p.l} className={cn((w || l) && "font-medium text-foreground")}>{last(p.w)} over {last(p.l)} · {p.m}{p.m === "DEC" ? "" : ` R${p.r}`}{w ? " ✓" : l ? " ✗" : ""}</li>; })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
