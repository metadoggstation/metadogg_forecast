import math
from engine.reward_optimizer import compute_reward, reward_from_trades, select_best_params


def test_formula():
    assert math.isclose(compute_reward(2, 1, 10), 2 * 10 ** 1.2)


def test_no_wins_zero():
    assert reward_from_trades([-1, -2]) == 0.0


def test_consistency_beats_single_big_win():
    assert reward_from_trades([1] * 20 + [-1] * 5) > reward_from_trades([20, -1, -1, -1])


def test_select_best():
    best, _ = select_best_params([{"a": 1}, {"a": 2}], lambda p: [1] * 10 + [-1] if p["a"] == 2 else [5, -1])
    assert best == {"a": 2}
