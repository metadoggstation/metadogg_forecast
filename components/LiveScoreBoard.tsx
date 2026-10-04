import React, { useEffect, useRef, useState } from "react";
import type { ScoreSnapshot } from "../lib/simulationTypes";

/** Smoothly animates toward `target` (ease-out count-up). */
function useCountUp(target: number, ms = 600): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  useEffect(() => {
    from.current = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      cur.current = from.current + (target - from.current) * (1 - Math.pow(1 - k, 3));
      setShown(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

const Stat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 10, color: "#7df9ff", letterSpacing: 2 }}>{label}</div>
    <div style={{ fontSize: 22, color, fontVariantNumeric: "tabular-nums", textShadow: `0 0 8px ${color}` }}>{value}</div>
  </div>
);

export const EMPTY_SCORE: ScoreSnapshot = { wins: 0, losses: 0, winRate: 0, averageWin: 0, averageLoss: 0, riskReward: 0, totalReward: 0 };

export const LiveScoreBoard: React.FC<{ score: ScoreSnapshot }> = ({ score }) => {
  const reward = useCountUp(score.totalReward);
  const winRate = useCountUp(score.winRate * 100);
  const rr = useCountUp(score.riskReward);
  return (
    <header style={{ display: "flex", justifyContent: "space-around", alignItems: "center", padding: 12, background: "#070b17", border: "1px solid #ff2bd655", boxShadow: "0 0 14px #ff2bd633", fontFamily: "monospace" }}>
      <Stat label="WIN / LOSS" value={`${score.wins} / ${score.losses}`} color="#39ff14" />
      <Stat label="WIN RATE" value={`${winRate.toFixed(1)}%`} color="#00d4ff" />
      <Stat label="AVG RISK-REWARD" value={rr.toFixed(2)} color="#ffd400" />
      <Stat label="総合魔力スコア / TOTAL REWARD" value={reward.toFixed(2)} color="#ff2bd6" />
    </header>
  );
};

export default LiveScoreBoard;
