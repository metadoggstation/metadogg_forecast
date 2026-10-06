"""FastAPI backend for Simulation Mode (NDJSON streaming).

Run:  uvicorn engine.simulation_api:app --port 8000

GET /simulation/scenarios                       -> scenario list with bar counts
GET /simulation/stream?scenario=&start=&speed=&lookback=  -> application/x-ndjson, one tick per line

Pause = close the stream; resume/seek = reopen with `start` = desired index.
`lookback` emits that many earlier bars first without delay (chart history after a seek).
`speed` (1,2,4,10..) divides the base tick interval (`interval` seconds, default 0.5).
"""
import asyncio
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from engine.simulation import SCENARIOS, generate_ticks, load_bars

app = FastAPI(title="METADOGG FORECAST Simulation")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])


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
