"use client";
import React, { useEffect, useRef } from "react";

export interface ForecastBox {
  step: number;
  high: number;
  low: number;
  w_beef: number; // 0..1 (チキンは 1 - w_beef)
  kappa: number;
  trick_active: boolean;
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  candles: Candle[];
  boxes: ForecastBox[]; // calculate_n_candle_box の出力 (2本以上)
  width?: number;
  height?: number;
}

export default function ForecastLiveChart({ candles, boxes, width = 720, height = 360 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useRef({ candles, boxes });
  data.current = { candles, boxes };

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const glitch = { until: 0, dx: 0, dy: 0, next: 0 };

    const draw = (now: number) => {
      const { candles, boxes } = data.current;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, width, height);

      const all = [...candles.flatMap((c) => [c.high, c.low]), ...boxes.flatMap((b) => [b.high, b.low])];
      if (all.length) {
        const max = Math.max(...all), min = Math.min(...all);
        const pad = (max - min || 1) * 0.1;
        const y = (p: number) => height - ((p - min + pad) / (max - min + 2 * pad)) * height;
        const slots = candles.length + boxes.length + 1;
        const cw = width / slots;
        const x = (i: number) => (i + 0.5) * cw;

        candles.forEach((c, i) => {
          const up = c.close >= c.open;
          ctx.strokeStyle = ctx.fillStyle = up ? "#26a69a" : "#ef5350";
          ctx.beginPath(); ctx.moveTo(x(i), y(c.high)); ctx.lineTo(x(i), y(c.low)); ctx.stroke();
          const top = y(Math.max(c.open, c.close));
          ctx.fillRect(x(i) - cw * 0.3, top, cw * 0.6, Math.max(1, Math.abs(y(c.open) - y(c.close))));
        });

        // トリック発動中の箱をときどきフェイントさせる
        const trick = boxes.some((b) => b.trick_active);
        if (trick && now > glitch.next) {
          glitch.until = now + 140;
          glitch.dx = (Math.random() - 0.5) * cw * 1.2;
          glitch.dy = (Math.random() - 0.5) * height * 0.15;
          glitch.next = now + 1200 + Math.random() * 1500;
        }
        const glitching = trick && now < glitch.until;

        boxes.forEach((b, k) => {
          const bx = x(candles.length + k);
          const bw = cw * 0.8;
          const top = y(b.high), bottom = y(b.low);
          const offX = glitching && b.trick_active ? glitch.dx : 0;
          const offY = glitching && b.trick_active ? glitch.dy : 0;
          const left = bx - bw / 2 + offX;
          const t = top + offY, h = bottom - top;

          // ビーフ(赤・太い/広い) ↔ チキン(緑青・狭く硬い) のグラデーション合成
          const g = ctx.createLinearGradient(0, t, 0, t + h);
          const wb = b.w_beef;
          g.addColorStop(0, `rgba(239,68,68,${0.15 + 0.45 * wb})`);
          g.addColorStop(0.5, `rgba(34,197,94,${0.15 + 0.45 * (1 - wb)})`);
          g.addColorStop(1, `rgba(239,68,68,${0.15 + 0.45 * wb})`);
          ctx.fillStyle = g;
          ctx.fillRect(left, t, bw, h);
          ctx.lineWidth = 1 + 3 * wb;
          ctx.strokeStyle = "rgba(239,68,68,0.9)";
          ctx.strokeRect(left, t, bw, h);

          // チキンの狭く硬いコアボックス (中央)
          const coreH = h * (0.15 + 0.35 * (1 - wb));
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(56,189,248,0.95)";
          ctx.fillStyle = "rgba(34,197,94,0.35)";
          ctx.fillRect(left + bw * 0.2, t + (h - coreH) / 2, bw * 0.6, coreH);
          ctx.strokeRect(left + bw * 0.2, t + (h - coreH) / 2, bw * 0.6, coreH);

          if (glitching && b.trick_active) {
            // グリッチ: RGBずれのスライス + ゴースト枠(本来位置)
            for (let i = 0; i < 4; i++) {
              const sy = t + Math.random() * h;
              ctx.fillStyle = i % 2 ? "rgba(0,255,255,0.5)" : "rgba(255,0,80,0.5)";
              ctx.fillRect(left + (Math.random() - 0.5) * 16, sy, bw, 2 + Math.random() * 3);
            }
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "rgba(255,255,255,0.6)";
            ctx.strokeRect(bx - bw / 2, top, bw, h);
            ctx.setLineDash([]);
          }
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return <canvas ref={ref} width={width} height={height} style={{ width, height, borderRadius: 12 }} />;
}
