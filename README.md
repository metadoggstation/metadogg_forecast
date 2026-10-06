# METADOGG FORECAST

## Simulation Mode (シミュレーション・モード)

Replay historical charts (COVID shock Mar 2020, BTC all-time high) while the Oracle's dynamic tuning and a live
"総合魔力スコア" (reward from `engine/reward_optimizer.py`) update tick by tick.

### Run

```bash
pip install fastapi uvicorn pytest httpx
uvicorn engine.simulation_api:app --port 8000      # streaming backend (FastAPI, NDJSON)
python -m pytest tests                              # backend tests
```

The repo has no frontend toolchain. Drop `app/`, `components/`, `lib/` into a Next.js (App Router, React) project and open
`/simulation`. Set `NEXT_PUBLIC_SIM_API` if the backend is not at `http://localhost:8000`.
Sample CSVs in `data/simulation/` are synthetic fixtures shaped like the named scenarios (not real market data).

### Backend API (FastAPI, chosen over a Next.js route)

- `GET /simulation/scenarios` → `[{id, label, total}]`
- `GET /simulation/stream?scenario=&start=0&speed=1&lookback=0&interval=0.5` → `application/x-ndjson`, one tick per line,
  delayed by `interval / speed` seconds. **Pause** = close the stream; **resume/seek** = reopen with `start=<index>`;
  `lookback=N` sends N earlier bars instantly so the chart has history. Trades/score are always replayed from bar 0, so
  the score is identical wherever you seek.

### Tick payload (`lib/simulationTypes.ts` `TickPayload`)

| field | meaning |
|---|---|
| `index`, `total`, `scenario` | position in dataset |
| `ohlcv` | `{t, open, high, low, close, volume}` |
| `sdf`, `gravityTensor` | SDF distance (|close−SMA20| / 2σ; ≥1 = fully warped) and range/ATR (placeholders: `compute_sdf`) |
| `forecast` | `{macd1m, bb1h, knot4h}` each `[{low, high}]` (shape of `ForecastSet`; placeholder `build_forecast`) |
| `tuning` | `[{indicator, name, previous, value, min, max}]` for MACD/RSI/BB (placeholder `tune_params`) |
| `trade` | `null` or `{event: entry\|exit, side, entryPrice, exitPrice, pnl, result}` |
| `score` | `{wins, losses, winRate, averageWin, averageLoss, riskReward, totalReward}` |

Virtual trader (`VirtualTrader`): enter when `sdf >= 1.0`, exit at TP +1.5% / SL −1% (SL wins ties) or after 8 ticks.
`totalReward` is computed by `compute_reward` in Python, so no TypeScript port is needed.

### UI

`PlaybackController` (play/pause/step/x2·x4·x10/seek bar, bottom), `LiveScoreBoard` (top, count-up animation),
`ForecastLiveChart` + `TuningMatrixPanel` (middle). New optional props, backwards compatible: `turbo` (flicker/morph at
fast-forward) on both, `tuned` on the panel (externally supplied values), `hidePanel` on the chart.
