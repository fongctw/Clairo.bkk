from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point, Polygon


def create_mock_study_area() -> gpd.GeoDataFrame:
    polygon = Polygon(
        [
            (100.32, 13.62),
            (100.85, 13.62),
            (100.85, 13.98),
            (100.32, 13.98),
            (100.32, 13.62),
        ]
    )
    return gpd.GeoDataFrame(
        [{"name": "Bangkok Metropolitan Area", "id": "bma"}],
        geometry=[polygon],
        crs="EPSG:4326",
    )


def create_mock_green_spaces() -> gpd.GeoDataFrame:
    polygons = [
        Polygon([(100.47, 13.72), (100.50, 13.72), (100.50, 13.75), (100.47, 13.75)]),
        Polygon([(100.55, 13.73), (100.59, 13.73), (100.59, 13.77), (100.55, 13.77)]),
        Polygon([(100.66, 13.80), (100.69, 13.80), (100.69, 13.83), (100.66, 13.83)]),
    ]
    return gpd.GeoDataFrame(
        [
            {"name": "Lumphini-style Park", "type": "urban_park"},
            {"name": "Chatuchak-style Park", "type": "metropolitan_park"},
            {"name": "Riverside Green Belt", "type": "green_belt"},
        ],
        geometry=polygons,
        crs="EPSG:4326",
    )


def create_mock_pollution_sources() -> gpd.GeoDataFrame:
    points = [Point(100.61, 13.70), Point(100.72, 13.76), Point(100.45, 13.84)]
    return gpd.GeoDataFrame(
        [
            {"name": "Industrial Cluster A", "category": "industry"},
            {"name": "Major Traffic Corridor", "category": "traffic"},
            {"name": "Industrial Cluster B", "category": "industry"},
        ],
        geometry=points,
        crs="EPSG:4326",
    )


def create_mock_pm25() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": "pm01", "name": "Bang Na", "longitude": 100.62, "latitude": 13.67, "pm25": 32.0},
            {"id": "pm02", "name": "Dusit", "longitude": 100.52, "latitude": 13.78, "pm25": 25.0},
            {"id": "pm03", "name": "Nonthaburi", "longitude": 100.48, "latitude": 13.88, "pm25": 22.0},
            {"id": "pm04", "name": "Lat Krabang", "longitude": 100.78, "latitude": 13.73, "pm25": 35.0},
            {"id": "pm05", "name": "Pathum Thani", "longitude": 100.60, "latitude": 13.96, "pm25": 24.0},
        ]
    )


def ensure_sample_files(data_root: Path) -> None:
    data_root.mkdir(parents=True, exist_ok=True)
    boundary_dir = data_root / "boundaries"
    green_dir = data_root / "green_spaces"
    pollution_dir = data_root / "pollution"
    pm25_dir = data_root / "pm25"
    output_dir = data_root / "output"
    for directory in [boundary_dir, green_dir, pollution_dir, pm25_dir, output_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    boundary_path = boundary_dir / "bangkok_study_area.geojson"
    green_path = green_dir / "parks.geojson"
    pollution_path = pollution_dir / "pollution_sources.geojson"
    pm25_path = pm25_dir / "pm25_stations.csv"

    if not boundary_path.exists():
        create_mock_study_area().to_file(boundary_path, driver="GeoJSON")
    if not green_path.exists():
        create_mock_green_spaces().to_file(green_path, driver="GeoJSON")
    if not pollution_path.exists():
        create_mock_pollution_sources().to_file(pollution_path, driver="GeoJSON")
    if not pm25_path.exists():
        create_mock_pm25().to_csv(pm25_path, index=False)


def synthetic_ndvi(lons: np.ndarray, lats: np.ndarray) -> np.ndarray:
    lon_center = np.mean(lons)
    lat_center = np.mean(lats)
    distance = np.sqrt((lons - lon_center) ** 2 + (lats - lat_center) ** 2)
    gradient = 0.75 - distance * 1.8
    noise = np.sin(lons * 12) * 0.05 + np.cos(lats * 14) * 0.04
    return np.clip(gradient + noise, 0.15, 0.88)

