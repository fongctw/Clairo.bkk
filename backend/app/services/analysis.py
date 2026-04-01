from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from shapely.geometry import box

from app.config.scoring import DEFAULT_FILTERS, DEFAULT_WEIGHTS
from app.config.settings import get_settings
from app.models.schemas import AnalysisRequest, AnalysisResponse, RankedArea, SummaryStats
from app.services.data_loader import DataRepository
from app.utils.mock_data import synthetic_ndvi
from app.utils.normalization import classify_score, inverse_normalize, min_max_normalize, weighted_overlay


class AnalysisService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.repository = DataRepository()
        self.output_dir = Path(self.settings.data_root) / "output"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._latest_result: AnalysisResponse | None = None
        self._latest_grid_gdf: gpd.GeoDataFrame | None = None

    def _build_grid(self, study_area: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        geometry = study_area.geometry.iloc[0]
        minx, miny, maxx, maxy = geometry.bounds
        step = self.settings.grid_size_meters
        cells = []
        cell_id = 1
        x_values = np.arange(minx, maxx, step)
        y_values = np.arange(miny, maxy, step)
        for x in x_values:
            for y in y_values:
                cell = box(x, y, x + step, y + step)
                if cell.intersects(geometry):
                    clipped = cell.intersection(geometry)
                    cells.append({"cell_id": f"cell-{cell_id:03d}", "geometry": clipped})
                    cell_id += 1
        return gpd.GeoDataFrame(cells, crs=study_area.crs)

    def _idw_interpolation(self, stations: gpd.GeoDataFrame, points: gpd.GeoSeries, power: float = 2.0) -> np.ndarray:
        if stations.empty:
            return np.full(len(points), 28.0)
        station_coords = np.column_stack((stations.geometry.x.values, stations.geometry.y.values))
        target_coords = np.column_stack((points.x.values, points.y.values))
        values = stations["pm25"].astype(float).to_numpy()
        results = []
        for tx, ty in target_coords:
            distances = np.sqrt((station_coords[:, 0] - tx) ** 2 + (station_coords[:, 1] - ty) ** 2)
            if np.any(distances == 0):
                results.append(float(values[np.argmin(distances)]))
                continue
            weights = 1 / np.power(distances, power)
            results.append(float(np.sum(weights * values) / np.sum(weights)))
        return np.asarray(results)

    def _distance_to_sources(self, sources: gpd.GeoDataFrame, points: gpd.GeoSeries) -> np.ndarray:
        if sources.empty:
            return np.full(len(points), 5000.0)
        return np.asarray([sources.distance(point).min() for point in points], dtype=float)

    def _clip_layers(self, study_area: gpd.GeoDataFrame) -> dict[str, gpd.GeoDataFrame]:
        study_geometry = study_area.geometry.iloc[0]
        green_spaces = self.repository.load_green_spaces()
        pollution_sources = self.repository.load_pollution_sources()
        pm25 = self.repository.load_pm25()
        return {
            "green_spaces": gpd.clip(green_spaces, study_geometry),
            "pollution_sources": gpd.clip(pollution_sources, study_geometry),
            "pm25": pm25,
        }

    def _serialize_gdf(self, gdf: gpd.GeoDataFrame, fields: list[str] | None = None) -> dict[str, Any]:
        if fields:
            keep = [field for field in fields if field in gdf.columns]
            gdf = gdf[keep + ["geometry"]]
        if gdf.crs is not None and str(gdf.crs) != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")
        return json.loads(gdf.to_json())

    def _rank_area_name(self, row: Any, green_spaces: gpd.GeoDataFrame, rank: int) -> str:
        if green_spaces.empty:
            return f"Candidate Area {rank}"

        distances = green_spaces.distance(row.geometry.centroid)
        nearest_index = distances.idxmin()
        nearest = green_spaces.loc[nearest_index]
        nearest_name = nearest.get("name")
        if isinstance(nearest_name, str) and nearest_name.strip():
            return nearest_name
        return f"Candidate Area {rank}"

    def _save_outputs(self, grid: gpd.GeoDataFrame) -> dict[str, str]:
        geojson_path = self.output_dir / "suitability.geojson"
        csv_path = self.output_dir / "rankings.csv"
        export_grid = grid.to_crs("EPSG:4326") if grid.crs is not None and str(grid.crs) != "EPSG:4326" else grid
        export_grid.to_file(geojson_path, driver="GeoJSON")
        grid.drop(columns="geometry").to_csv(csv_path, index=False)
        return {"geojson": str(geojson_path), "csv": str(csv_path)}

    def run_analysis(self, request: AnalysisRequest) -> AnalysisResponse:
        weights = request.weights.model_dump() if request.weights else DEFAULT_WEIGHTS
        filters = request.filters.model_dump() if request.filters else DEFAULT_FILTERS

        study_areas = self.repository.load_study_areas()
        selected = study_areas[study_areas["name"] == request.studyArea]
        study_area = selected if not selected.empty else study_areas.iloc[[0]]
        layers = self._clip_layers(study_area)
        grid = self._build_grid(study_area)

        centroids = grid.geometry.centroid
        centroids_wgs84 = gpd.GeoSeries(centroids, crs=study_area.crs).to_crs("EPSG:4326")
        ndvi_values = synthetic_ndvi(centroids_wgs84.x.to_numpy(), centroids_wgs84.y.to_numpy())
        pm25_surface = self._idw_interpolation(layers["pm25"], centroids)
        distance_surface = self._distance_to_sources(layers["pollution_sources"], centroids)

        grid["ndvi"] = ndvi_values
        grid["pm25"] = pm25_surface
        grid["distance_m"] = distance_surface
        grid["greennessScore"] = min_max_normalize(grid["ndvi"])
        grid["pollutionScore"] = inverse_normalize(grid["pm25"])
        grid["distanceScore"] = min_max_normalize(grid["distance_m"])
        grid["totalScore"] = weighted_overlay(
            {
                "greenness": grid["greennessScore"].to_numpy(),
                "pm25": grid["pollutionScore"].to_numpy(),
                "distance": grid["distanceScore"].to_numpy(),
            },
            weights,
        )
        grid["suitabilityClass"] = grid["totalScore"].map(classify_score)
        grid = grid[
            (grid["greennessScore"] >= filters["minimumGreenness"])
            & (grid["pm25"] <= filters["maximumPm25"])
            & (grid["distance_m"] >= filters["minimumDistanceFromSource"])
        ].copy()
        if grid.empty:
            grid = self._build_grid(study_area)
            centroids = grid.geometry.centroid
            centroids_wgs84 = gpd.GeoSeries(centroids, crs=study_area.crs).to_crs("EPSG:4326")
            grid["ndvi"] = synthetic_ndvi(centroids_wgs84.x.to_numpy(), centroids_wgs84.y.to_numpy())
            grid["pm25"] = self._idw_interpolation(layers["pm25"], centroids)
            grid["distance_m"] = self._distance_to_sources(layers["pollution_sources"], centroids)
            grid["greennessScore"] = min_max_normalize(grid["ndvi"])
            grid["pollutionScore"] = inverse_normalize(grid["pm25"])
            grid["distanceScore"] = min_max_normalize(grid["distance_m"])
            grid["totalScore"] = weighted_overlay(
                {
                    "greenness": grid["greennessScore"].to_numpy(),
                    "pm25": grid["pollutionScore"].to_numpy(),
                    "distance": grid["distanceScore"].to_numpy(),
                },
                weights,
            )
            grid["suitabilityClass"] = grid["totalScore"].map(classify_score)

        grid = grid.sort_values("totalScore", ascending=False).reset_index(drop=True)
        ranked_rows = []
        centroids_wgs84 = gpd.GeoSeries(grid.geometry.centroid, crs=grid.crs).to_crs("EPSG:4326")
        for index, row in grid.head(10).iterrows():
            centroid = centroids_wgs84.iloc[index]
            ranked_rows.append(
                RankedArea(
                    rank=index + 1,
                    cellId=row["cell_id"],
                    areaName=self._rank_area_name(row, layers["green_spaces"], index + 1),
                    totalScore=round(float(row["totalScore"]), 2),
                    greennessScore=round(float(row["greennessScore"]), 2),
                    pollutionScore=round(float(row["pollutionScore"]), 2),
                    distanceScore=round(float(row["distanceScore"]), 2),
                    suitabilityClass=row["suitabilityClass"],
                    centroid={"lat": round(float(centroid.y), 6), "lng": round(float(centroid.x), 6)},
                )
            )

        outputs = self._save_outputs(grid)
        summary = SummaryStats(
            highestScoringArea=ranked_rows[0].areaName if ranked_rows else "No area",
            averageNdvi=round(float(grid["ndvi"].mean()), 3),
            averagePm25=round(float(grid["pm25"].mean()), 2),
            totalGreenSpacesDetected=int(len(layers["green_spaces"])),
            areaCount=int(len(grid)),
        )
        response = AnalysisResponse(
            studyArea=str(study_area.iloc[0]["name"]),
            suitabilityMapMetadata={
                "gridCellCount": int(len(grid)),
                "crs": str(grid.crs),
                "weights": weights,
                "filters": filters,
                "classification": ["Very High", "High", "Moderate", "Low", "Very Low"],
            },
            rankedFeatures=ranked_rows,
            summaryStatistics=summary,
            layers={
                "studyArea": self._serialize_gdf(study_area, ["name", "id"]),
                "greenSpaces": self._serialize_gdf(layers["green_spaces"], ["name", "type"]),
                "pollutionSources": self._serialize_gdf(layers["pollution_sources"], ["name", "category"]),
                "pm25Stations": self._serialize_gdf(layers["pm25"], ["id", "name", "pm25", "timestamp", "source"]),
                "suitabilityGrid": self._serialize_gdf(
                    grid,
                    [
                        "cell_id",
                        "ndvi",
                        "pm25",
                        "distance_m",
                        "greennessScore",
                        "pollutionScore",
                        "distanceScore",
                        "totalScore",
                        "suitabilityClass",
                    ],
                ),
            },
            outputFiles=outputs,
        )
        self._latest_result = response
        self._latest_grid_gdf = grid
        return response

    def get_latest_result(self) -> AnalysisResponse:
        if self._latest_result is None:
            return self.run_analysis(AnalysisRequest())
        return self._latest_result

    def get_rankings(self) -> list[RankedArea]:
        return self.get_latest_result().rankedFeatures

    def get_layer_catalog(self) -> list[dict[str, Any]]:
        return [
            {
                "id": "ndvi",
                "name": "NDVI / Greenness",
                "description": "Synthetic or raster-derived greenness layer",
                "type": "raster-grid",
                "visibleByDefault": True,
            },
            {
                "id": "pm25",
                "name": "PM2.5 Surface",
                "description": "IDW interpolation from PM2.5 stations",
                "type": "surface",
                "visibleByDefault": True,
            },
            {
                "id": "greenSpaces",
                "name": "Public Green Spaces",
                "description": "Park and open-space polygons",
                "type": "polygon",
                "visibleByDefault": True,
            },
            {
                "id": "pollutionSources",
                "name": "Pollution Sources",
                "description": "Sample industrial and traffic-related points",
                "type": "point",
                "visibleByDefault": True,
            },
            {
                "id": "suitability",
                "name": "Suitability Map",
                "description": "Weighted overlay output",
                "type": "polygon-grid",
                "visibleByDefault": True,
            },
        ]


analysis_service = AnalysisService()
