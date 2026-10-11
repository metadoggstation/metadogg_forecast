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


# --- Proof of Forecast ($MEAT) scoring: beef = trend-following, chicken = defensive ---
BEEF_TENSION_MIN = 0.6        # tension_stress at/above which beef earns the multiplier
BEEF_MULTIPLIER_MAX = 1.5     # max extra multiplier (applied at beef=1, tension=1)
LIQUIDATE_CROSSING_MIN = 5    # knot_crossing at/above which a range market is "tangled"
LIQUIDATE_BEEF_MIN = 0.6      # beef ratio considered over-aggressive
LIQUIDATE_MAX_PENALTY = 0.5   # max fraction of base reward removed
RANGE_EFFICIENCY_MAX = 0.3    # |net move| / path length below this = range-bound
CRASH_DRAWDOWN_MIN = 0.10     # market drawdown that makes a dataset a "crash"
DEFENSE_BONUS_WEIGHT = 100.0  # $MEAT per unit of avoided drawdown


def compute_pof_score(
    base_reward: float,
    beef_ratio: float,
    tension_stress: float,
    knot_crossing: int,
    continuation_rate: float,
    efficiency_ratio: float,
    market_drawdown: float,
) -> dict:
    """Combine the backtest reward with beef/chicken modifiers into a $MEAT score.

    beef_ratio in [0, 1] (chicken = 1 - beef); tension_stress in [0, 1];
    continuation_rate / efficiency_ratio in [0, 1]; market_drawdown >= 0 (fraction).
    """
    beef = min(max(beef_ratio, 0.0), 1.0)
    chicken = 1.0 - beef

    beef_multiplier = 1.0
    if tension_stress >= BEEF_TENSION_MIN and continuation_rate >= 0.5:
        beef_multiplier += (BEEF_MULTIPLIER_MAX - 1.0) * 2 * beef * tension_stress * (continuation_rate - 0.5) \
            + (BEEF_MULTIPLIER_MAX - 1.0) * beef * tension_stress * 0.5

    liquidation_penalty = 0.0
    if (efficiency_ratio < RANGE_EFFICIENCY_MAX and knot_crossing >= LIQUIDATE_CROSSING_MIN
            and beef > LIQUIDATE_BEEF_MIN):
        over = (beef - LIQUIDATE_BEEF_MIN) / (1.0 - LIQUIDATE_BEEF_MIN)
        crossing = min(knot_crossing / (2.0 * LIQUIDATE_CROSSING_MIN), 1.0)
        liquidation_penalty = LIQUIDATE_MAX_PENALTY * over * crossing

    defense_bonus = 0.0
    if market_drawdown >= CRASH_DRAWDOWN_MIN:
        defense_bonus = DEFENSE_BONUS_WEIGHT * chicken * market_drawdown

    scaled = base_reward * beef_multiplier * (1.0 - liquidation_penalty)
    return {
        "baseReward": base_reward,
        "beefMultiplier": beef_multiplier,
        "liquidationPenalty": liquidation_penalty,
        "defenseBonus": defense_bonus,
        "finalScore": max(scaled + defense_bonus, 0.0),
    }
