"use client";

import { useState } from "react";
import DashboardHUD from "../../components/dashboard/DashboardHUD";
import MechanicTandem from "../../components/dashboard/MechanicTandem";
import PitInReport, { TrunkItem } from "../../components/dashboard/PitInReport";
import type { KnotMetrics } from "../../lib/simulationTypes";

const INITIAL_ITEMS: TrunkItem[] = [
  { id: "knot-wrench", name: "KNOT WRENCH", effect: "Gas tension -8 / stabilizes weather", quantity: 2 },
  { id: "chicken-cell", name: "CHICKEN CELL", effect: "Chicken memory +10%", quantity: 5 },
  { id: "beef-injector", name: "BEEF INJECTOR", effect: "Beef memory +12%", quantity: 1 },
];

const ORACLE_KNOT_METRICS: KnotMetrics = {
  tensionStress: 74,
  knotCrossing: 12,
  topologyPhase: "breakdown-watch",
};

export default function DashboardPage() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [chickenRatio, setChickenRatio] = useState(0.42);
  const [beefRatio, setBeefRatio] = useState(0.68);

  const consume = (item: TrunkItem) => {
    if (item.quantity < 1) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry));
    if (item.id === "chicken-cell") setChickenRatio((value) => Math.min(1, value + 0.1));
    if (item.id === "beef-injector") setBeefRatio((value) => Math.min(1, value + 0.12));
  };

  return (
    <main className="min-h-screen bg-[#03050d] px-4 py-6 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-5">
        <DashboardHUD
          fuel={74.6}
          gasPriceGwei={21.4}
          knotMetrics={ORACLE_KNOT_METRICS}
          recommendedGear="4h OVERDRIVE"
          walletLabel="0xD0GG...7A11"
        />
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <MechanicTandem isRenting beefRatio={beefRatio} chickenRatio={chickenRatio} />
          <PitInReport chickenRatio={chickenRatio} cooldownLabel="03:42:18" items={items} onConsume={consume} />
        </div>
        <footer className="flex flex-wrap justify-between gap-2 px-1 font-mono text-[10px] tracking-wider text-slate-600"><span>NETWORK: METADOGG TESTNET // BLOCK 18,442,901</span><span>NO FINANCIAL ADVICE / DRIVE RESPONSIBLY</span></footer>
      </div>
    </main>
  );
}
