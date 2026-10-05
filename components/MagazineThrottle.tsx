"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type SlotId = "beef" | "chicken";
export interface SlotLoad {
  timeframe?: string;
  indicator?: string;
}
export type MagazineState = Record<SlotId, SlotLoad>;

const TIMEFRAMES = ["4H", "1H", "15m", "5m"];
const INDICATORS = ["結び目", "MACD", "RSI", "EMA"];

const SLOTS: { id: SlotId; label: string; icon: string; color: string }[] = [
  { id: "beef", label: "Beef (Macro/Max Profit)", icon: "🥩", color: "#ef4444" },
  { id: "chicken", label: "Chicken (Micro/Win Rate)", icon: "🍗", color: "#22c55e" },
];

interface Props {
  value?: MagazineState;
  onChange?: (s: MagazineState) => void;
}

export default function MagazineThrottle({ value, onChange }: Props) {
  const [inner, setInner] = useState<MagazineState>({ beef: {}, chicken: {} });
  const state = value ?? inner;
  const [locked, setLocked] = useState<{ slot: SlotId; n: number } | null>(null);
  const [over, setOver] = useState<SlotId | null>(null);

  const load = (slot: SlotId, kind: "timeframe" | "indicator", v: string) => {
    const next = { ...state, [slot]: { ...state[slot], [kind]: v } };
    setInner(next);
    onChange?.(next);
    setLocked((l) => ({ slot, n: (l?.n ?? 0) + 1 }));
  };

  const drag = (kind: string, v: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-ammo", JSON.stringify({ kind, v }));
    e.dataTransfer.effectAllowed = "copy";
  };

  const drop = (slot: SlotId) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    try {
      const { kind, v } = JSON.parse(e.dataTransfer.getData("application/x-ammo"));
      if (kind === "timeframe" || kind === "indicator") load(slot, kind, v);
    } catch {
      /* ignore foreign drops */
    }
  };

  const chip = (kind: string, v: string) => (
    <div
      key={v}
      draggable
      onDragStart={drag(kind, v)}
      style={{ padding: "4px 10px", border: "1px solid #555", borderRadius: 6, background: "#222", color: "#eee", cursor: "grab", fontSize: 12 }}
    >
      {v}
    </div>
  );

  return (
    <div style={{ background: "#111", padding: 16, borderRadius: 16, color: "#eee", maxWidth: 520 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {TIMEFRAMES.map((t) => chip("timeframe", t))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {INDICATORS.map((t) => chip("indicator", t))}
      </div>
      <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
        {SLOTS.map((s) => {
          const l = state[s.id];
          const justLocked = locked?.slot === s.id;
          return (
            <motion.div
              key={`${s.id}-${justLocked ? locked!.n : 0}`}
              onDragOver={(e) => { e.preventDefault(); setOver(s.id); }}
              onDragLeave={() => setOver(null)}
              onDrop={drop(s.id)}
              initial={false}
              animate={
                justLocked
                  ? {
                      scale: [1.12, 0.93, 1],
                      rotate: [-6, 3, 0],
                      boxShadow: [`0 0 40px 10px ${s.color}`, `0 0 16px 3px ${s.color}`, `0 0 8px 1px ${s.color}88`],
                    }
                  : { scale: over === s.id ? 1.06 : 1, boxShadow: `0 0 ${over === s.id ? 20 : 4}px ${s.color}66` }
              }
              transition={{ duration: 0.3, times: justLocked ? [0, 0.6, 1] : undefined, type: "tween" }}
              style={{
                width: 190, minHeight: 170, borderRadius: "50%/40%", border: `3px solid ${s.color}`,
                background: "radial-gradient(circle at 50% 40%, #2a2a2a, #0a0a0a)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 12, textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>⏱ {l.timeframe ?? "—"}</div>
              <div style={{ fontSize: 13 }}>📈 {l.indicator ?? "—"}</div>
              <AnimatePresence>
                {justLocked && l.timeframe && l.indicator && (
                  <motion.div
                    key={locked!.n}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ fontWeight: 700, color: s.color, fontSize: 12 }}
                  >
                    🔒 カチャッ! LOCKED
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
