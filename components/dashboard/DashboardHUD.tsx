"use client";

import { useState } from "react";
import { useMemo } from "react";
import type { KnotMetrics, WeatherState } from "../../lib/simulationTypes";

export interface DashboardHUDProps {
  fuel: number;
  gasPriceGwei: number;
  knotMetrics: KnotMetrics;
  recommendedGear: string;
  walletLabel: string;
  onTrunkOpen?: () => void;
}

interface WeatherPresentation {
  badge: string;
  icon: string;
  description: string;
  containerClass: string;
  badgeClass: string;
  ringClass: string;
  multiplier: number;
}

const WEATHER_PRESENTATION: Record<WeatherState, WeatherPresentation> = {
  CLEAR: {
    badge: "CLEAR // 順風満帆",
    icon: "☀",
    description: "Stable market / normal fuel burn",
    containerClass: "border-cyan-300/20 bg-[#090d16] shadow-[0_0_60px_rgba(0,212,255,0.08)]",
    badgeClass: "border-lime-300/30 bg-lime-300/5 text-lime-300",
    ringClass: "border-t-cyan-300 border-r-fuchsia-400",
    multiplier: 1,
  },
  TURBULENCE: {
    badge: "TURBULENCE // 嵐・暴落警戒",
    icon: "⚡",
    description: "Beef critical buff / 1.8x fuel burn",
    containerClass: "border-rose-400/40 bg-gradient-to-br from-[#1b0b16] via-[#140b14] to-[#090d16] shadow-[0_0_70px_rgba(251,113,133,0.18)]",
    badgeClass: "border-rose-400/50 bg-rose-500/10 text-rose-300",
    ringClass: "border-t-rose-400 border-r-amber-300",
    multiplier: 1.8,
  },
  STAGNANT: {
    badge: "STAGNANT // もみ合い",
    icon: "◌",
    description: "Chicken anti-stall assist / range market",
    containerClass: "border-amber-300/30 bg-gradient-to-br from-[#171309] via-[#101015] to-[#090d16] shadow-[0_0_60px_rgba(251,191,36,0.12)]",
    badgeClass: "border-amber-300/40 bg-amber-300/10 text-amber-200",
    ringClass: "border-t-amber-300 border-r-violet-400",
    multiplier: 1,
  },
};

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function getWeatherState({ tensionStress, knotCrossing }: KnotMetrics): WeatherState {
  if (tensionStress >= 70) return "TURBULENCE";
  if (knotCrossing >= 15) return "STAGNANT";
  return "CLEAR";
}

export function calculateFuelEfficiency(baseGas: number, { tensionStress, knotCrossing }: KnotMetrics): number {
  const normalizedGas = Math.max(0, baseGas);
  const normalizedStress = Math.max(0, tensionStress);
  return normalizedGas * (1 + normalizedStress / 100) * (knotCrossing > 10 ? 1.5 : 1);
}

export function useFuelEfficiency(baseGas: number, knotMetrics: KnotMetrics) {
  return useMemo(() => {
    const weather = getWeatherState(knotMetrics);
    const baseFuelEfficiency = calculateFuelEfficiency(baseGas, knotMetrics);
    const weatherMultiplier = WEATHER_PRESENTATION[weather].multiplier;

    return {
      weather,
      baseFuelEfficiency,
      weatherMultiplier,
      fuelEfficiency: baseFuelEfficiency * weatherMultiplier,
    };
  }, [baseGas, knotMetrics]);
}

export default function DashboardHUD({
  fuel,
  gasPriceGwei,
  knotMetrics,
  recommendedGear,
  walletLabel,
  onTrunkOpen,
}: DashboardHUDProps) {
  const [trunkOpen, setTrunkOpen] = useState(false);
  const { weather, baseFuelEfficiency, weatherMultiplier, fuelEfficiency } = useFuelEfficiency(gasPriceGwei, knotMetrics);
  const normalizedTension = clamp(knotMetrics.tensionStress);
  const weatherPresentation = WEATHER_PRESENTATION[weather];

  const openTrunk = () => {
    setTrunkOpen(true);
    onTrunkOpen?.();
  };

  return (
    <section className={`relative overflow-hidden rounded-[2rem] border p-5 sm:p-7 ${weatherPresentation.containerClass}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(125,249,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(125,249,255,0.035)_1px,transparent_1px)] bg-[size:26px_26px]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.35em] text-fuchsia-400">METADOGG // COCKPIT</p>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-tight text-slate-100 sm:text-3xl">
            Garage Unit <span className="text-cyan-300">TBA</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{walletLabel}</p>
        </div>
        <div className={`rounded border px-3 py-2 text-right font-mono text-[10px] ${weatherPresentation.badgeClass}`}>
          <div><span className="mr-2">{weatherPresentation.icon}</span>{weatherPresentation.badge}</div>
          <div className="mt-1 text-slate-500">{weatherPresentation.description}</div>
        </div>
      </div>

      <div className="relative mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr_0.9fr]">
        <div className="rounded-xl border border-fuchsia-400/20 bg-black/25 p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.25em] text-slate-500">$MEAT FUEL</p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-fuchsia-300">{fuel.toFixed(1)}%</p>
            </div>
            <span className="font-mono text-xs text-fuchsia-300/70">LIQUID ASSET</span>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-sm bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-600 via-fuchsia-300 to-cyan-300 shadow-[0_0_14px_#ff2bd6] transition-[width]"
              style={{ width: `${clamp(fuel)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-600"><span>EMPTY</span><span>MAX CAPACITY</span></div>
        </div>

        <div className="rounded-xl border border-cyan-300/20 bg-black/25 p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.25em] text-slate-500">BURN RATE / KNOT</p>
            <span className="font-mono text-xs text-cyan-200">{fuelEfficiency.toFixed(2)} GWEI / DIST</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full border-[6px] border-slate-800">
              <div className={`absolute inset-[-6px] rounded-full border-[6px] border-transparent ${weatherPresentation.ringClass}`} style={{ transform: `rotate(${normalizedTension * 2.4 - 35}deg)` }} />
              <span className="font-mono text-lg font-bold text-cyan-200">{normalizedTension.toFixed(0)}</span>
            </div>
            <div className="space-y-2 font-mono text-[11px]">
              <div><span className="text-slate-500">BASE GAS</span><span className="ml-3 text-amber-300">{gasPriceGwei.toFixed(2)} GWEI</span></div>
              <div><span className="text-slate-500">KNOT WEATHER</span><span className="ml-3 text-fuchsia-300">{normalizedTension.toFixed(0)}%</span></div>
              <div><span className="text-slate-500">KNOT CROSSING</span><span className="ml-3 text-cyan-200">{knotMetrics.knotCrossing.toFixed(1)}</span></div>
              <div className="text-slate-600">BASE {baseFuelEfficiency.toFixed(2)} × WEATHER {weatherMultiplier.toFixed(1)}X</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-amber-300/25 bg-amber-300/[0.03] p-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-slate-500">ORACLE GEAR SELECT</p>
            <p className="mt-4 font-mono text-lg font-bold uppercase leading-tight text-amber-200">{recommendedGear}</p>
          </div>
          <button type="button" onClick={openTrunk} className="mt-5 rounded border border-fuchsia-400/70 bg-fuchsia-500/10 px-3 py-3 font-mono text-xs font-bold tracking-[0.16em] text-fuchsia-200 transition hover:bg-fuchsia-500/25 focus:outline-none focus:ring-2 focus:ring-fuchsia-300">
            OPEN TRUNK // ERC-1155
          </button>
        </div>
      </div>

      {trunkOpen && (
        <div className="relative mt-5 rounded-xl border border-fuchsia-400/40 bg-[#120d1b] p-4 shadow-[0_0_24px_rgba(255,43,214,0.12)]" role="dialog" aria-label="Trunk inventory">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.25em] text-fuchsia-300">TRUNK INVENTORY // SECURE</p>
              <p className="mt-1 text-sm text-slate-300">ERC-1155 items and SBT license are ready.</p>
            </div>
            <button type="button" onClick={() => setTrunkOpen(false)} className="font-mono text-xs text-slate-500 hover:text-slate-200" aria-label="Close trunk">[ CLOSE ]</button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["KNOT WRENCH ×2", "CHICKEN CELL ×5", "SBT // PIT CREW"].map((item) => (
              <div key={item} className="border border-slate-700 bg-black/30 px-3 py-2 font-mono text-[11px] text-cyan-200">{item}</div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
