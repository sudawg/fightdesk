import type { AppData } from "./types";

const CODE_KEY = "fightdesk:sync-code";
export const getCode = () => { try { return localStorage.getItem(CODE_KEY) ?? ""; } catch { return ""; } };
export const setCode = (c: string) => { try { if (c) localStorage.setItem(CODE_KEY, c); else localStorage.removeItem(CODE_KEY); } catch { /* ignore */ } };

export type SyncState = { status: "off" | "idle" | "syncing" | "error" | "unavailable"; at?: number; msg?: string };
export interface Snapshot { savedAt: number; data: AppData }

async function gz(text: string): Promise<Blob> {
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
}
async function gunzip(buf: ArrayBuffer): Promise<string> {
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

export class SyncError extends Error {
  kind: "unavailable" | "bad-code" | "too-large" | "network" | "storage";
  constructor(kind: SyncError["kind"]) { super(kind); this.kind = kind; }
}

async function call(code: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try { res = await fetch("/api/sync", { ...init, headers: { ...(init.headers ?? {}), "x-sync-code": code }, cache: "no-store" }); }
  catch { throw new SyncError("network"); }
  // a static host (or `vite dev`) answers /api/* with the app's HTML or a 404
  if (res.status === 503 || (res.status === 404 && !(res.headers.get("content-type") ?? "").includes("json")) || (res.ok && (res.headers.get("content-type") ?? "").includes("html"))) throw new SyncError("unavailable");
  if (res.status === 401) throw new SyncError("bad-code");
  if (res.status === 413) throw new SyncError("too-large");
  return res;
}

/** The saved snapshot, or null when nothing has been pushed yet. */
export async function pull(code: string): Promise<Snapshot | null> {
  const res = await call(code, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new SyncError("storage");
  return JSON.parse(await gunzip(await res.arrayBuffer())) as Snapshot;
}

export async function push(code: string, data: AppData): Promise<void> {
  const body = await gz(JSON.stringify({ savedAt: data.savedAt, data } satisfies Snapshot));
  const res = await call(code, { method: "PUT", body, headers: { "content-type": "application/octet-stream" } });
  if (!res.ok) throw new SyncError("storage");
}

export const syncMessage = (e: unknown) => {
  const k = e instanceof SyncError ? e.kind : "network";
  return { unavailable: "Sync isn’t set up on this site yet.", "bad-code": "That sync code doesn’t match the one set on the server.", "too-large": "Your data is too big to sync.", network: "No connection — will retry.", storage: "Storage hiccup — will retry." }[k];
};
