from typing import Any

from pydantic import BaseModel, Field


class Weights(BaseModel):
    greenness: float = 45
    pm25: float = 35
    distance: float = 20


class Filters(BaseModel):
    minimumGreenness: float = 0
    maximumPm25: float = 100
    minimumDistanceFromSource: float = 0


class AnalysisRequest(BaseModel):
    studyArea: str = "Bangkok Metropolitan Area"
    weights: Weights = Field(default_factory=Weights)
    filters: Filters = Field(default_factory=Filters)
    chosenLayers: list[str] = Field(
        default_factory=lambda: ["ndvi", "pm25", "greenSpaces", "pollutionSources", "suitability"]
    )


class LayerDescriptor(BaseModel):
    id: str
    name: str
    description: str
    type: str
    visibleByDefault: bool = True


class RankedArea(BaseModel):
    rank: int
    cellId: str
    areaName: str
    totalScore: float
    greennessScore: float
    pollutionScore: float
    distanceScore: float
    suitabilityClass: str
    centroid: dict[str, float]


class SummaryStats(BaseModel):
    highestScoringArea: str
    averageNdvi: float
    averagePm25: float
    totalGreenSpacesDetected: int
    areaCount: int


class AnalysisResponse(BaseModel):
    studyArea: str
    suitabilityMapMetadata: dict[str, Any]
    rankedFeatures: list[RankedArea]
    summaryStatistics: SummaryStats
    layers: dict[str, Any]
    outputFiles: dict[str, str]

