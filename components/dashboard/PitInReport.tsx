export interface TrunkItem {
  id: string;
  name: string;
  effect: string;
  quantity: number;
}

export interface PitInReportProps {
  chickenRatio: number;
  cooldownLabel: string;
  items: TrunkItem[];
  onConsume: (item: TrunkItem) => void;
}

export default function PitInReport({ chickenRatio, cooldownLabel, items, onConsume }: PitInReportProps) {
  return (
    <section className="rounded-[1.5rem] border border-amber-300/25 bg-[#11100d] p-5 shadow-[0_0_35px_rgba(255,212,0,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] tracking-[0.3em] text-amber-300">PA // PIT-IN REPORT</p><h2 className="mt-1 text-lg font-bold text-slate-100">COOLDOWN ADVISORY</h2></div><div className="rounded border border-amber-300/30 px-3 py-2 font-mono text-xs text-amber-200">WAIT {cooldownLabel}</div></div>
      <div className="relative mt-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 pl-6 text-sm leading-relaxed text-slate-200 before:absolute before:left-[-7px] before:top-6 before:h-3 before:w-3 before:rotate-45 before:border-b before:border-l before:border-slate-700 before:bg-slate-900/60">
        <span className="mr-2 font-mono text-fuchsia-300">PATCH:</span>
        現在のサス（🍗 {Math.round(chickenRatio * 100)}% チキン比率）では次の暴落に耐えられない。トランクのアイテムでメモリを調整しな。
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <button type="button" key={item.id} disabled={item.quantity < 1} onClick={() => onConsume(item)} className="group rounded border border-slate-700 bg-black/25 p-3 text-left transition hover:border-cyan-300/70 hover:bg-cyan-300/5 disabled:cursor-not-allowed disabled:opacity-40">
            <div className="flex justify-between font-mono text-[11px] text-cyan-200"><span>{item.name}</span><span>×{item.quantity}</span></div>
            <p className="mt-2 text-xs text-slate-500 group-hover:text-slate-300">{item.effect}</p>
            <p className="mt-3 font-mono text-[10px] text-amber-300">CONSUME / APPLY →</p>
          </button>
        ))}
      </div>
    </section>
  );
}
