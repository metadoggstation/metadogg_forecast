import React, { useEffect, useMemo, useState } from "react";
import TuningMatrixPanel, { ChartUIState, TunedParam } from "./TuningMatrixPanel";

export interface Candle { open: number; high: number; low: number; close: number }

/** Predicted price range for a future candle. */
export interface PredictionBox { low: number; high: number }

export interface ForecastSet {
  macd1m: PredictionBox[];
  bb1h: PredictionBox[];
  knot4h: PredictionBox[];
}

interface Props {
  candles: Candle[];
  forecast: ForecastSet;
  chartState: ChartUIState;
  width?: number;
  height?: number;
  /** Fast-forward effect: prediction boxes flicker and morph rapidly. */
  turbo?: boolean;
  /** Streamed tuning values forwarded to the embedded panel. */
  tuned?: TunedParam[];
  /** Hide the embedded TuningMatrixPanel (when it is placed separately). */
  hidePanel?: boolean;
}

const LAYERS: { key: keyof ForecastSet; color: string; opacity: number; glow?: boolean }[] = [
  { key: "macd1m", color: "#2f6bff", opacity: 0.55 },
  { key: "bb1h", color: "#ffd400", opacity: 0.35 },
  { key: "knot4h", color: "#b44cff", opacity: 0.3, glow: true },
];

/** Price band covered by the most layers at a given future step (the highlight zone). */
export function overlapZone(forecast: ForecastSet, step: number): PredictionBox | null {
  const boxes = LAYERS.map((l) => forecast[l.key][step]).filter(Boolean) as PredictionBox[];
  if (boxes.length < 2) return null;
  const low = Math.max(...boxes.map((b) => b.low));
  const high = Math.min(...boxes.map((b) => b.high));
  return low < high ? { low, high } : null;
}

export const ForecastLiveChart: React.FC<Props> = ({ candles, forecast, chartState, width = 720, height = 400, turbo = false, tuned, hidePanel = false }) => {
  const [flick, setFlick] = useState(0);
  useEffect(() => {
    if (!turbo) { setFlick(0); return; }
    const id = setInterval(() => setFlick((f) => f + 1), 70);
    return () => clearInterval(id);
  }, [turbo]);
  /** Deterministic pseudo-random in [0,1) per (frame, layer, step). */
  const jitter = (a: number, b: number) => Math.abs(Math.sin((flick + 1) * 12.9898 + a * 78.233 + b * 37.719) * 43758.5453) % 1;
  const steps = Math.max(0, ...LAYERS.map((l) => forecast[l.key].length));
  const slot = width / (candles.length + steps + 1);

  const { toY } = useMemo(() => {
    const all = [
      ...candles.flatMap((c) => [c.high, c.low]),
      ...LAYERS.flatMap((l) => forecast[l.key].flatMap((b) => [b.high, b.low])),
    ];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    return { toY: (v: number) => height - 10 - ((v - min) / span) * (height - 20) };
  }, [candles, forecast, height]);

  const x = (i: number) => i * slot + slot / 2;

  return (
    <div style={{ display: "flex", gap: 12, background: "#03050d", padding: 12 }}>
      <svg width={width} height={height} style={{ background: "#050816" }}>
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {candles.map((c, i) => {
          const up = c.close >= c.open;
          const col = up ? "#39ff14" : "#ff2b5e";
          return (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={toY(c.high)} y2={toY(c.low)} stroke={col} />
              <rect x={x(i) - slot * 0.3} width={slot * 0.6} y={toY(Math.max(c.open, c.close))} height={Math.max(1, Math.abs(toY(c.open) - toY(c.close)))} fill={col} />
            </g>
          );
        })}
        {Array.from({ length: steps }, (_, s) => {
          const cx = x(candles.length + s);
          const zone = overlapZone(forecast, s);
          return (
            <g key={s}>
              {LAYERS.map((l, li) => {
                const b = forecast[l.key][s];
                if (!b) return null;
                const j = turbo ? jitter(li, s) : 0;
                const scale = turbo ? 0.7 + j * 0.6 : 1;
                const h = Math.max(1, toY(b.low) - toY(b.high)) * scale;
                const mid = (toY(b.high) + toY(b.low)) / 2;
                return (
                  <rect key={l.key} x={cx - slot * 0.4} width={slot * 0.8} y={turbo ? mid - h / 2 : toY(b.high)} height={h}
                    fill={l.color} fillOpacity={turbo ? 0.15 + j * 0.6 : l.opacity} stroke={l.color} filter={l.glow ? "url(#glow)" : undefined} />
                );
              })}
              {zone && (
                <rect data-testid="overlap-zone" x={cx - slot * 0.4} width={slot * 0.8} y={toY(zone.high)} height={Math.max(1, toY(zone.low) - toY(zone.high))}
                  fill="#ffffff" fillOpacity={0.35} stroke="#ffffff" strokeWidth={1.5} filter="url(#glow)" />
              )}
            </g>
          );
        })}
      </svg>
      {!hidePanel && <TuningMatrixPanel chartState={chartState} tuned={tuned} turbo={turbo} />}
    </div>
  );
};

export default ForecastLiveChart;
