import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { toast } from "sonner";
import { applyOdds, fetchOdds } from "./odds";
import { getCode, pull, push, setCode, syncMessage, type SyncState } from "./sync";
import type { AppData } from "./types";

type Ref = MutableRefObject<AppData>;

/** Keeps this device and the server snapshot in step. Newest save wins. */
export function useSync(data: AppData, dataRef: Ref, adopt: (d: AppData) => void) {
  const [code, setCodeState] = useState(getCode);
  const [state, setState] = useState<SyncState>(() => ({ status: getCode() ? "idle" : "off" }));
  const lastSynced = useRef(0);
  const busy = useRef(false);

  const reconcile = useCallback(async (c: string, announce = false) => {
    if (!c || busy.current) return;
    busy.current = true; setState((s) => ({ ...s, status: "syncing" }));
    try {
      const local = dataRef.current;
      const remote = await pull(c);
      if (remote && (local.demo || remote.savedAt > local.savedAt)) {
        lastSynced.current = remote.savedAt;
        adopt({ ...remote.data, demo: false });
        toast.success("Synced from your other device");
      } else if (!local.demo && (!remote || local.savedAt > remote.savedAt)) {
        await push(c, local); lastSynced.current = local.savedAt;
        if (announce) toast.success("Sync is on — this device’s data is saved");
      } else lastSynced.current = local.savedAt;
      setState({ status: "idle", at: Date.now() });
    } catch (e) {
      const unavailable = (e as { kind?: string }).kind === "unavailable";
      setState({ status: unavailable ? "unavailable" : "error", msg: syncMessage(e), at: Date.now() });
    } finally { busy.current = false; }
  }, [adopt, dataRef]);

  // pull on open, when you come back to the tab, and every 90 s while it's visible
  useEffect(() => {
    if (!code) return;
    reconcile(code);
    const onVis = () => { if (document.visibilityState === "visible") reconcile(code); };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => { if (document.visibilityState === "visible") reconcile(code); }, 90_000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(t); };
  }, [code, reconcile]);

  // push shortly after each local change
  useEffect(() => {
    if (!code || data.demo || data.savedAt <= lastSynced.current) return;
    const t = setTimeout(() => reconcile(code), 2500);
    return () => clearTimeout(t);
  }, [data, code, reconcile]);

  const connect = useCallback((c: string) => { const v = c.trim(); setCode(v); setCodeState(v); setState({ status: v ? "idle" : "off" }); if (v) reconcile(v, true); }, [reconcile]);
  return { code, state, connect, syncNow: () => reconcile(code, true) };
}

export interface OddsState { status: "idle" | "loading" | "unavailable" | "error"; at?: number; remaining?: string | null; msg?: string; matched?: number }

/** Pulls live fight odds into the card every 10 minutes while the app is open. */
export function useOdds(dataRef: Ref, update: (fn: (d: AppData) => AppData) => void) {
  const [state, setState] = useState<OddsState>({ status: "idle" });
  const off = useRef(false);

  const refresh = useCallback(async (manual = false) => {
    if (off.current && !manual) return;
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const feed = await fetchOdds();
      if (feed === "unavailable") { off.current = true; setState({ status: "unavailable" }); if (manual) toast("The live-odds feed isn’t set up on this site yet."); return; }
      off.current = false;
      const { changed } = applyOdds(dataRef.current, feed);
      if (changed.length) update((d) => applyOdds(d, feed).data);
      setState({ status: "idle", at: feed.fetchedAt, remaining: feed.remaining, matched: feed.fights.length });
      if (manual) toast.success(changed.length ? `Odds updated: ${changed.slice(0, 3).join(", ")}${changed.length > 3 ? ` +${changed.length - 3} more` : ""}` : "Odds are already current");
    } catch (e) { setState({ status: "error", msg: e instanceof Error ? e.message : "Couldn’t reach the odds feed." }); if (manual) toast.error("Couldn’t refresh the odds."); }
  }, [dataRef, update]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 600_000);
    return () => clearInterval(t);
  }, [refresh]);
  return { state, refresh: () => refresh(true) };
}
