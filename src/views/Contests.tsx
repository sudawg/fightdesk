import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Panel, Seg } from "@/components/bits";
import { cn } from "@/lib/utils";
import { int, money, ord, pct, pts, signedMoney } from "@/lib/format";
import { useView } from "./shared";

export function Contests({ go }: { go: (v: string) => void }) {
  const { r, setContestId } = useView();
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!r) return null;
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4 [&>div]:bg-card [&>div]:p-4">
        <div><div className="text-xs text-muted-foreground">Entries</div><div className="num text-2xl font-semibold">{r.all.entries}</div></div>
        <div><div className="text-xs text-muted-foreground">Any cashes</div><div className="num text-2xl font-semibold">{pct(r.all.anyCash)}</div></div>
        <div><div className="text-xs text-muted-foreground">Winning now</div><div className="num text-2xl font-semibold">{money(r.all.nowWin)}</div></div>
        <div><div className="text-xs text-muted-foreground">Expected vs fees</div><div className={cn("num text-2xl font-semibold", r.all.net >= 0 ? "text-success" : "text-destructive")}>{signedMoney(r.all.net)}</div></div>
      </div>
      <Panel className="divide-y overflow-hidden">
        {r.summaries.map((s) => {
          const lus = r.mine.filter((m) => m.contestId === s.contestId);
          const isOpen = open.has(s.contestId);
          return (
            <div key={s.contestId}>
              <button type="button" aria-expanded={isOpen} onClick={() => toggle(s.contestId)} className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 sm:grid-cols-[1rem_minmax(0,1fr)_6rem_6rem_6rem]">
                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span><span className="num block text-xs text-muted-foreground">{s.entries} lineups · best {ord(s.bestRank)} of {int(s.field)} · {money(s.fee)}</span></span>
                <span className="text-right"><span className="num block text-sm font-semibold">{money(s.ev)}</span><span className="block text-[11px] text-muted-foreground">expected</span></span>
                <span className="hidden text-right sm:block"><span className={cn("num block text-sm", s.nowWin > 0 && "text-success")}>{money(s.nowWin)}</span><span className="block text-[11px] text-muted-foreground">now</span></span>
                <span className="hidden text-right sm:block"><span className="num block text-sm">{pct(s.anyCash, 0)}</span><span className="block text-[11px] text-muted-foreground">any cash</span></span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto bg-muted/30 px-4 pb-4">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead><tr className="text-xs text-muted-foreground"><th className="py-2 text-left font-medium">Lineup</th><th className="py-2 text-right font-medium">Rank</th><th className="py-2 text-right font-medium">Pts</th><th className="py-2 text-right font-medium">Winning now</th><th className="py-2 text-right font-medium">Expected</th><th className="py-2 text-right font-medium">Cash</th><th className="py-2 text-right font-medium">vs fee</th></tr></thead>
                    <tbody className="divide-y divide-border/60">
                      {lus.map((m) => (
                        <tr key={m.entryId}>
                          <td className="py-2">{m.label}</td>
                          <td className={cn("num py-2 text-right text-xs", m.rank <= m.paidN && "font-semibold text-success")}>{ord(m.rank)}</td>
                          <td className="num py-2 text-right text-xs">{pts(m.points)}</td>
                          <td className={cn("num py-2 text-right text-xs", m.nowPrize > 0 ? "text-success" : "text-muted-foreground")}>{money(m.nowPrize)}</td>
                          <td className="num py-2 text-right text-xs font-medium">{money(m.ev)}</td>
                          <td className="num py-2 text-right text-xs">{pct(m.cash, 0)}</td>
                          <td className={cn("num py-2 text-right text-xs", m.ev - m.fee >= 0 ? "text-success" : "text-destructive")}>{signedMoney(m.ev - m.fee)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" className="press hit-sm mt-3 min-h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted" onClick={() => { setContestId(s.contestId); go("board"); }}>Open leaderboard</button>
                </div>
              )}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

export function Alerts() {
  const { r } = useView();
  const [f, setF] = useState<"all" | "cash" | "fights" | "moves">("all");
  if (!r) return null;
  const kinds = { all: null, cash: ["in", "out", "close"], fights: ["live", "next", "big"], moves: ["up", "down"] }[f];
  const rows = r.alerts.filter((a) => !kinds || kinds.includes(a.kind));
  const icon: Record<string, [string, string]> = { in: ["▲", "text-success"], out: ["▼", "text-destructive"], up: ["↑", "text-success"], down: ["↓", "text-destructive"], live: ["●", "text-brand"], next: ["→", "text-muted-foreground"], big: ["★", "text-warning"], close: ["◎", "text-warning"] };
  return (
    <div className="space-y-4">
      <Seg<"all" | "cash" | "fights" | "moves"> label="Filter alerts" value={f} onChange={setF} options={[{ v: "all", label: "All" }, { v: "cash", label: "Cash line" }, { v: "fights", label: "Fights" }, { v: "moves", label: "Big moves" }]} />
      <Panel className="divide-y">
        {rows.length ? rows.map((a, i) => (
          <div key={i} className={cn("flex gap-3 px-4 py-2.5 text-sm", ["in", "out", "live"].includes(a.kind) && "font-medium")}>
            <span className={cn("w-4 shrink-0 text-center", icon[a.kind][1])} aria-hidden>{icon[a.kind][0]}</span>
            <span>{a.text}</span>
          </div>
        )) : <p className="px-4 py-6 text-sm text-muted-foreground">Nothing here yet.</p>}
      </Panel>
      <p className="text-xs text-muted-foreground">When a new export moves a lineup into or out of the cash you’ll also get a pop-up — and a phone notification if you turn them on in Import → Settings.</p>
    </div>
  );
}
