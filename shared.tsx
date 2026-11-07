import { useStore } from "@/lib/store";
import { Stat, StatStrip } from "@/components/bits";
import { int, money, money0, ord, pct, pts, signedMoney } from "@/lib/format";
import type { SimResult } from "@/lib/sim";

export function useView() {
  const s = useStore();
  const r = s.result;
  const sum = r?.summaries.find((x) => x.contestId === s.contestId) ?? r?.summaries[0] ?? null;
  return { ...s, r, sum, cid: sum?.contestId ?? s.contestId };
}

export function KpiStrip() {
  const { sum } = useView();
  if (!sum) return null;
  const inCash = sum.bestRank != null && sum.bestRank <= sum.paidN;
  return (
    <StatStrip>
      <Stat label="Best rank" value={ord(sum.bestRank)} tone={sum.bestRank == null ? null : inCash ? "pos" : "neg"} sub={`cash line ${ord(sum.paidN)} of ${int(sum.field)}`} />
      <Stat label="Any lineup cashes" value={pct(sum.anyCash)} tone={sum.anyCash >= 0.5 ? "pos" : "neg"} sub={`${sum.entries} ${sum.entries === 1 ? "lineup" : "lineups"}`} />
      <Stat label="Any lineup wins" value={pct(sum.anyWin)} sub={`1st pays ${money0(sum.first)}`} />
      <Stat label="Expected payout" value={money(sum.ev)} tone={sum.net >= 0 ? "pos" : "neg"} sub={`${signedMoney(sum.net)} vs ${money(sum.fees)} fees`} />
      <Stat label="Winning now" value={money(sum.nowWin)} sub={`cash line now ${pts(sum.lineNow)} pts`} />
      <Stat label="Projected cash line" value={pts(sum.lineP50)} sub={`My PMR ${int(sum.pmr)} · field avg ${pts(sum.pmrField)}`} />
    </StatStrip>
  );
}

export const inC = <T extends { contestId: string }>(rows: T[] | undefined, cid: string) => (rows ?? []).filter((r) => r.contestId === cid);
export type R = SimResult;
