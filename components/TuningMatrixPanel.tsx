import React, { useEffect, useRef, useState } from "react";

export interface ChartUIState {
  /** Spatial distortion (SDF) value from ChartUI */
  sdf: number;
  /** Gravity tensor magnitude from ChartUI */
  gravityTensor: number;
}

export interface IndicatorParam {
  indicator: string;
  name: string;
  value: number;
  min: number;
  max: number;
}

export const DEFAULT_PARAMS: IndicatorParam[] = [
  { indicator: "MACD", name: "Fast", value: 12, min: 3, max: 20 },
  { indicator: "MACD", name: "Slow", value: 26, min: 15, max: 60 },
  { indicator: "RSI", name: "Period", value: 14, min: 5, max: 30 },
  { indicator: "BB", name: "Period", value: 20, min: 10, max: 50 },
  { indicator: "BB", name: "StdDev", value: 2, min: 1, max: 4 },
];

/** Deterministically map distortion state to a target value inside [min, max]. */
export function tuneValue(p: IndicatorParam, s: ChartUIState, idx: number): number {
  const phase = Math.abs(Math.sin(s.sdf * (idx + 1.7) + s.gravityTensor * (idx + 0.3)));
  const raw = p.min + phase * (p.max - p.min);
  return p.max <= 5 ? Math.round(raw * 10) / 10 : Math.round(raw);
}

/** Externally supplied tuning result (e.g. streamed by the simulation backend). */
export interface TunedParam extends IndicatorParam {
  previous: number;
}

const SCRAMBLE_MS = 600;

const Meter: React.FC<{ p: IndicatorParam; prev: number; scrambling: boolean }> = ({ p, prev, scrambling }) => {
  const [shown, setShown] = useState(p.value);
  useEffect(() => {
    if (!scrambling) {
      setShown(p.value);
      return;
    }
    const id = setInterval(() => setShown(Math.round((p.min + Math.random() * (p.max - p.min)) * 10) / 10), 50);
    return () => clearInterval(id);
  }, [scrambling, p.value, p.min, p.max]);
  const pct = ((p.value - p.min) / (p.max - p.min)) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7df9ff" }}>
        <span>{p.indicator} {p.name}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: scrambling ? "#ff2bd6" : "#39ff14" }}>
          {prev !== p.value && !scrambling ? `${prev} → ` : ""}{shown}
        </span>
      </div>
      <div style={{ height: 4, background: "#10162a" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#00d4ff,#b44cff)", transition: "width 0.5s" }} />
      </div>
    </div>
  );
};

interface Props {
  chartState: ChartUIState;
  initialParams?: IndicatorParam[];
  onTune?: (params: IndicatorParam[]) => void;
  /** When set, values come from here instead of the internal tuner. */
  tuned?: TunedParam[];
  /** Fast-forward effect: meters flicker and morph continuously. */
  turbo?: boolean;
}

export const TuningMatrixPanel: React.FC<Props> = ({ chartState, initialParams = DEFAULT_PARAMS, onTune, tuned, turbo = false }) => {
  const [params, setParams] = useState(initialParams);
  const [prev, setPrev] = useState<number[]>(initialParams.map((p) => p.value));
  const [scrambling, setScrambling] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (tuned) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setScrambling(true);
    const t = setTimeout(() => {
      setParams((cur) => {
        setPrev(cur.map((p) => p.value));
        const next = cur.map((p, i) => ({ ...p, value: tuneValue(p, chartState, i) }));
        onTune?.(next);
        return next;
      });
      setScrambling(false);
    }, SCRAMBLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartState.sdf, chartState.gravityTensor]);

  return (
    <aside style={{ width: 220, padding: 12, background: "#070b17", border: "1px solid #00d4ff55", fontFamily: "monospace", boxShadow: "0 0 12px #00d4ff33" }}>
      <h3 style={{ margin: "0 0 8px", color: "#ff2bd6", fontSize: 12, letterSpacing: 2 }}>TUNING MATRIX</h3>
      <div style={{ fontSize: 10, color: "#888", marginBottom: 10 }}>
        SDF {chartState.sdf.toFixed(3)} / G-TENSOR {chartState.gravityTensor.toFixed(3)}
      </div>
      {(tuned ?? params).map((p, i) => (
        <Meter key={`${p.indicator}-${p.name}`} p={p} prev={tuned ? tuned[i].previous : prev[i]} scrambling={scrambling || turbo} />
      ))}
    </aside>
  );
};

export default TuningMatrixPanel;
