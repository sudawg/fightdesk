export type BoutStatus = "upcoming" | "live" | "final";
export type Method = "KO/TKO" | "SUB" | "DEC";

/** One fighter on the card, with the odds and scoring model used by the simulation. */
export interface Fighter {
  name: string;
  opponent: string;
  bout: number; // 1 = main event
  rounds: number;
  winProb: number; // vig-free, pre-fight
  finishProb: number; // chance the fight ends early (fight level)
  ppmWin: number; // DraftKings stat points per minute when winning
  ppmLoss: number;
  salary: number;
  proj: number;
  oddsSource: string;
}

/** Live state of one bout, set by the user (or by the demo). */
export interface BoutState {
  status: BoutStatus;
  winner?: string;
  method?: Method;
  round?: number;
  elapsed?: number; // minutes elapsed when live
  liveWinProb?: number; // override for the favourite's win chance during a live fight
  finishedAt?: number; // ms timestamp, orders fights for alerts
}

export interface StandingRow {
  rank: number;
  entryId: string;
  entryName: string;
  pmr: number;
  points: number;
  lineup: string[];
}

export interface OwnRow {
  player: string;
  drafted: number; // 0-1
  fpts: number;
}

export interface PrizeBand {
  from: number;
  to: number;
  prize: number;
}

export interface Contest {
  id: string;
  name: string;
  fee: number;
  dkContestId?: string;
  fileName: string;
  importedAt: number;
  rows: StandingRow[];
  own: OwnRow[];
  payouts: PrizeBand[];
}

export interface DKEntry {
  entryId: string;
  contest: string;
  contestId: string;
  fee: number;
  lineup: string[];
}

export interface PoolPlayer {
  name: string;
  id: string;
  salary: number;
  gameInfo: string;
  avg: number;
}

export interface AppData {
  username: string;
  card: Fighter[];
  bouts: Record<number, BoutState>;
  fpts: Record<string, number>; // normalized name -> current DraftKings points
  contests: Contest[];
  entries: DKEntry[];
  pool: PoolPlayer[];
  demo: boolean;
  savedAt: number;
}
