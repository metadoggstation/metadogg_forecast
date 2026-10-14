export interface MechanicTandemProps {
  isRenting: boolean;
  beefRatio: number;
  chickenRatio: number;
  mechanicName?: string;
}

function Meter({ label, value, textColor, barColor }: { label: string; value: number; textColor: string; barColor: string }) {
  return (
    <div className="font-mono text-[10px]">
      <div className="mb-1 flex justify-between text-slate-500"><span>{label}</span><span className={textColor}>{Math.round(value * 100)}%</span></div>
      <div className="h-1.5 bg-slate-800"><div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>
    </div>
  );
}

export default function MechanicTandem({ isRenting, beefRatio, chickenRatio, mechanicName = "PATCH // DEV DOG" }: MechanicTandemProps) {
  return (
    <section className="rounded-[1.5rem] border border-slate-700 bg-[#0b101a] p-5">
      <div className="flex items-center justify-between">
        <div><p className="font-mono text-[10px] tracking-[0.3em] text-slate-500">ERC-4907 // TANDEM SEAT</p><h2 className="mt-1 text-lg font-bold text-slate-100">PASSENGER PROTOCOL</h2></div>
        <span className={`rounded-full px-2 py-1 font-mono text-[10px] ${isRenting ? "bg-fuchsia-400/10 text-fuchsia-300" : "bg-slate-800 text-slate-500"}`}>{isRenting ? "RENTED" : "OWNER MODE"}</span>
      </div>
      <div className="mt-5 min-h-44 rounded-xl border border-dashed border-slate-700 bg-black/25 p-4">
        {isRenting ? (
          <div className="flex items-center gap-4">
            <div className="relative grid h-28 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-b from-fuchsia-500/20 to-cyan-500/10">
              <div className="absolute top-4 h-12 w-12 rounded-full border-4 border-cyan-200/80 bg-slate-900 shadow-[0_0_18px_rgba(125,249,255,0.35)]" />
              <div className="absolute bottom-[-8px] h-20 w-20 rounded-[45%] border-4 border-fuchsia-300/70 bg-slate-900" />
              <span className="absolute bottom-2 font-mono text-[8px] text-cyan-200">MECHANIC</span>
            </div>
            <div className="min-w-0 flex-1"><p className="font-mono text-xs text-fuchsia-300">{mechanicName}</p><p className="mt-1 text-sm text-slate-300">Your rented unit has a co-pilot.</p><div className="mt-4 space-y-3"><Meter label="🥩 BEEF MEMORY" value={beefRatio} textColor="text-fuchsia-300" barColor="bg-fuchsia-300" /><Meter label="🍗 CHICKEN MEMORY" value={chickenRatio} textColor="text-amber-300" barColor="bg-amber-300" /></div></div>
          </div>
        ) : (
          <div className="grid h-36 place-items-center text-center"><div><div className="text-4xl text-slate-700">＋</div><p className="mt-2 font-mono text-xs text-slate-500">SEAT EMPTY / OWNER DRIVING</p><p className="mt-1 text-xs text-slate-600">Rent a stronger dog to unlock tandem telemetry.</p></div></div>
        )}
      </div>
    </section>
  );
}
