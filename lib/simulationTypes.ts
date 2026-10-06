import type { ForecastSet } from "../components/ForecastLiveChart";

/** One tick of the simulation stream (see engine/simulation.py). */
export interface TickPayload {
  index: number;
  total: number;
  scenario: string;
  ohlcv: { t: string; open: number; high: number; low: number; close: number; volume: number };
  sdf: number;
  gravityTensor: number;
  forecast: ForecastSet;
  tuning: { indicator: string; name: string; previous: number; value: number; min: number; max: number }[];
  trade: null | {
    event: "entry" | "exit";
    side: "long" | "short";
    entryPrice: number;
    exitPrice: number | null;
    pnl: number | null;
    result: "win" | "loss" | null;
  };
  score: ScoreSnapshot;
}

/** Cumulative score; totalReward is computed server-side by engine/reward_optimizer.py. */
export interface ScoreSnapshot {
  wins: number;
  losses: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  riskReward: number;
  totalReward: number;
}

export interface ScenarioInfo { id: string; label: string; total: number }
export type Speed = 1 | 2 | 4 | 10;
