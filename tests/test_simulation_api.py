import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

from engine.reward_optimizer import compute_pof_score
from engine.simulation_api import app

client = TestClient(app)


def test_pof_endpoint_ok_and_coerces():
    r = client.post("/simulation/pof", json={
        "knot_crossing": "3", "tension_stress": 1.7, "topology_phase": "Trend", "beef_ratio": 0.7})
    assert r.status_code == 200
    body = r.json()
    assert body["unit"] == "$MEAT" and body["score"] >= 0
    assert body["oracle"]["tension_stress"] == 1.0
    assert any("clamped" in w for w in body["warnings"])
    assert {s["scenario"]["id"] for s in body["scenarios"]} == {"btc_ath", "covid_2020_03"}


def test_pof_endpoint_validation_errors():
    r = client.post("/simulation/pof", json={"tension_stress": "x", "scenario": "nope"})
    assert r.status_code == 422
    assert len(r.json()["detail"]["errors"]) >= 2


def test_beef_multiplier_and_liquidation():
    hi = compute_pof_score(10, 1.0, 0.9, 1, 0.8, 0.9, 0.0)
    lo = compute_pof_score(10, 1.0, 0.1, 1, 0.8, 0.9, 0.0)
    assert hi["finalScore"] > lo["finalScore"] == 10
    assert compute_pof_score(10, 1.0, 0.1, 10, 0.5, 0.1, 0.0)["finalScore"] < 10
    assert compute_pof_score(10, 0.0, 0.1, 10, 0.5, 0.1, 0.0)["finalScore"] == 10
