from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import geopandas as gpd
import httpx
import pandas as pd
from shapely.geometry import Point

from app.config.settings import get_settings
from app.utils.mock_data import (
    create_mock_green_spaces,
    create_mock_pm25,
    create_mock_pollution_sources,
    create_mock_study_area,
    ensure_sample_files,
)

logger = logging.getLogger(__name__)


class DataRepository:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.data_root = Path(self.settings.data_root)
        self.target_crs = self.settings.target_crs
        ensure_sample_files(self.data_root)

    def _map_air4thai_station(self, station: dict[str, Any]) -> dict[str, Any] | None:
        lat = station.get("lat")
        lon = station.get("long")
        latest = station.get("AQILast") or {}
        pm25 = (latest.get("PM25") or {}).get("value")
        date = latest.get("date")
        time = latest.get("time")

        if lat in (None, "") or lon in (None, "") or pm25 in (None, "", "-1"):
            return None

        try:
            latitude = float(lat)
            longitude = float(lon)
            pm25_value = float(pm25)
        except (TypeError, ValueError):
            return None

        if pm25_value < 0:
            return None

        timestamp = f"{date} {time}".strip() if date or time else None
        return {
            "id": station.get("stationID", ""),
            "name": station.get("nameEN") or station.get("nameTH") or station.get("stationID", "Unknown station"),
            "area": station.get("areaEN") or station.get("areaTH"),
            "stationType": station.get("stationType"),
            "latitude": latitude,
            "longitude": longitude,
            "pm25": pm25_value,
            "timestamp": timestamp,
            "source": "Air4Thai",
        }

    def fetch_live_pm25(self) -> pd.DataFrame | None:
        if not self.settings.use_live_pm25:
            return None

        try:
            with httpx.Client(timeout=self.settings.air4thai_timeout_seconds) as client:
                response = client.get(self.settings.air4thai_region_url)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Air4Thai fetch failed, falling back to local PM2.5 CSV: %s", exc)
            return None

        stations = payload.get("stations")
        if not isinstance(stations, list):
            logger.warning("Air4Thai payload missing stations list, falling back to local PM2.5 CSV")
            return None

        rows = [mapped for station in stations if (mapped := self._map_air4thai_station(station)) is not None]
        if not rows:
            logger.warning("Air4Thai payload had no valid PM2.5 stations, falling back to local PM2.5 CSV")
            return None

        return pd.DataFrame(rows)

    def _resolve_vector(self, folder: str) -> Path | None:
        directory = self.data_root / folder
        if not directory.exists():
            return None
        for pattern in ("*.geojson", "*.shp"):
            matches = list(directory.glob(pattern))
            if matches:
                return matches[0]
        return None

    def _read_vector(self, folder: str, fallback: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        path = self._resolve_vector(folder)
        gdf = gpd.read_file(path) if path else fallback
        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        return gdf.to_crs(self.target_crs)

    def load_study_areas(self) -> gpd.GeoDataFrame:
        return self._read_vector("boundaries", create_mock_study_area())

    def load_green_spaces(self) -> gpd.GeoDataFrame:
        return self._read_vector("green_spaces", create_mock_green_spaces())

    def load_pollution_sources(self) -> gpd.GeoDataFrame:
        return self._read_vector("pollution", create_mock_pollution_sources())

    def load_pm25(self) -> gpd.GeoDataFrame:
        live_frame = self.fetch_live_pm25()
        csv_path = next((self.data_root / "pm25").glob("*.csv"), None)
        frame = live_frame if live_frame is not None else (pd.read_csv(csv_path) if csv_path else create_mock_pm25())
        geometry = [Point(xy) for xy in zip(frame["longitude"], frame["latitude"])]
        gdf = gpd.GeoDataFrame(frame, geometry=geometry, crs="EPSG:4326")
        return gdf.to_crs(self.target_crs)
