"""二重メモリ投影エンジン: 🥩Beef(マクロ) と 🍗Chicken(ミクロ) を合成して N 本先のレンジを算出する。"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional


@dataclass
class StrategyParams:
    """mu: 1本あたりの期待変化量(価格単位), sigma: 1本あたりのボラティリティ"""
    mu: float
    sigma: float


def _coerce(p) -> StrategyParams:
    if isinstance(p, StrategyParams):
        return p
    return StrategyParams(mu=float(p["mu"]), sigma=float(p["sigma"]))


def calculate_n_candle_box(
    last_close: float,
    beef,
    chicken,
    n: int = 2,
    w_beef: float = 0.6,
    kappa_trick: float = 1.0,
    rng: Optional[random.Random] = None,
    trick_prob: float = 0.0,
) -> List[Dict[str, float]]:
    """t+1..t+n の予測ボックスを返す。

    mu_k    = (w_B * mu_B + w_C * mu_C) * k          (ウェイト合成の期待値)
    range_k = kappa * sqrt(sigma_B^2 + sigma_C^2) * sqrt(k)
    center  = last_close + mu_k ; High/Low = center ± range_k
    kappa_trick >= 1 はAIのトリック係数(見せ板/流動性枯渇ノイズ)。
    trick_prob > 0 の場合、確率的にkappaが追加で発動(trick_active=True)する。
    """
    if n < 1:
        raise ValueError("n must be >= 1")
    if not 0.0 <= w_beef <= 1.0:
        raise ValueError("w_beef must be within [0, 1]")
    if kappa_trick < 0:
        raise ValueError("kappa_trick must be >= 0")
    b, c = _coerce(beef), _coerce(chicken)
    if b.sigma < 0 or c.sigma < 0:
        raise ValueError("sigma must be >= 0")
    rng = rng or random.Random()
    w_c = 1.0 - w_beef
    mu = w_beef * b.mu + w_c * c.mu
    base_sigma = math.sqrt(b.sigma ** 2 + c.sigma ** 2)

    boxes = []
    for k in range(1, n + 1):
        active = trick_prob > 0 and rng.random() < trick_prob
        kappa = kappa_trick if (trick_prob == 0 or active) else 1.0
        center = last_close + mu * k
        half = kappa * base_sigma * math.sqrt(k)
        boxes.append({
            "step": k,
            "center": center,
            "high": center + half,
            "low": center - half,
            "w_beef": w_beef,
            "w_chicken": w_c,
            "kappa": kappa,
            "trick_active": bool(kappa > 1.0),
        })
    return boxes


if __name__ == "__main__":
    import json
    print(json.dumps(calculate_n_candle_box(100.0, {"mu": 1.5, "sigma": 2.0}, {"mu": 0.3, "sigma": 0.5}, n=3, kappa_trick=1.3), indent=2))
