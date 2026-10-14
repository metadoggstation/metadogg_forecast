"use client";

import { useState } from "react";
import DashboardHUD from "../../components/dashboard/DashboardHUD";
import MechanicTandem from "../../components/dashboard/MechanicTandem";
import PitInReport, { TrunkItem } from "../../components/dashboard/PitInReport";
import type { KnotMetrics } from "../../lib/simulationTypes";
import { useKnotWeather } from "../../hooks/useKnotWeather";

const INITIAL_ITEMS: TrunkItem[] = [
  { id: "knot-wrench", name: "KNOT WRENCH", effect: "Gas tension -8 / stabilizes weather", quantity: 2 },
  { id: "chicken-cell", name: "CHICKEN CELL", effect: "Chicken memory +10%", quantity: 5 },
  { id: "beef-injector", name: "BEEF INJECTOR", effect: "Beef memory +12%", quantity: 1 },
];

export default function DashboardPage() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [chickenRatio, setChickenRatio] = useState(0.42);
  const [beefRatio, setBeefRatio] = useState(0.68);
  const { weatherData, isLoading, isError } = useKnotWeather();

  const consume = (item: TrunkItem) => {
    if (item.quantity < 1) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry));
    if (item.id === "chicken-cell") setChickenRatio((value) => Math.min(1, value + 0.1));
    if (item.id === "beef-injector") setBeefRatio((value) => Math.min(1, value + 0.12));
  };

  const knotMetrics: KnotMetrics | null = weatherData
    ? {
        tensionStress: weatherData.tension_stress,
        knotCrossing: weatherData.knot_crossing,
        topologyPhase: weatherData.topology_phase,
      }
    : null;

  return (
    <main className="min-h-screen bg-[#03050d] px-4 py-6 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-5">
        {knotMetrics ? (
          <>
            {isError && (
              <p className="rounded border border-amber-400/30 bg-amber-400/5 px-4 py-2 font-mono text-xs text-amber-200" role="status">
                ORACLE CONNECTION LOST // DISPLAYING LAST KNOWN WEATHER
              </p>
            )}
            <DashboardHUD
              fuel={74.6}
              knotMetrics={knotMetrics}
              recommendedGear="4h OVERDRIVE"
              walletLabel="0xD0GG...7A11"
            />
          </>
        ) : isLoading ? (
          <section className="grid min-h-64 place-items-center rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-[#071a2b] to-[#090d16] p-8" role="status" aria-live="polite">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300 border-r-fuchsia-400" />
              <p className="mt-4 font-mono text-xs tracking-[0.2em] text-cyan-200">IGNITION SEQUENCE // CONNECTING TO ORACLE</p>
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-rose-400/30 bg-rose-950/20 p-8 text-center" role="alert">
            <p className="font-mono text-sm font-bold text-rose-200">ORACLE CONNECTION FAILED</p>
            <p className="mt-2 font-mono text-xs text-slate-400">Unable to load knot weather. Automatic retry is enabled.</p>
          </section>
        )}
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <MechanicTandem isRenting beefRatio={beefRatio} chickenRatio={chickenRatio} />
          <PitInReport chickenRatio={chickenRatio} cooldownLabel="03:42:18" items={items} onConsume={consume} />
        </div>
        <footer className="flex flex-wrap justify-between gap-2 px-1 font-mono text-[10px] tracking-wider text-slate-600"><span>NETWORK: METADOGG TESTNET // BLOCK 18,442,901</span><span>NO FINANCIAL ADVICE / DRIVE RESPONSIBLY</span></footer>
      </div>
    </main>
  );
}
