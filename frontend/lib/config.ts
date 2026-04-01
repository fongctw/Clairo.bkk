export const DEFAULT_FILTERS = {
  minimumGreenness: 20,
  maximumPm25: 35,
  minimumDistanceFromSource: 500
};

export const DEFAULT_WEIGHTS = {
  greenness: 45,
  pm25: 35,
  distance: 20
};

export const DEFAULT_LAYER_TOGGLES = {
  ndvi: false,
  pm25: false,
  greenSpaces: true,
  pollutionSources: false,
  suitability: false
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";
