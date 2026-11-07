import { useRef, useState } from "react";
import { Bell, Check, FileUp, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Panel, SectionHead } from "@/components/bits";
import { cn } from "@/lib/utils";
import { freshData, loadDemo } from "@/lib/store";
import { norm, parsePayouts } from "@/lib/parse";
import { int, money } from "@/lib/format";
import type { Contest } from "@/lib/types";
import { useView } from "./shared";

export function Import() {
  const { data, update, importFiles, sync, odds } = useView();
  const [code, setCodeDraft] = useState(sync.code);
  const [drag, setDrag] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const take = async (list: FileList | null) => {
    if (!list?.length) return;
    const n = await importFiles(Array.from(list));
    setNotes(n);
    toast.success(`Imported ${list.length} ${list.length === 1 ? "file" : "files"}`);
  };
  const cardSet = new Set(data.card.map((c) => norm(c.name)));
  return (
    <div className="space-y-6">
      {data.demo && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <span className="font-medium">You’re looking at demo data.</span> <span className="text-muted-foreground">Importing your first DraftKings file clears it.</span>
        </div>
      )}
      <section>
        <SectionHead title="Import DraftKings files" desc="Drop your contest standings exports (one per contest, re-import between fights for fresh points) and your lineup export, DKEntries.csv. Files stay on this device." />
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors hover:bg-muted/40", drag && "border-foreground bg-muted")}
        >
          <FileUp className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Tap to choose CSV files, or drop them here</span>
          <span className="text-xs text-muted-foreground">contest-standings-*.csv · DKEntries.csv</span>
          <input ref={input} type="file" accept=".csv,text/csv" multiple className="sr-only" onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        </label>
        {notes.length > 0 && <ul className="mt-3 space-y-1 text-sm">{notes.map((n, i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{n}</li>)}</ul>}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Where to find these on DraftKings</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Standings: on draftkings.com (desktop site) open My Contests → Live, open the contest and use the export link above the standings. It downloads a .zip — on a phone, tap it to unzip, then import the CSV inside.</li>
            <li>Lineups: Lineups → Upcoming → choose the UFC slate → export (or Edit entries → download) to get DKEntries.csv.</li>
            <li>The prize table isn’t in the export: paste it on the contest below (e.g. “1 1000”, “2-5 100”).</li>
          </ol>
        </details>
      </section>

      <section>
        <SectionHead title="Contests" desc="Each standings file becomes a contest. Name, fee and prize table fill in from your lineup export where it matches; edit anything here." />
        {data.contests.length === 0 ? <p className="text-sm text-muted-foreground">No contests yet.</p> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.contests.map((c) => <ContestCard key={c.id} c={c} cardSet={cardSet} />)}
          </div>
        )}
      </section>

      {data.entries.length > 0 && (
        <section>
          <SectionHead title="Lineup export" desc={`${data.entries.length} entries · ${data.pool.length} fighters in the pool`} />
          <Panel className="divide-y text-sm">
            {[...new Map(data.entries.map((e) => [e.contestId, e])).values()].map((e) => {
              const n = data.entries.filter((x) => x.contestId === e.contestId).length;
              const tracked = data.contests.find((c) => c.dkContestId === e.contestId);
              return <div key={e.contestId} className="flex items-center justify-between gap-3 px-4 py-2.5"><span className="min-w-0"><span className="block truncate font-medium">{e.contest}</span><span className="num block text-xs text-muted-foreground">ID {e.contestId} · {money(e.fee)} · {n} {n === 1 ? "entry" : "entries"}</span></span><span className={cn("shrink-0 text-xs", tracked ? "text-success" : "text-muted-foreground")}>{tracked ? "Tracking" : "No standings yet"}</span></div>;
            })}
          </Panel>
          {(() => {
            const missing = data.pool.filter((p) => !cardSet.has(norm(p.name))).map((p) => p.name);
            const scratched = data.pool.length ? data.card.filter((c) => !data.pool.some((p) => norm(p.name) === norm(c.name))).map((c) => c.name) : [];
            return (missing.length || scratched.length) ? <p className="mt-2 flex gap-2 text-sm text-warning"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{missing.length ? `Not on the card: ${missing.join(", ")}. ` : ""}{scratched.length ? `Not in the DraftKings pool (scratched?): ${scratched.join(", ")}.` : ""}</p> : <p className="mt-2 flex gap-2 text-sm text-success"><Check className="h-4 w-4" />Every fighter in the pool matches the card.</p>;
          })()}
        </section>
      )}

      <section>
        <SectionHead title="Settings" />
        <Panel className="divide-y text-sm">
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <span><span className="block font-medium">DraftKings username</span><span className="block text-xs text-muted-foreground">Used to find your entries in standings files</span></span>
            <input value={data.username} onChange={(e) => update((d) => ({ ...d, username: e.target.value }))} className="h-9 w-40 rounded-md border bg-background px-2.5" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </label>
          <div className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span><span className="block font-medium">Sync across devices</span><span className="block text-xs text-muted-foreground">Same code on your phone and laptop keeps contests, results and odds in step.</span></span>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); sync.connect(code); }}>
                <input value={code} onChange={(e) => setCodeDraft(e.target.value)} aria-label="Sync code" placeholder="Sync code" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="h-9 w-36 rounded-md border bg-background px-2.5" />
                <button type="submit" className="press hit-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 font-medium hover:bg-muted"><RefreshCw className="h-4 w-4" />{sync.code ? "Update" : "Connect"}</button>
              </form>
            </div>
            <p className={cn("text-xs", sync.state.status === "error" || sync.state.status === "unavailable" ? "text-warning" : "text-muted-foreground")} aria-live="polite">
              {sync.state.status === "off" ? "Off — data stays on this device." : sync.state.status === "syncing" ? "Syncing…" : sync.state.status === "idle" ? `On · last checked ${sync.state.at ? new Date(sync.state.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "just now"}` : sync.state.msg}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span><span className="block font-medium">Live odds</span><span className="block text-xs text-muted-foreground">{odds.state.status === "unavailable" ? "Feed not set up on this site." : odds.state.status === "error" ? odds.state.msg : odds.state.at ? `Updated ${new Date(odds.state.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}, refreshes every 10 min${odds.state.remaining ? ` · ${odds.state.remaining} API credits left` : ""}` : "Refreshes every 10 minutes while the app is open."}</span></span>
            <button type="button" disabled={odds.state.status === "loading"} onClick={odds.refresh} className="press hit-sm inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 font-medium hover:bg-muted disabled:opacity-50"><RefreshCw className={cn("h-4 w-4", odds.state.status === "loading" && "animate-spin")} />Refresh</button>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span><span className="block font-medium">Notifications</span><span className="block text-xs text-muted-foreground">Alert when a lineup moves into or out of the cash. On iPhone, add the app to your Home Screen first.</span></span>
            <button type="button" className="press hit-sm inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 font-medium hover:bg-muted" onClick={async () => {
              if (!("Notification" in window)) { toast.error("This browser can’t show notifications."); return; }
              const p = await Notification.requestPermission();
              if (p === "granted") toast.success("Notifications on"); else toast("Notifications not allowed");
            }}><Bell className="h-4 w-4" />Turn on</button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span><span className="block font-medium">Data</span><span className="block text-xs text-muted-foreground">Saved in this browser only.</span></span>
            <span className="flex gap-2">
              <button type="button" className="press hit-sm min-h-9 rounded-md border px-3 font-medium hover:bg-muted" onClick={() => loadDemo(data.username).then((dd) => update(() => dd))}>Load demo</button>
              <button type="button" className="press hit-sm inline-flex min-h-9 items-center gap-1.5 rounded-md border border-destructive/40 px-3 font-medium text-destructive hover:bg-destructive/10" onClick={() => { if (confirm("Clear all contests and fight results on this device?")) update((d) => freshData(d.username)); }}><Trash2 className="h-4 w-4" />Clear</button>
            </span>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function ContestCard({ c, cardSet }: { c: Contest; cardSet: Set<string> }) {
  const { data, update } = useView();
  const [payText, setPayText] = useState(c.payouts.map((p) => (p.from === p.to ? `${p.from} ${p.prize}` : `${p.from}-${p.to} ${p.prize}`)).join("\n"));
  const set = (patch: Partial<Contest>) => update((d) => ({ ...d, contests: d.contests.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }));
  const mine = c.rows.filter((r) => r.entryName.split(" (")[0].trim().toLowerCase() === data.username.toLowerCase()).length;
  const names = new Set(c.rows.flatMap((r) => r.lineup));
  const unmatched = [...names].filter((n) => !cardSet.has(norm(n)));
  const paidN = c.payouts.reduce((m, p) => Math.max(m, p.to), 0);
  const pool = c.payouts.reduce((t, p) => t + (Math.min(p.to, c.rows.length) - p.from + 1) * p.prize, 0);
  const checks: [boolean, string][] = [
    [c.rows.length > 0, `${int(c.rows.length)} entries · imported ${new Date(c.importedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`],
    [mine > 0, mine ? `${mine} yours (${data.username})` : `None of your entries found under “${data.username}”`],
    [!unmatched.length, unmatched.length ? `Not on the card: ${unmatched.slice(0, 5).join(", ")}${unmatched.length > 5 ? "…" : ""}` : `All ${names.size} fighters match the card`],
    [c.payouts.length > 0, c.payouts.length ? `Pays top ${int(paidN)} · ${money(pool)} prize pool` : "Add the prize table below"],
  ];
  const ok = checks.every(([v]) => v);
  return (
    <Panel className={cn("p-4", ok ? "shadow-[inset_3px_0_0_hsl(var(--success))]" : "shadow-[inset_3px_0_0_hsl(var(--warning))]")}>
      <div className="flex items-start justify-between gap-2">
        <input value={c.name} onChange={(e) => set({ name: e.target.value })} aria-label="Contest name" className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-semibold hover:bg-muted focus:bg-muted" />
        <button type="button" aria-label={`Remove ${c.name}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={() => update((d) => ({ ...d, contests: d.contests.filter((x) => x.id !== c.id) }))}><Trash2 className="h-4 w-4" /></button>
      </div>
      <p className="truncate px-1 text-xs text-muted-foreground">{c.fileName}{c.dkContestId ? ` · ID ${c.dkContestId}` : ""}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {checks.map(([v, t]) => <li key={t} className={cn("flex gap-2", !v && "text-warning")}>{v ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}{t}</li>)}
      </ul>
      <div className="mt-3 grid grid-cols-[6rem_1fr] gap-3">
        <label className="text-xs text-muted-foreground">Entry fee
          <input type="number" inputMode="decimal" min={0} step="0.25" value={c.fee} onChange={(e) => set({ fee: Number(e.target.value) || 0 })} className="num mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">Prize table — one line per band
          <textarea value={payText} onChange={(e) => { setPayText(e.target.value); set({ payouts: parsePayouts(e.target.value) }); }} rows={4} placeholder={"1 1000\n2 400\n3-5 150\n6-10 50"} className="num mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" />
        </label>
      </div>
    </Panel>
  );
}
