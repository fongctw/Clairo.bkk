export type LayerToggleState = {
  ndvi: boolean;
  pm25: boolean;
  greenSpaces: boolean;
  pollutionSources: boolean;
  suitability: boolean;
};

export type Filters = {
  minimumGreenness: number;
  maximumPm25: number;
  minimumDistanceFromSource: number;
};

export type Weights = {
  greenness: number;
  pm25: number;
  distance: number;
};

export type RankedArea = {
  rank: number;
  cellId: string;
  areaName: string;
  totalScore: number;
  greennessScore: number;
  pollutionScore: number;
  distanceScore: number;
  suitabilityClass: string;
  centroid: { lat: number; lng: number };
};

export type GeoJsonFeatureCollection = GeoJSON.FeatureCollection;

export type AnalysisResponse = {
  studyArea: string;
  suitabilityMapMetadata: {
    gridCellCount: number;
    crs: string;
    weights: Weights;
    filters: Filters;
    classification: string[];
  };
  rankedFeatures: RankedArea[];
  summaryStatistics: {
    highestScoringArea: string;
    averageNdvi: number;
    averagePm25: number;
    totalGreenSpacesDetected: number;
    areaCount: number;
  };
  layers: {
    studyArea: GeoJsonFeatureCollection;
    greenSpaces: GeoJsonFeatureCollection;
    pollutionSources: GeoJsonFeatureCollection;
    pm25Stations: GeoJsonFeatureCollection;
    suitabilityGrid: GeoJsonFeatureCollection;
  };
  outputFiles: {
    geojson: string;
    csv: string;
  };
};

