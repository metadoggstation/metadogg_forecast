"""Reward function for AI indicator tuning (backtest engine).

Total_Reward = (Average_Win / Average_Loss) * (Total_Wins ** 1.2)
"""
from dataclasses import dataclass
from typing import Iterable, Sequence

WIN_EXPONENT = 1.2
EPSILON = 1e-9


@dataclass(frozen=True)
class BacktestStats:
    total_wins: int
    total_losses: int
    average_win: float
    average_loss: float  # positive magnitude

    @property
    def win_rate(self) -> float:
        n = self.total_wins + self.total_losses
        return self.total_wins / n if n else 0.0


def summarize_trades(pnls: Iterable[float]) -> BacktestStats:
    """Build stats from per-trade PnL values (positive = win, negative = loss)."""
    pnls = list(pnls)
    wins = [p for p in pnls if p > 0]
    losses = [-p for p in pnls if p < 0]
    return BacktestStats(
        total_wins=len(wins),
        total_losses=len(losses),
        average_win=sum(wins) / len(wins) if wins else 0.0,
        average_loss=sum(losses) / len(losses) if losses else 0.0,
    )


def compute_reward(
    average_win: float,
    average_loss: float,
    total_wins: int,
    exponent: float = WIN_EXPONENT,
) -> float:
    """Total_Reward = (Average_Win / Average_Loss) * (Total_Wins ^ 1.2).

    The superlinear win-count term favours repeated, reliable wins over a
    single large profit.
    """
    if total_wins <= 0 or average_win <= 0:
        return 0.0
    return (average_win / max(abs(average_loss), EPSILON)) * (total_wins ** exponent)


def reward_from_trades(pnls: Iterable[float]) -> float:
    s = summarize_trades(pnls)
    return compute_reward(s.average_win, s.average_loss, s.total_wins)


def select_best_params(candidates: Sequence[dict], backtest) -> tuple:
    """Pick the parameter set maximising the reward.

    `backtest(params)` must return an iterable of per-trade PnL values.
    Returns (best_params, best_reward); (None, 0.0) if no candidates.
    """
    best, best_r = None, float("-inf")
    for params in candidates:
        r = reward_from_trades(backtest(params))
        if r > best_r:
            best, best_r = params, r
    return (best, best_r) if best is not None else (None, 0.0)
