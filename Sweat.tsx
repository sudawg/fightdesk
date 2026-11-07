import { Panel } from "@/components/bits";
import { cn } from "@/lib/utils";
import { clock, int, last, money, ord, pct, pts } from "@/lib/format";
import { norm } from "@/lib/parse";
import { useView } from "./shared";

/** One-thumb view for sweating the card on a phone. */
export function Sweat({ go }: { go: (v: string) => void }) {
  const { r, data } = useView();
  if (!r) return null;
  const liveBout = Object.entries(data.bouts).find(([, b]) => b.status === "live");
  const live = liveBout ? data.card.filter((c) => c.bout === Number(liveBout[0])).sort((a, b) => b.winProb - a.winProb) : [];
  const all = r.rooting.filter((x) => x.contestId === "all");
  const focus = all.find((x) => x.live) ?? all.filter((x) => !x.live).sort((a, b) => b.bout - a.bout)[0];
  const mine = r.mine.slice().sort((a, b) => a.rank / a.field - b.rank / b.field);
  const myCount = (n: string) => r.mine.filter((m) => m.lineup.some((x) => norm(x) === norm(n))).length;
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <div className="py-2 text-center">
        <div className="num text-5xl font-semibold tracking-tight">{pct(r.all.anyCash)}</div>
        <p className="mt-1 text-sm text-muted-foreground">chance at least one of your {r.all.entries} entries cashes</p>
        <p className="num mt-0.5 text-sm"><span className={r.all.net >= 0 ? "text-success" : "text-destructive"}>{money(r.all.ev)}</span> <span className="text-muted-foreground">expected vs {money(r.all.fees)} fees · {money(r.all.nowWin)} winning now</span></p>
      </div>

      {live.length === 2 && liveBout && (
        <Panel className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-brand"><span className="h-2 w-2 animate-pulse rounded-full bg-brand" />LIVE · {clock(liveBout[1].elapsed ?? 0)}</div>
          {live.map((f) => (
            <div key={f.name} className="flex items-center justify-between py-1">
              <span className="min-w-0 truncate font-medium">{f.name}{myCount(f.name) > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">you ×{myCount(f.name)}</span>}</span>
              <span className="num text-sm">{pts(data.fpts[norm(f.name)] ?? 0)} pts</span>
            </div>
          ))}
        </Panel>
      )}

      {focus && (
        <button type="button" onClick={() => go("root")} className="block w-full rounded-lg border bg-card p-4 text-left hover:bg-muted/40">
          <div className="text-xs text-muted-foreground">{focus.live ? "Root for, right now" : "Next fight · root for"}</div>
          <div className="mt-0.5 text-2xl font-semibold tracking-tight text-success">{focus.rootFor}</div>
          <div className="num text-sm text-muted-foreground">{last(focus.a)} vs {last(focus.b)} · {money(focus.swing)} swing</div>
        </button>
      )}

      <Panel>
        <div className="flex items-center justify-between px-4 pt-3 text-xs text-muted-foreground"><span>Your entries</span><button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => go("lineups")}>Details</button></div>
        <ul className="divide-y">
          {mine.map((m) => {
            const inCash = m.rank <= m.paidN;
            return (
              <li key={m.contestId + m.entryId} className="flex items-center gap-3 px-4 py-2.5">
                <span className={cn("h-8 w-1 rounded-full", inCash ? "bg-success" : "bg-muted")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.contestName}</span>
                </span>
                <span className="text-right">
                  <span className={cn("num block text-sm font-semibold", inCash && "text-success")}>{ord(m.rank)}<span className="font-normal text-muted-foreground"> / {int(m.field)}</span></span>
                  <span className="num block text-xs text-muted-foreground">cash {pct(m.cash, 0)}{!inCash && m.needNow != null ? ` · +${pts(m.needNow, 0)}` : ""}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      {r.alerts.length > 0 && (
        <Panel className="p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>Latest alerts</span><button type="button" className="font-medium text-foreground underline-offset-2 hover:underline" onClick={() => go("alerts")}>All</button></div>
          <ul className="space-y-1.5 text-sm">{r.alerts.slice(0, 3).map((a, i) => <li key={i}>{a.text}</li>)}</ul>
        </Panel>
      )}
    </div>
  );
}
