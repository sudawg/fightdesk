import { useEffect, useRef, useState, type ComponentType } from "react";
import { Activity, Bell, FileUp, LayoutList, ListOrdered, Moon, MoreHorizontal, Sparkles, Sun, Swords, Target, Trophy, Users } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { StoreProvider, useStore } from "@/lib/store";
import { clock, last, money } from "@/lib/format";
import { KpiStrip } from "@/views/shared";
import { Board } from "@/views/Board";
import { Lineups } from "@/views/Lineups";
import { Sweat } from "@/views/Sweat";
import { WhatIf } from "@/views/WhatIf";
import { Fights, Root } from "@/views/Fights";
import { Alerts, Contests } from "@/views/Contests";
import { Import } from "@/views/Import";

type ViewId = "sweat" | "board" | "lineups" | "whatif" | "root" | "fights" | "contests" | "alerts" | "import";
const VIEWS: { id: ViewId; label: string; icon: ComponentType<{ className?: string }>; kpis?: boolean }[] = [
  { id: "sweat", label: "Sweat", icon: Activity },
  { id: "board", label: "Leaderboard", icon: ListOrdered, kpis: true },
  { id: "lineups", label: "My lineups", icon: LayoutList, kpis: true },
  { id: "whatif", label: "What if", icon: Sparkles },
  { id: "root", label: "Root for", icon: Target },
  { id: "fights", label: "Fights", icon: Swords },
  { id: "contests", label: "Contests", icon: Trophy },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "import", label: "Import", icon: FileUp },
];
const MOBILE_MAIN: ViewId[] = ["sweat", "board", "lineups", "whatif"];

export default function App() {
  return (
    <StoreProvider>
      <Shell />
      <Toaster position="top-center" richColors closeButton />
    </StoreProvider>
  );
}

function useHashView(): [ViewId, (v: string) => void] {
  const read = (): ViewId => {
    const h = location.hash.slice(1) as ViewId;
    if (VIEWS.some((v) => v.id === h)) return h;
    return window.matchMedia("(max-width: 767px)").matches ? "sweat" : "board";
  };
  const [v, setV] = useState<ViewId>(read);
  useEffect(() => { const on = () => setV(read()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  return [v, (id: string) => { history.replaceState(null, "", "#" + id); setV(id as ViewId); window.scrollTo({ top: 0 }); }];
}

function useTheme(): [boolean, () => void] {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  return [dark, () => { const d = !dark; document.documentElement.classList.toggle("dark", d); try { localStorage.setItem("fightdesk:theme", d ? "dark" : "light"); } catch { /* ignore */ } setDark(d); }];
}

/** Pop up (and notify) when a fresh import moves a lineup across the cash line. */
function useCashAlerts() {
  const { result } = useStore();
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!result) return;
    const now = result.alerts.filter((a) => a.kind === "in" || a.kind === "out");
    if (seen.current) {
      now.filter((a) => !seen.current!.has(a.text)).slice(0, 3).forEach((a) => {
        (a.kind === "in" ? toast.success : toast.error)(a.text);
        try { if ("Notification" in window && Notification.permission === "granted") new Notification("Fightdesk", { body: a.text, icon: "/icon-192.png" }); } catch { /* ignore */ }
      });
    }
    seen.current = new Set(now.map((a) => a.text));
  }, [result]);
}

function Shell() {
  const { data, result, running, contestId, setContestId } = useStore();
  const [view, go] = useHashView();
  const [dark, toggleDark] = useTheme();
  const [more, setMore] = useState(false);
  useCashAlerts();
  const meta = VIEWS.find((v) => v.id === view)!;
  const live = Object.entries(data.bouts).find(([, b]) => b.status === "live");
  const liveF = live ? data.card.filter((c) => c.bout === Number(live[0])) : [];
  const rootLive = result?.rooting.find((r) => r.contestId === "all" && r.live);
  const next = result?.rooting.filter((r) => r.contestId === "all" && !r.live).sort((a, b) => b.bout - a.bout)[0];
  const alertsN = result?.alerts.filter((a) => a.kind === "in" || a.kind === "out" || a.kind === "close").length ?? 0;

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">Skip to content</a>
      <header className="pt-safe sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-background"><Users className="h-4 w-4" /></span>
            <span className="hidden font-semibold tracking-tight sm:inline">Fightdesk</span>
          </div>
          {data.contests.length > 0 && (
            <label className="min-w-0 flex-1 sm:flex-none">
              <span className="sr-only">Contest</span>
              <select value={contestId} onChange={(e) => setContestId(e.target.value)} className="h-9 w-full max-w-[16rem] truncate rounded-md border bg-background px-2.5 text-sm font-medium">
                {data.contests.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <div className="ml-auto flex items-center gap-1">
            {data.demo && <span className="hidden rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning sm:inline">Demo data</span>}
            <span className={cn("h-1.5 w-1.5 rounded-full", running ? "animate-pulse bg-warning" : "bg-success")} title={running ? "Simulating…" : `Up to date · ${result?.N.toLocaleString() ?? 0} simulations`} aria-hidden />
            <span className="sr-only" aria-live="polite">{running ? "Updating simulations" : "Simulations up to date"}</span>
            <button type="button" onClick={toggleDark} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="press hit-sm grid h-9 w-9 place-items-center rounded-md hover:bg-muted">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          </div>
        </div>
        {(live || next) && (
          <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto whitespace-nowrap px-4 pb-2 text-xs no-scrollbar">
            {live && liveF.length === 2 && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-brand"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />LIVE {clock(live[1].elapsed ?? 0)} <span className="font-medium text-foreground">{last(liveF[0].name)} vs {last(liveF[1].name)}</span></span>
            )}
            {rootLive && <span className="text-success">root for <b>{last(rootLive.rootFor)}</b> · {money(rootLive.swing)} swing</span>}
            {next && <span className="text-muted-foreground">Next: {last(next.a)} vs {last(next.b)} → <b className="text-foreground">{last(next.rootFor)}</b></span>}
          </div>
        )}
        <nav aria-label="Views" className="mx-auto hidden max-w-6xl px-4 pb-2 md:block">
          <div className="inline-flex rounded-lg bg-muted p-0.5">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" onClick={() => go(v.id)} aria-current={view === v.id ? "page" : undefined} className={cn("press relative rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground", view === v.id && "bg-background text-foreground shadow-sm")}>
                {v.label}{v.id === "alerts" && alertsN > 0 && <span className="num ml-1 rounded-full bg-brand px-1.5 text-[10px] text-brand-foreground">{alertsN}</span>}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-6xl space-y-4 px-4 pb-28 pt-4 md:pb-10">
        <h1 className="text-lg font-semibold tracking-tight md:sr-only">{meta.label}</h1>
        {!result ? <Loading /> : !data.contests.length && view !== "import" && view !== "fights" ? (
          <div className="rounded-lg border border-dashed px-5 py-12 text-center">
            <p className="font-medium">No contests yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Import your DraftKings standings export (and DKEntries.csv) to start tracking — or load the demo to look around.</p>
            <button type="button" onClick={() => go("import")} className="press mt-4 min-h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Import files</button>
          </div>
        ) : (
          <div key={view} className="stagger space-y-4">
            {meta.kpis && <KpiStrip />}
            {view === "sweat" && <Sweat go={go} />}
            {view === "board" && <Board />}
            {view === "lineups" && <Lineups />}
            {view === "whatif" && <WhatIf />}
            {view === "root" && <Root />}
            {view === "fights" && <Fights />}
            {view === "contests" && <Contests go={go} />}
            {view === "alerts" && <Alerts />}
            {view === "import" && <Import />}
          </div>
        )}
      </main>

      {/* phone bottom bar */}
      <nav aria-label="Views" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_MAIN.map((id) => {
            const v = VIEWS.find((x) => x.id === id)!; const I = v.icon;
            return (
              <button key={id} type="button" onClick={() => go(id)} aria-current={view === id ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground", view === id && "text-foreground")}>
                <I className="h-5 w-5" />{v.label.replace("Leaderboard", "Board").replace("My lineups", "Lineups")}
              </button>
            );
          })}
          <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground", !MOBILE_MAIN.includes(view) && "text-foreground")}>
            <MoreHorizontal className="h-5 w-5" />More{alertsN > 0 && <span className="absolute right-[28%] top-2 h-2 w-2 rounded-full bg-brand" />}
          </button>
        </div>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-xl pb-safe">
          <SheetHeader className="text-left"><SheetTitle>More</SheetTitle></SheetHeader>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {VIEWS.filter((v) => !MOBILE_MAIN.includes(v.id)).map((v) => { const I = v.icon; return (
              <li key={v.id}><button type="button" onClick={() => { setMore(false); go(v.id); }} className={cn("flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium hover:bg-muted", view === v.id && "border-foreground")}><I className="h-5 w-5 text-muted-foreground" />{v.label}{v.id === "alerts" && alertsN > 0 && <span className="num ml-auto rounded-full bg-brand px-1.5 text-[10px] text-brand-foreground">{alertsN}</span>}</button></li>
            ); })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Running simulations">
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
