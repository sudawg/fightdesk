import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Panel, Seg, StatusDot } from "@/components/bits";
import { cn } from "@/lib/utils";
import { int, money, ord, pct, pts } from "@/lib/format";
import { norm } from "@/lib/parse";
import type { SimEntry, Threat } from "@/lib/sim";
import { inC, useView } from "./shared";

type Filter = "all" | "mine" | "near" | "paid" | "threats";
type SortKey = "rank" | "points" | "pmr" | "proj" | "win" | "cash" | "ev" | "dupes" | "shared";

export function Board() {
  const { r, sum, cid, data } = useView();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "rank", dir: 1 });
  const [limit, setLimit] = useState(100);
  const [sel, setSel] = useState<string | null>(null);
  const [threatsOpen, setThreatsOpen] = useState(true);

  const rows = useMemo(() => inC(r?.board, cid), [r, cid]);
  const threats = useMemo(() => inC(r?.threats, cid), [r, cid]);
  const paidN = sum?.paidN ?? 0;
  const view = useMemo(() => {
    const myRanks = rows.filter((x) => x.mine).map((x) => x.rank);
    const tset = new Set(threats.map((t) => t.entryName));
    const qq = q.trim().toLowerCase();
    return rows
      .filter((x) => {
        if (filter === "mine" && !x.mine) return false;
        if (filter === "near" && !myRanks.some((k) => Math.abs(k - x.rank) <= 8)) return false;
        if (filter === "paid" && x.rank > paidN) return false;
        if (filter === "threats" && !(x.mine || tset.has(x.entryName))) return false;
        if (qq && !(x.entryName.toLowerCase().includes(qq) || x.lineup.some((n) => n.toLowerCase().includes(qq)))) return false;
        return true;
      })
      .sort((a, b) => ((a[sort.k] as number) - (b[sort.k] as number)) * sort.dir || a.rank - b.rank);
  }, [rows, threats, filter, q, sort, paidN]);
  const selected = rows.find((x) => x.entryName === sel) ?? null;

  if (!r || !sum) return null;
  const head = (k: SortKey, label: string, cls = "") => (
    <th scope="col" className={cn("px-3 py-2 text-right text-xs font-medium text-muted-foreground", cls)} aria-sort={sort.k === k ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-0.5 hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : k === "rank" ? 1 : -1 }))}>
        {label}{sort.k === k && <span aria-hidden>{sort.dir > 0 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <Panel>
        <button type="button" onClick={() => setThreatsOpen((o) => !o)} aria-expanded={threatsOpen} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !threatsOpen && "-rotate-90")} />
          <span className="font-semibold">Biggest threats</span>
          <span className="hidden truncate text-sm text-muted-foreground sm:inline">— entries that cost you most when they finish top 10</span>
        </button>
        {threatsOpen && <ThreatList threats={threats} onPick={setSel} />}
      </Panel>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Seg<Filter> label="Filter entries" value={filter} onChange={(v) => { setFilter(v); setLimit(100); }} options={[
          { v: "all", label: "All" }, { v: "mine", label: "Mine" }, { v: "near", label: "Around me" }, { v: "paid", label: "In the money" }, { v: "threats", label: "Threats" },
        ]} />
        <label className="relative block sm:w-64">
          <span className="sr-only">Search entries or fighters</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entry or fighter" className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground" />
        </label>
      </div>

      <Panel className="overflow-hidden">
        {/* phone: compact list */}
        <ul className="divide-y md:hidden">
          {view.slice(0, limit).map((x) => (
            <li key={x.entryId}>
              <button type="button" onClick={() => setSel(x.entryName)} className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-muted", x.mine && "shadow-[inset_3px_0_0_hsl(var(--brand))]")}>
                <span className={cn("num w-12 shrink-0 text-sm font-semibold", x.rank <= paidN && "text-success")}>{ord(x.rank)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">{x.entryName}{x.mine && <YouTag />}</span>
                  <span className="num block text-xs text-muted-foreground">{pts(x.points)} pts · {x.pmr} PMR · proj {pts(x.proj, 0)}</span>
                </span>
                <span className="text-right">
                  <span className="num block text-sm font-medium">{pct(x.cash, 0)}</span>
                  <span className="block text-[11px] text-muted-foreground">cash</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {/* tablet and up: table */}
        <div className="hidden max-h-[calc(100dvh-16rem)] overflow-auto md:block">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_hsl(var(--border))]">
              <tr>
                {head("rank", "Rank")}
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Entry</th>
                {head("points", "Pts")}{head("pmr", "PMR")}{head("proj", "Proj")}{head("win", "Win")}{head("cash", "Cash")}
                {head("ev", "Exp. $", "hidden lg:table-cell")}{head("dupes", "Dupes", "hidden lg:table-cell")}{head("shared", "Shared", "hidden xl:table-cell")}
              </tr>
            </thead>
            <tbody>
              {view.slice(0, limit).map((x) => (
                <tr key={x.entryId} onClick={() => setSel(x.entryName)} className={cn("cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50", sel === x.entryName && "bg-muted", x.mine && "font-medium shadow-[inset_2px_0_0_hsl(var(--brand))]")}>
                  <td className={cn("num px-3 py-2 text-right text-xs", x.rank <= paidN && "font-semibold text-success")}>{ord(x.rank)}</td>
                  <td className="max-w-[18rem] truncate px-3 py-2"><span className="inline-flex items-center gap-1.5">{x.entryName}{x.mine && <YouTag />}</span></td>
                  <td className="num px-3 py-2 text-right text-xs">{pts(x.points)}</td>
                  <td className="num px-3 py-2 text-right text-xs">{x.pmr}</td>
                  <td className="num px-3 py-2 text-right text-xs">{pts(x.proj)}</td>
                  <td className="num px-3 py-2 text-right text-xs">{pct(x.win)}</td>
                  <td className="num px-3 py-2 text-right text-xs">{pct(x.cash)}</td>
                  <td className="num hidden px-3 py-2 text-right text-xs lg:table-cell">{money(x.ev)}</td>
                  <td className="num hidden px-3 py-2 text-right text-xs lg:table-cell">{x.dupes}</td>
                  <td className="num hidden px-3 py-2 text-right text-xs xl:table-cell">{x.shared}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
          <span>{int(Math.min(limit, view.length))} of {int(view.length)} entries</span>
          {view.length > limit && <button type="button" className="press hit min-h-8 rounded-md border px-3 font-medium text-foreground hover:bg-muted" onClick={() => setLimit((l) => l + 200)}>Show more</button>}
        </div>
      </Panel>
      <p className="text-xs text-muted-foreground">Win, cash and expected $ come from {int(r.N)} simulations of every fight left. Dupes are other entries with your exact lineup; Shared is the most fighters an entry has in common with one of yours.</p>

      <EntrySheet entry={selected} threat={threats.find((t) => t.entryName === sel) ?? null} onClose={() => setSel(null)} paidN={paidN} fpts={data.fpts} />
    </div>
  );
}

function YouTag() {
  return <span className="rounded-full bg-foreground px-1.5 py-px text-[10px] font-medium leading-4 text-background">you</span>;
}

function ThreatList({ threats, onPick }: { threats: Threat[]; onPick: (n: string) => void }) {
  if (!threats.length) return <p className="px-4 pb-4 text-sm text-muted-foreground">No entry currently costs your lineups much when it finishes top 10.</p>;
  const max = Math.max(...threats.map((t) => t.threat), 0.01);
  return (
    <ol className="divide-y border-t">
      {threats.map((t, i) => (
        <li key={t.entryName}>
          <button type="button" onClick={() => onPick(t.entryName)} className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-muted/50 md:grid-cols-[1.25rem_minmax(0,1.4fr)_4rem_4rem_5rem_5.5rem_minmax(0,1.2fr)]">
            <span className="num text-xs text-muted-foreground">{i + 1}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{t.entryName}</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-destructive/70" style={{ width: `${(t.threat / max) * 100}%` }} /></span>
            </span>
            <span className="num text-right text-sm font-semibold text-destructive md:order-5">−{money(t.cost)}</span>
            <span className="num hidden text-right text-xs md:block">{ord(t.rank)}</span>
            <span className="num hidden text-right text-xs md:block">{pct(t.top10, 0)}</span>
            <span className="num hidden text-right text-xs md:block">{pct(t.ahead, 0)} ahead</span>
            <span className="col-span-2 col-start-2 flex flex-wrap gap-1 md:order-6 md:col-span-1 md:col-start-auto">
              <span className="num mr-1 text-xs text-muted-foreground md:hidden">{ord(t.rank)} · top 10 {pct(t.top10, 0)} · ahead {pct(t.ahead, 0)}</span>
              {t.fades.map((f) => <span key={f} className="rounded-full border px-1.5 text-[11px] leading-5">{f.split(" ").slice(-1)[0]}</span>)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function EntrySheet({ entry, threat, onClose, paidN, fpts }: { entry: SimEntry | null; threat: Threat | null; onClose: () => void; paidN: number; fpts: Record<string, number> }) {
  const { data, r } = useView();
  const card = new Map(data.card.map((c) => [norm(c.name), c]));
  return (
    <Sheet open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl sm:mx-auto sm:max-w-xl">
        {entry && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center gap-2">{entry.entryName}</SheetTitle>
              <SheetDescription className="num">{ord(entry.rank)}{entry.rank <= paidN ? " · in the money" : ""} · {pts(entry.points)} pts · {entry.pmr} PMR</SheetDescription>
            </SheetHeader>
            <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border text-center [&>div]:bg-card [&>div]:py-2.5">
              <div><dt className="text-[11px] text-muted-foreground">Win</dt><dd className="num font-semibold">{pct(entry.win)}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Cash</dt><dd className="num font-semibold">{pct(entry.cash)}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Expected</dt><dd className="num font-semibold">{money(entry.ev)}</dd></div>
            </dl>
            {threat && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Threat: when this entry finishes top 10, your lineups win {money(threat.cost)} less on average.</p>}
            {entry.dupes > 0 && <p className="mt-3 text-sm text-muted-foreground">{entry.dupes} other {entry.dupes === 1 ? "entry has" : "entries have"} this exact lineup.</p>}
            <h3 className="mt-5 text-xs font-medium text-muted-foreground">Lineup</h3>
            <ul className="mt-1 divide-y">
              {entry.lineup.map((n) => {
                const c = card.get(norm(n)); const b = c ? data.bouts[c.bout] : undefined;
                const res = b?.status === "final" ? (b.winner && norm(b.winner) === norm(n) ? "W" : "L") : "";
                const st = r?.fighterStats[norm(n)];
                return (
                  <li key={n} className="flex items-center gap-2.5 py-2 text-sm">
                    <StatusDot status={b?.status ?? "final"} result={res} />
                    <span className={cn("min-w-0 flex-1 truncate", res === "L" && "text-muted-foreground line-through")}>{n}</span>
                    <span className="num text-xs text-muted-foreground">{b?.status === "upcoming" ? (st ? `~${pts(st.mean, 0)} proj` : "upcoming") : `${pts(fpts[norm(n)] ?? 0)} pts`}</span>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={onClose} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border text-sm font-medium hover:bg-muted"><X className="h-4 w-4" />Close</button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
