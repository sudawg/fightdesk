// Cross-device sync: one gzip'd JSON snapshot in Vercel Blob, guarded by a sync code.
// Env: SYNC_CODE (you choose it), BLOB_READ_WRITE_TOKEN (added when you create a Blob store).
import { get, put } from "@vercel/blob";
import { createHash, timingSafeEqual } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest();
const reply = (body: BodyInit | null, status = 200, type = "application/json") =>
  new Response(body, { status, headers: { "content-type": type, "cache-control": "no-store" } });

function authorised(req: Request) {
  const code = process.env.SYNC_CODE;
  const got = req.headers.get("x-sync-code");
  return !!code && !!got && timingSafeEqual(sha(code), sha(got));
}
// The file name is derived from the code, so the blob URL can't be guessed without it.
const pathname = () => `fightdesk/${sha("fightdesk:" + process.env.SYNC_CODE).toString("hex").slice(0, 32)}.bin`;

async function read() {
  // Private blobs first; fall back to a public one if the store was created as public.
  for (const access of ["private", "public"] as const) {
    try {
      const r = await get(pathname(), { access, useCache: false });
      if (r?.stream) return await new Response(r.stream).arrayBuffer();
    } catch { /* try the other access mode */ }
  }
  return null;
}

export async function GET(req: Request) {
  if (!process.env.SYNC_CODE || !process.env.BLOB_READ_WRITE_TOKEN) return reply(JSON.stringify({ error: "not-configured" }), 503);
  if (!authorised(req)) return reply(JSON.stringify({ error: "bad-code" }), 401);
  const data = await read();
  return data ? reply(data, 200, "application/octet-stream") : reply(JSON.stringify({ error: "empty" }), 404);
}

export async function PUT(req: Request) {
  if (!process.env.SYNC_CODE || !process.env.BLOB_READ_WRITE_TOKEN) return reply(JSON.stringify({ error: "not-configured" }), 503);
  if (!authorised(req)) return reply(JSON.stringify({ error: "bad-code" }), 401);
  const body = await req.arrayBuffer();
  if (!body.byteLength) return reply(JSON.stringify({ error: "empty-body" }), 400);
  if (body.byteLength > 4_200_000) return reply(JSON.stringify({ error: "too-large" }), 413);
  for (const access of ["private", "public"] as const) {
    try {
      await put(pathname(), Buffer.from(body), { access, addRandomSuffix: false, allowOverwrite: true, contentType: "application/octet-stream" });
      return reply(JSON.stringify({ ok: true }));
    } catch { /* try the other access mode */ }
  }
  return reply(JSON.stringify({ error: "storage" }), 502);
}
