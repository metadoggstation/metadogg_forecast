"""FastAPI backend for Simulation Mode (NDJSON streaming).

Run:  uvicorn engine.simulation_api:app --port 8000

GET /simulation/scenarios                       -> scenario list with bar counts
GET /simulation/stream?scenario=&start=&speed=&lookback=  -> application/x-ndjson, one tick per line

POST /simulation/pof  {knot_crossing, tension_stress, topology_phase, beef_ratio?, scenario?}
    -> {score, unit, breakdown, warnings, errors, scenarios[]}; scenario omitted = all scenarios (averaged).

Pause = close the stream; resume/seek = reopen with `start` = desired index.
`lookback` emits that many earlier bars first without delay (chart history after a seek).
`speed` (1,2,4,10..) divides the base tick interval (`interval` seconds, default 0.5).
"""
import asyncio
import json
import math

from typing import Any, Optional

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from engine.simulation import SCENARIOS, generate_ticks, load_bars, run_pof_backtest

app = FastAPI(title="METADOGG FORECAST Simulation")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"])


@app.get("/simulation/scenarios")
def scenarios():
    return [{"id": k, "label": v["label"], "total": len(load_bars(k))} for k, v in SCENARIOS.items()]


@app.get("/simulation/stream")
async def stream(scenario: str, start: int = 0, speed: float = 1.0, interval: float = 0.5, lookback: int = 0):
    if scenario not in SCENARIOS:
        raise HTTPException(404, "unknown scenario")
    delay = max(interval, 0.0) / max(speed, 0.1)

    async def body():
        first = max(0, start - max(lookback, 0))
        for tick in generate_ticks(scenario, first):
            yield json.dumps(tick) + "\n"
            if delay and tick["index"] >= start:
                await asyncio.sleep(delay)

    return StreamingResponse(body(), media_type="application/x-ndjson")


TOPOLOGY_PHASES = {"trend", "range", "expansion", "contraction", "unknown"}
MAX_TENSION_STRESS = 1.0


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def parse_oracle_payload(payload: Any) -> tuple:
    """Validate/coerce an Oracle knot payload -> (clean dict, warnings, errors)."""
    warnings, errors = [], []
    if not isinstance(payload, dict):
        return {}, warnings, ["payload must be a JSON object"]

    crossing = _number(payload.get("knot_crossing"))
    if crossing is None or crossing < 0:
        errors.append("knot_crossing must be a non-negative number")
    elif crossing != int(crossing):
        warnings.append("knot_crossing was rounded to an integer")
    tension = _number(payload.get("tension_stress"))
    if tension is None:
        errors.append("tension_stress must be a number")
    elif not 0.0 <= tension <= MAX_TENSION_STRESS:
        warnings.append("tension_stress clamped to [0, 1]")
        tension = min(max(tension, 0.0), MAX_TENSION_STRESS)

    phase = payload.get("topology_phase")
    phase = str(phase).strip().lower() if phase is not None else ""
    if phase not in TOPOLOGY_PHASES:
        warnings.append("topology_phase %r is not recognised; using 'unknown'" % (phase or None))
        phase = "unknown"

    beef = _number(payload.get("beef_ratio", 0.5))
    if beef is None:
        errors.append("beef_ratio must be a number")
    elif not 0.0 <= beef <= 1.0:
        warnings.append("beef_ratio clamped to [0, 1]")
        beef = min(max(beef, 0.0), 1.0)

    scenario = payload.get("scenario")
    if scenario is not None and scenario not in SCENARIOS:
        errors.append("unknown scenario %r" % (scenario,))

    if errors:
        return {}, warnings, errors
    return {"knot_crossing": int(round(crossing)), "tension_stress": tension,
            "topology_phase": phase, "beef_ratio": beef, "scenario": scenario}, warnings, errors


@app.post("/simulation/pof")
def proof_of_forecast(payload: Any = Body(...)):
    clean, warnings, errors = parse_oracle_payload(payload)
    if errors:
        raise HTTPException(422, {"errors": errors, "warnings": warnings})
    ids = [clean["scenario"]] if clean["scenario"] else list(SCENARIOS)
    runs = [run_pof_backtest(i, clean["beef_ratio"], clean["knot_crossing"],
                             clean["tension_stress"], clean["topology_phase"]) for i in ids]
    keys = ("baseReward", "beefMultiplier", "liquidationPenalty", "defenseBonus", "finalScore")
    breakdown = {k: sum(r["breakdown"][k] for r in runs) / len(runs) for k in keys}
    return {
        "score": sum(r["score"] for r in runs) / len(runs),
        "unit": "$MEAT",
        "breakdown": breakdown,
        "warnings": warnings,
        "errors": [],
        "oracle": runs[0]["oracle"],
        "chamber": runs[0]["chamber"],
        "scenarios": runs,
    }
