import math

import pytest

from engine.reward_optimizer import compute_reward
from engine.simulation import VirtualTrader, generate_ticks, load_bars, tune_params


def bar(o, h, l, c):
    return {"open": o, "high": h, "low": l, "close": c, "volume": 1}


def test_entry_then_take_profit():
    t = VirtualTrader()
    assert t.on_bar(bar(100, 101, 99, 101), 0.5, 100) is None
    assert t.on_bar(bar(100, 101, 99, 101), 1.2, 100)["event"] == "entry"
    ex = t.on_bar(bar(101, 110, 101, 109), 0.0, 101)
    assert ex["result"] == "win" and math.isclose(ex["pnl"], 0.015)


def test_stop_loss_and_tie_prefers_sl():
    t = VirtualTrader()
    t.on_bar(bar(100, 101, 99, 100), 2, 99)
    ex = t.on_bar(bar(100, 120, 90, 100), 0, 100)
    assert ex["result"] == "loss" and math.isclose(ex["pnl"], -0.01)


def test_time_exit():
    t = VirtualTrader(max_hold=2)
    t.on_bar(bar(100, 100, 100, 100), 2, 99)
    assert t.on_bar(bar(100, 100.5, 99.5, 100.2), 0, 100) is None
    assert t.on_bar(bar(100, 100.5, 99.5, 100.2), 0, 100)["event"] == "exit"


def test_score_matches_reward_optimizer():
    t = VirtualTrader()
    t.pnls = [0.02, 0.02, -0.01]
    s = t.score()
    assert math.isclose(s["totalReward"], compute_reward(0.02, 0.01, 2))
    assert VirtualTrader().score()["totalReward"] == 0.0


def test_stream_shape_and_determinism():
    ticks = list(generate_ticks("covid_2020_03"))
    assert len(ticks) == ticks[0]["total"]
    k = ticks[50]
    assert set(k) >= {"index", "ohlcv", "sdf", "forecast", "tuning", "score", "trade"}
    assert set(k["forecast"]) == {"macd1m", "bb1h", "knot4h"}
    assert all(b["low"] < b["high"] for b in k["forecast"]["bb1h"])
    assert len(k["tuning"]) == 5
    assert ticks == list(generate_ticks("covid_2020_03"))


def test_seek_preserves_score_and_has_trades():
    full = list(generate_ticks("btc_ath"))
    seek = list(generate_ticks("btc_ath", start=120))
    assert seek[0]["index"] == 120 and seek[0]["score"] == full[120]["score"]
    assert seek[-1]["score"] == full[-1]["score"]
    assert full[-1]["score"]["wins"] + full[-1]["score"]["losses"] > 0


def test_tune_params_range_and_previous():
    out = tune_params(1.3, 0.8, [1, 2, 3, 4, 5])
    assert [o["previous"] for o in out] == [1, 2, 3, 4, 5]
    assert all(o["min"] <= o["value"] <= o["max"] for o in out)


def test_stream_endpoint():
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient
    from engine.simulation_api import app
    c = TestClient(app)
    assert len(c.get("/simulation/scenarios").json()) == 2
    r = c.get("/simulation/stream", params={"scenario": "btc_ath", "start": 235, "interval": 0})
    lines = r.text.strip().split("\n")
    assert len(lines) == len(load_bars("btc_ath")) - 235
    assert c.get("/simulation/stream", params={"scenario": "x"}).status_code == 404
    r = c.get("/simulation/stream", params={"scenario": "btc_ath", "start": 100, "lookback": 30, "interval": 0})
    assert r.text.strip().split("\n")[0].startswith('{"index": 70,')
