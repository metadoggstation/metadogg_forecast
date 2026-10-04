"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ForecastLiveChart, { Candle } from "../../components/ForecastLiveChart";
import TuningMatrixPanel from "../../components/TuningMatrixPanel";
import LiveScoreBoard, { EMPTY_SCORE } from "../../components/LiveScoreBoard";
import PlaybackController from "../../components/PlaybackController";
import type { ScenarioInfo, Speed, TickPayload } from "../../lib/simulationTypes";

/** FastAPI backend: `uvicorn engine.simulation_api:app --port 8000` */
const API = process.env.NEXT_PUBLIC_SIM_API ?? "http://localhost:8000";
const LOOKBACK = 40;
const MAX_CANDLES = 60;
const EMPTY_FORECAST = { macd1m: [], bb1h: [], knot4h: [] };

export default function SimulationPage() {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [scenario, setScenario] = useState<string>("");
  const [tick, setTick] = useState<TickPayload | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const posRef = useRef(0);

  const total = scenarios.find((s) => s.id === scenario)?.total ?? 0;

  const stop = useCallback(() => abortRef.current?.abort(), []);

  /** Open the NDJSON stream; stopAt aborts after that bar index (single frame / paused seek). */
  const open = useCallback(async (sc: string, start: number, spd: Speed, lookback: number, stopAt?: number) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch(`${API}/simulation/stream?scenario=${sc}&start=${start}&speed=${spd}&lookback=${lookback}`, { signal: ac.signal });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const t: TickPayload = JSON.parse(line);
          posRef.current = t.index;
          setTick(t);
          setCandles((cs) => {
            const base = cs.length && t.index === 0 ? [] : cs;
            return [...base, t.ohlcv].slice(-MAX_CANDLES);
          });
          if (stopAt !== undefined && t.index >= stopAt) { ac.abort(); return; }
        }
      }
      setPlaying(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") { setError(String(e)); setPlaying(false); }
    }
  }, []);

  useEffect(() => {
    fetch(`${API}/simulation/scenarios`).then((r) => r.json()).then((l: ScenarioInfo[]) => { setScenarios(l); setScenario(l[0]?.id ?? ""); }).catch((e) => setError(String(e)));
    return () => abortRef.current?.abort();
  }, []);

  const reset = useCallback((sc: string) => {
    abortRef.current?.abort();
    setPlaying(false); setCandles([]); setTick(null); posRef.current = 0;
    if (sc) open(sc, 0, 1, 0, 0);
  }, [open]);

  useEffect(() => { if (scenario) reset(scenario); }, [scenario, reset]);

  const play = () => { setPlaying(true); open(scenario, Math.min(posRef.current + 1, Math.max(total - 1, 0)), speed, 0); };
  const pause = () => { stop(); setPlaying(false); };
  const step = () => { pause(); const n = posRef.current + 1; if (n < total) open(scenario, n, speed, 0, n); };
  const changeSpeed = (s: Speed) => { setSpeed(s); if (playing) open(scenario, posRef.current + 1, s, 0); };
  const seek = (i: number) => { setCandles([]); open(scenario, i, speed, LOOKBACK, playing ? undefined : i); };

  const turbo = playing && speed > 1;
  const chartState = { sdf: tick?.sdf ?? 0, gravityTensor: tick?.gravityTensor ?? 0 };

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", gap: 12, padding: 12, background: "#03050d", color: "#7df9ff" }}>
      <LiveScoreBoard score={tick?.score ?? EMPTY_SCORE} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "monospace" }}>
        <label>SCENARIO
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} style={{ marginLeft: 8, background: "#10162a", color: "#7df9ff" }}>
            {scenarios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {tick && <span style={{ color: "#888" }}>{tick.ohlcv.t} · close {tick.ohlcv.close}{tick.trade ? ` · ${tick.trade.event.toUpperCase()} ${tick.trade.side}` : ""}</span>}
        {error && <span style={{ color: "#ff2b5e" }}>{error}</span>}
      </div>
      <section style={{ display: "flex", gap: 12, justifyContent: "center", flex: 1 }}>
        <ForecastLiveChart candles={candles.length ? candles : [{ open: 1, high: 1, low: 1, close: 1 }]} forecast={tick?.forecast ?? EMPTY_FORECAST}
          chartState={chartState} turbo={turbo} hidePanel />
        <TuningMatrixPanel chartState={chartState} tuned={tick?.tuning} turbo={turbo} />
      </section>
      <PlaybackController playing={playing} speed={speed} position={tick?.index ?? 0} total={total}
        label={scenarios.find((s) => s.id === scenario)?.label}
        onPlay={play} onPause={pause} onStep={step} onSpeed={changeSpeed} onSeek={seek} />
    </main>
  );
}
