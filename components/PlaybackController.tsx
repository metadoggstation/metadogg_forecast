import React from "react";
import type { Speed } from "../lib/simulationTypes";

interface Props {
  playing: boolean;
  speed: Speed;
  /** current bar index (0-based) */
  position: number;
  /** total number of bars in the dataset */
  total: number;
  label?: string;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onSpeed: (s: Speed) => void;
  onSeek: (index: number) => void;
}

const SPEEDS: Speed[] = [1, 2, 4, 10];

const btn = (active = false): React.CSSProperties => ({
  background: active ? "#ff2bd6" : "#10162a",
  color: active ? "#050816" : "#7df9ff",
  border: "1px solid #00d4ff88",
  padding: "6px 14px",
  fontFamily: "monospace",
  cursor: "pointer",
});

export const PlaybackController: React.FC<Props> = ({ playing, speed, position, total, label, onPlay, onPause, onStep, onSpeed, onSeek }) => (
  <footer style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "#070b17", border: "1px solid #00d4ff55", boxShadow: "0 0 12px #00d4ff33", fontFamily: "monospace" }}>
    <input
      type="range" aria-label="timeline" min={0} max={Math.max(0, total - 1)} value={position}
      onChange={(e) => onSeek(Number(e.target.value))} style={{ width: "100%", accentColor: "#ff2bd6" }}
    />
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button style={btn(playing)} onClick={onPlay} disabled={playing}>▶ PLAY</button>
      <button style={btn(!playing)} onClick={onPause} disabled={!playing}>⏸ PAUSE</button>
      <button style={btn()} onClick={onStep} aria-label="step">⏭ STEP</button>
      <span style={{ width: 16 }} />
      {SPEEDS.map((s) => (
        <button key={s} style={btn(speed === s)} onClick={() => onSpeed(s)}>x{s}</button>
      ))}
      <span style={{ marginLeft: "auto", color: "#888", fontSize: 12 }}>
        {label ?? ""} {total ? `${position + 1} / ${total}` : ""}
      </span>
    </div>
  </footer>
);

export default PlaybackController;
