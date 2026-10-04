"""Simulation Mode engine: replays historical bars and emits tick payloads.

SDF / forecast / tuning are deterministic placeholders, each isolated behind
one function (compute_sdf, build_forecast, tune_params) so they can be swapped
for the real Oracle logic. Reward maths is delegated to engine.reward_optimizer.
"""
import csv
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterator, List, Optional

from engine.reward_optimizer import compute_reward, summarize_trades

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "simulation"

SCENARIOS: Dict[str, dict] = {
    "covid_2020_03": {"label": "COVID SHOCK (Mar 2020)", "file": "covid_2020_03.csv"},
    "btc_ath": {"label": "BTC ALL-TIME HIGH", "file": "btc_ath.csv"},
}

SDF_WINDOW = 20
SDF_THRESHOLD = 1.0       # entry when the space is fully "warped"
TAKE_PROFIT = 0.015
STOP_LOSS = 0.01
MAX_HOLD_TICKS = 8
FORECAST_STEPS = 5

# (indicator, name, default, min, max) -- mirrors DEFAULT_PARAMS in TuningMatrixPanel.tsx
PARAM_SPECS = [
    ("MACD", "Fast", 12, 3, 20),
    ("MACD", "Slow", 26, 15, 60),
    ("RSI", "Period", 14, 5, 30),
    ("BB", "Period", 20, 10, 50),
    ("BB", "StdDev", 2, 1, 4),
]


def load_bars(scenario: str) -> List[dict]:
    if scenario not in SCENARIOS:
        raise KeyError(scenario)
    with open(DATA_DIR / SCENARIOS[scenario]["file"], newline="") as f:
        return [
            {
                "t": r["timestamp"],
                "open": float(r["open"]), "high": float(r["high"]),
                "low": float(r["low"]), "close": float(r["close"]),
                "volume": float(r["volume"]),
            }
            for r in csv.DictReader(f)
        ]


def compute_sdf(bars: List[dict], i: int) -> tuple:
    """Placeholder SDF: distance of close from the SMA in units of 2 sigma
    (>=1 means outside the Bollinger band), and a gravity tensor (range / ATR)."""
    window = bars[max(0, i - SDF_WINDOW + 1): i + 1]
    closes = [b["close"] for b in window]
    mean = sum(closes) / len(closes)
    std = math.sqrt(sum((c - mean) ** 2 for c in closes) / len(closes))
    sdf = abs(bars[i]["close"] - mean) / (2 * std) if std > 1e-12 else 0.0
    atr = sum(b["high"] - b["low"] for b in window) / len(window)
    gravity = (bars[i]["high"] - bars[i]["low"]) / atr if atr > 1e-12 else 0.0
    return sdf, gravity


def build_forecast(bars: List[dict], i: int, sdf: float) -> dict:
    """Placeholder prediction boxes (shape of ForecastSet in ForecastLiveChart.tsx)."""
    window = bars[max(0, i - SDF_WINDOW + 1): i + 1]
    atr = sum(b["high"] - b["low"] for b in window) / len(window)
    prev = bars[max(0, i - 5)]["close"]
    drift = (bars[i]["close"] - prev) / 5
    close = bars[i]["close"]
    layers = {"macd1m": (0.5, 0.3), "bb1h": (1.0, 0.6), "knot4h": (1.6, 1.0)}
    out = {}
    for key, (width, drift_w) in layers.items():
        boxes = []
        for s in range(FORECAST_STEPS):
            centre = close + drift * drift_w * (s + 1)
            half = atr * width * math.sqrt(s + 1) * (1 + 0.25 * min(sdf, 2.0))
            boxes.append({"low": round(centre - half, 4), "high": round(centre + half, 4)})
        out[key] = boxes
    return out


def tune_params(sdf: float, gravity: float, previous: Optional[List[float]] = None) -> List[dict]:
    """Deterministic tuning; same formula as tuneValue() in TuningMatrixPanel.tsx."""
    prev = previous or [spec[2] for spec in PARAM_SPECS]
    out = []
    for idx, (ind, name, _default, lo, hi) in enumerate(PARAM_SPECS):
        phase = abs(math.sin(sdf * (idx + 1.7) + gravity * (idx + 0.3)))
        raw = lo + phase * (hi - lo)
        value = math.floor(raw * 10 + 0.5) / 10 if hi <= 5 else math.floor(raw + 0.5)
        out.append({"indicator": ind, "name": name, "previous": prev[idx],
                    "value": value, "min": lo, "max": hi})
    return out


@dataclass
class _Open:
    side: int
    entry: float
    age: int = 0


@dataclass
class VirtualTrader:
    """Enter when sdf >= threshold, exit on TP/SL (SL wins ties) or after max_hold ticks."""
    threshold: float = SDF_THRESHOLD
    take_profit: float = TAKE_PROFIT
    stop_loss: float = STOP_LOSS
    max_hold: int = MAX_HOLD_TICKS
    pnls: List[float] = field(default_factory=list)
    position: Optional[_Open] = None

    def on_bar(self, bar: dict, sdf: float, prev_close: Optional[float]) -> Optional[dict]:
        pos = self.position
        if pos is not None:
            pos.age += 1
            hi, lo = bar["high"], bar["low"]
            tp = pos.entry * (1 + self.take_profit * pos.side)
            sl = pos.entry * (1 - self.stop_loss * pos.side)
            hit_sl = lo <= sl if pos.side > 0 else hi >= sl
            hit_tp = hi >= tp if pos.side > 0 else lo <= tp
            exit_price = None
            if hit_sl:
                exit_price = sl
            elif hit_tp:
                exit_price = tp
            elif pos.age >= self.max_hold:
                exit_price = bar["close"]
            if exit_price is None:
                return None
            # PnL as a fraction of entry so scenarios are comparable
            pnl = (exit_price - pos.entry) / pos.entry * pos.side
            self.pnls.append(pnl)
            self.position = None
            return {"event": "exit", "side": "long" if pos.side > 0 else "short",
                    "entryPrice": pos.entry, "exitPrice": exit_price, "pnl": pnl,
                    "result": "win" if pnl > 0 else "loss"}
        if sdf >= self.threshold and prev_close is not None:
            side = 1 if bar["close"] >= prev_close else -1
            self.position = _Open(side=side, entry=bar["close"])
            return {"event": "entry", "side": "long" if side > 0 else "short",
                    "entryPrice": bar["close"], "exitPrice": None, "pnl": None, "result": None}
        return None

    def score(self) -> dict:
        s = summarize_trades(self.pnls)
        rr = s.average_win / s.average_loss if s.average_loss > 0 else 0.0
        return {
            "wins": s.total_wins, "losses": s.total_losses, "winRate": s.win_rate,
            "averageWin": s.average_win, "averageLoss": s.average_loss, "riskReward": rr,
            "totalReward": compute_reward(s.average_win, s.average_loss, s.total_wins),
        }


def generate_ticks(scenario: str, start: int = 0, bars: Optional[List[dict]] = None) -> Iterator[dict]:
    """Yield one payload per bar from `start`. Bars before `start` are replayed
    silently so trades/score are identical regardless of where you seek."""
    bars = bars if bars is not None else load_bars(scenario)
    total = len(bars)
    start = max(0, min(int(start), total))
    trader = VirtualTrader()
    prev_tuning: Optional[List[float]] = None
    for i in range(total):
        sdf, gravity = compute_sdf(bars, i)
        prev_close = bars[i - 1]["close"] if i > 0 else None
        trade = trader.on_bar(bars[i], sdf, prev_close)
        tuning = tune_params(sdf, gravity, prev_tuning)
        prev_tuning = [t["value"] for t in tuning]
        if i < start:
            continue
        b = bars[i]
        yield {
            "index": i, "total": total, "scenario": scenario,
            "ohlcv": {"t": b["t"], "open": b["open"], "high": b["high"], "low": b["low"],
                      "close": b["close"], "volume": b["volume"]},
            "sdf": sdf, "gravityTensor": gravity,
            "forecast": build_forecast(bars, i, sdf),
            "tuning": tuning,
            "trade": trade,
            "score": trader.score(),
        }
