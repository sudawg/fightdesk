import { Panel, Seg, StatusDot } from "@/components/bits";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { clock, int, last, money, pct, pts } from "@/lib/format";
import { norm } from "@/lib/parse";
import type { BoutState, BoutStatus, Method } from "@/lib/types";
import { inC, useView } from "./shared";

export function Root() {
  const { r, cid, sum } = useView();
  if (!r) return null;
  const [scope, rows] = [cid, inC(r.rooting, cid)];
  const all = inC(r.rooting, "all");
  if (!rows.length) return <p className="text-sm text-muted-foreground">Every fight is over.</p>;
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-muted-foreground">For each fight left: who to root for in {sum?.name ?? scope}, how much your expected payout swings on it, and the chance at least one of your lineups cashes with each winner.</p>
      <Panel className="divide-y">
        {rows.map((x) => {
          const allRow = all.find((a) => a.bout === x.bout);
          const max = Math.max(x.cashA, x.cashB, 0.01);
          return (
            <details key={x.bout} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">{x.live && <span className="rounded-full bg-brand/10 px-1.5 text-[11px] font-semibold text-brand">LIVE</span>}{last(x.a)} vs {last(x.b)}</span>
                  <span className="text-xs text-muted-foreground">Root for <span className="font-semibold text-success">{x.rootFor}</span></span>
                </span>
                <span className="text-right"><span className="num block text-sm font-semibold">{money(x.swing)}</span><span className="block text-[11px] text-muted-foreground">swing</span></span>
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {[[x.a, x.cashA, x.evA], [x.b, x.cashB, x.evB]].map(([nm, c, ev]) => (
                  <div key={nm as string}>
                    <div className="flex justify-between text-xs"><span className={cn(nm === x.rootFor && "font-semibold")}>{last(nm as string)} wins</span><span className="num text-muted-foreground">{pct(c as number)} cash · {money(ev as number)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={cn("h-full rounded-full", nm === x.rootFor ? "bg-foreground" : "bg-muted-foreground/40")} style={{ width: `${((c as number) / max) * 100}%` }} /></div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5">
                  {x.byLineup.filter((l) => Math.abs(l.a - l.b) >= 0.005).map((l) => <span key={l.label} className="rounded-full border px-2 text-[11px] leading-5 text-muted-foreground">{l.label}: {last(l.a > l.b ? x.a : x.b)} ({pct(Math.max(l.a, l.b), 0)} vs {pct(Math.min(l.a, l.b), 0)})</span>)}
                </div>
                {allRow && r.summaries.length > 1 && <p className="text-xs text-muted-foreground">Across all contests: root for {allRow.rootFor}, {money(allRow.swing)} swing.</p>}
              </div>
            </details>
          );
        })}
      </Panel>
    </div>
  );
}

/** Fight status controls: this is how the app knows which fights are over during the event. */
export function Fights() {
  const { data, update, r } = useView();
  const bouts = [...new Set(data.card.map((c) => c.bout))].sort((a, b) => a - b);
  const setBout = (b: number, patch: Partial<BoutState>) => update((d) => {
    const cur = d.bouts[b] ?? { status: "upcoming" as BoutStatus };
    const next = { ...cur, ...patch };
    if (patch.status === "final" && cur.status !== "final") next.finishedAt = Date.now();
    if (patch.status && patch.status !== "final") { delete next.winner; delete next.method; delete next.round; }
    return { ...d, bouts: { ...d.bouts, [b]: next } };
  });
  const setPts = (name: string, v: number) => update((d) => ({ ...d, fpts: { ...d.fpts, [norm(name)]: v } }));
  const myCount = (n: string) => (r?.mine ?? []).filter((m) => m.lineup.some((x) => norm(x) === norm(n))).length;
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-muted-foreground">Mark each fight live or final as the card goes — that’s how the simulation knows what’s left. Points come from your latest DraftKings export; you can nudge them here between exports. Live win chance overrides the pre-fight odds.</p>
      <Panel className="divide-y">
        {bouts.map((b) => {
          const fs = data.card.filter((c) => c.bout === b).sort((x, y) => y.winProb - x.winProb);
          const st = data.bouts[b] ?? { status: "upcoming" };
          const fav = fs[0];
          return (
            <div key={b} className="space-y-3 px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">{b === 1 ? "Main event" : b === 2 ? "Co-main" : b <= 6 ? "Main card" : "Prelim"} · {fs[0]?.rounds ?? 3} rounds{st.status === "live" ? ` · ${clock(st.elapsed ?? 0)}` : ""}</div>
                <Seg<BoutStatus> label={`Status of ${fs.map((f) => f.name).join(" vs ")}`} value={st.status} onChange={(v) => setBout(b, { status: v })} options={[{ v: "upcoming", label: "Upcoming" }, { v: "live", label: "Live" }, { v: "final", label: "Final" }]} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {fs.map((f) => {
                  const res = st.status === "final" ? (st.winner && norm(st.winner) === norm(f.name) ? "W" : st.winner ? "L" : "") : "";
                  return (
                    <div key={f.name} className="flex items-center gap-2.5 rounded-md border px-3 py-2">
                      <StatusDot status={st.status} result={res} />
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-sm font-medium", res === "L" && "text-muted-foreground line-through")}>{f.name}{myCount(f.name) > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">you ×{myCount(f.name)}</span>}</div>
                        <div className="num text-xs text-muted-foreground">{pct(f.winProb, 0)} pre-fight · ${int(f.salary)}{f.oddsSource === "estimate" ? " · est. odds" : ""}</div>
                      </div>
                      {st.status !== "upcoming" && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="sr-only">{f.name} DraftKings points</span>
                          <input type="number" inputMode="decimal" step="0.1" value={data.fpts[norm(f.name)] ?? 0} onChange={(e) => setPts(f.name, Number(e.target.value) || 0)} className="num h-8 w-16 rounded-md border bg-background px-1.5 text-right text-sm text-foreground" />
                          pts
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              {st.status === "live" && fav && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-muted-foreground">
                    <span className="flex justify-between"><span>Elapsed</span><span className="num text-foreground">{clock(st.elapsed ?? 0)}</span></span>
                    <Slider className="mt-2" min={0} max={fav.rounds * 5 - 0.25} step={0.25} value={[st.elapsed ?? 0]} onValueChange={(v) => setBout(b, { elapsed: v[0] })} aria-label="Minutes elapsed" />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    <span className="flex justify-between"><span>Live win chance · {last(fav.name)}</span><span className="num text-foreground">{pct(st.liveWinProb ?? fav.winProb, 0)}</span></span>
                    <Slider className="mt-2" min={0.02} max={0.98} step={0.01} value={[st.liveWinProb ?? fav.winProb]} onValueChange={(v) => setBout(b, { liveWinProb: v[0] })} aria-label={`Live win chance for ${fav.name}`} />
                  </label>
                </div>
              )}
              {st.status === "final" && (
                <div className="flex flex-wrap gap-2">
                  <Seg<string | null> label="Winner" value={st.winner ?? null} onChange={(v) => setBout(b, { winner: v ?? undefined })} options={[{ v: null, label: "Winner?" }, ...fs.map((f) => ({ v: f.name as string | null, label: last(f.name) }))]} />
                  <Seg<Method | null> label="Method" value={st.method ?? null} onChange={(v) => setBout(b, { method: v ?? undefined })} options={[{ v: null, label: "Method?" }, { v: "KO/TKO", label: "KO" }, { v: "SUB", label: "SUB" }, { v: "DEC", label: "DEC" }]} />
                  {st.method && st.method !== "DEC" && <Seg<number | null> label="Round" value={st.round ?? null} onChange={(v) => setBout(b, { round: v ?? undefined })} options={[1, 2, 3, ...(fav && fav.rounds === 5 ? [4, 5] : [])].map((n) => ({ v: n as number | null, label: `R${n}` }))} />}
                </div>
              )}
            </div>
          );
        })}
      </Panel>
      <p className="text-xs text-muted-foreground">{pts(data.card.length, 0)} fighters · odds looked up Nov 6; prelims marked “est. odds” are placeholders.</p>
    </div>
  );
}
