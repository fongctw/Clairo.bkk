import numpy as np

from app.utils.normalization import classify_score, inverse_normalize, min_max_normalize, weighted_overlay


def test_min_max_normalize_returns_0_to_100():
    values = [1, 2, 3]
    normalized = min_max_normalize(values)
    assert np.allclose(normalized, np.array([0.0, 50.0, 100.0]))


def test_inverse_normalize_inverts_scale():
    values = [10, 20, 30]
    normalized = inverse_normalize(values)
    assert np.allclose(normalized, np.array([100.0, 50.0, 0.0]))


def test_weighted_overlay_combines_scores():
    scores = {
        "greenness": np.array([80.0]),
        "pm25": np.array([50.0]),
        "distance": np.array([100.0]),
    }
    weights = {"greenness": 45.0, "pm25": 35.0, "distance": 20.0}
    result = weighted_overlay(scores, weights)
    assert np.isclose(result[0], 69.5)


def test_classify_score_matches_breaks():
    assert classify_score(85.0) == "Very High"
    assert classify_score(65.0) == "High"
    assert classify_score(45.0) == "Moderate"

