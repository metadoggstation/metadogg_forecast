import React, { useEffect, useRef, useState } from "react";
import { POF_SESSION_EVENT, POF_STORAGE_KEY, type PofSession } from "./LiveScoreBoard";

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
const API = process.env.NEXT_PUBLIC_SIM_API ?? "http://localhost:8000";

interface PofResponse {
  score: number;
  breakdown: Record<string, number>;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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
  const [submitting, setSubmitting] = useState(false);
  const [pofError, setPofError] = useState<string | null>(null);
  const first = useRef(true);
  const activeParams = tuned ?? params;

  const submitPoF = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPofError(null);
    const knotCrossing = Math.max(0, Math.round(Math.abs(chartState.sdf)));
    const tensionStress = Math.min(1, Math.max(0, Math.abs(chartState.gravityTensor)));
    const topologyPhase = chartState.sdf >= 1 ? "trend" : chartState.sdf <= -1 ? "contraction" : "range";
    const beefRatio = Math.min(1, Math.max(0, activeParams.length
      ? activeParams[0].value / Math.max(activeParams[0].max, 1)
      : 0.5));
    const timestamp = new Date().toISOString();

    try {
      const response = await fetch(`${API}/simulation/pof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knot_crossing: knotCrossing,
          tension_stress: tensionStress,
          topology_phase: topologyPhase,
          beef_ratio: beefRatio,
        }),
      });
      if (!response.ok) throw new Error(`PoF request failed (${response.status})`);
      const result: PofResponse = await response.json();
      if (typeof result.score !== "number" || !result.breakdown) throw new Error("PoF response is invalid");

      const stored = window.localStorage.getItem(POF_STORAGE_KEY);
      const previous: Partial<PofSession> = stored ? JSON.parse(stored) : {};
      const clientId = window.localStorage.getItem("metadogg_pof_client_id") ?? window.crypto.randomUUID();
      window.localStorage.setItem("metadogg_pof_client_id", clientId);
      const hash = await sha256(`${clientId}:${timestamp}:${result.score}:${JSON.stringify(result.breakdown)}`);
      const session: PofSession = {
        hash,
        beefRatio,
        cumulativeScore: (typeof previous.cumulativeScore === "number" ? previous.cumulativeScore : 0) + result.score,
        timestamp,
        breakdown: result.breakdown,
      };
      window.localStorage.setItem(POF_STORAGE_KEY, JSON.stringify(session));
      window.dispatchEvent(new CustomEvent(POF_SESSION_EVENT));
    } catch (error) {
      setPofError(error instanceof Error ? error.message : "PoF request failed");
    } finally {
      setSubmitting(false);
    }
  };

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
      {activeParams.map((p, i) => (
        <Meter key={`${p.indicator}-${p.name}`} p={p} prev={tuned ? tuned[i].previous : prev[i]} scrambling={scrambling || turbo} />
      ))}
      <button type="button" onClick={submitPoF} disabled={submitting}
        style={{ width: "100%", marginTop: 8, padding: "6px 4px", background: "#ff2bd622", color: "#ff2bd6", border: "1px solid #ff2bd6", fontFamily: "monospace", cursor: submitting ? "wait" : "pointer" }}>
        {submitting ? "SUBMITTING..." : "TRIGGER PoF"}
      </button>
      {pofError && <div role="alert" style={{ marginTop: 6, color: "#ff2b5e", fontSize: 10 }}>{pofError}</div>}
    </aside>
  );
};

export default TuningMatrixPanel;
