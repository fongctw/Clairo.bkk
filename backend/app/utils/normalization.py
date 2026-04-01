from typing import Iterable

import numpy as np

from app.config.scoring import CLASS_BREAKS


def min_max_normalize(values: Iterable[float]) -> np.ndarray:
    array = np.asarray(list(values), dtype=float)
    if array.size == 0:
        return array
    min_val = float(np.min(array))
    max_val = float(np.max(array))
    if np.isclose(min_val, max_val):
        return np.full_like(array, 100.0)
    return ((array - min_val) / (max_val - min_val)) * 100.0


def inverse_normalize(values: Iterable[float]) -> np.ndarray:
    return 100.0 - min_max_normalize(values)


def weighted_overlay(scores: dict[str, np.ndarray], weights: dict[str, float]) -> np.ndarray:
    total_weight = sum(weights.values()) or 1.0
    combined = np.zeros_like(next(iter(scores.values())), dtype=float)
    for key, array in scores.items():
        combined += array * (weights[key] / total_weight)
    return combined


def classify_score(score: float) -> str:
    for threshold, label in CLASS_BREAKS:
        if score >= threshold:
            return label
    return "Very Low"

