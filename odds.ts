// Live UFC fight odds from The Odds API, averaged across books with the vig removed.
// Env: ODDS_API_KEY. The CDN caches each response for 10 minutes, so every phone and laptop
// shares one upstream call (1 credit) per 10 minutes.
const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": cache } });

const implied = (american: number) => (american < 0 ? -american / (-american + 100) : 100 / (american + 100));

interface Outcome { name: string; price: number }
interface Book { markets: { key: string; outcomes: Outcome[] }[] }
interface Ev { home_team: string; away_team: string; commence_time: string; bookmakers: Book[] }

export async function GET() {
  const key = process.env.ODDS_API_KEY;
  if (!key) return json({ error: "not-configured" }, 503);
  const url = `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?regions=us&markets=h2h&oddsFormat=american&apiKey=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  if (!res.ok) return json({ error: "upstream", status: res.status }, 502);
  const events = (await res.json()) as Ev[];
  const fights = events.flatMap((e) => {
    const probs = new Map<string, number[]>();
    let books = 0;
    for (const b of e.bookmakers) {
      const o = b.markets.find((m) => m.key === "h2h")?.outcomes;
      if (!o || o.length !== 2) continue;
      const raw = o.map((x) => implied(x.price)); const sum = raw[0] + raw[1];
      o.forEach((x, i) => probs.set(x.name, [...(probs.get(x.name) ?? []), raw[i] / sum]));
      books++;
    }
    if (!books) return [];
    const avg = (n: string) => { const a = probs.get(n) ?? []; return a.reduce((s, v) => s + v, 0) / (a.length || 1); };
    const pa = avg(e.away_team), pb = avg(e.home_team); const t = pa + pb;
    return [{ a: e.away_team, b: e.home_team, pa: pa / t, pb: pb / t, books, start: e.commence_time }];
  });
  return json({ fetchedAt: Date.now(), remaining: res.headers.get("x-requests-remaining"), fights }, 200, "public, s-maxage=600, stale-while-revalidate=300");
}
