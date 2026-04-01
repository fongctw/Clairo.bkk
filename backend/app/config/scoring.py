DEFAULT_WEIGHTS = {
    "greenness": 45.0,
    "pm25": 35.0,
    "distance": 20.0,
}

CLASS_BREAKS = [
    (80, "Very High"),
    (60, "High"),
    (40, "Moderate"),
    (20, "Low"),
    (0, "Very Low"),
]

DEFAULT_FILTERS = {
    "minimumGreenness": 0.0,
    "maximumPm25": 100.0,
    "minimumDistanceFromSource": 0.0,
}

