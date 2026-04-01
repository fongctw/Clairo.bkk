# API

## Base URL

`http://localhost:8000/api`

## Endpoints

### `GET /health`

Returns service health and data availability.

### `GET /study-areas`

Returns available study areas.

### `GET /layers`

Returns metadata and sample features for study area, parks, pollution sources, and latest analysis output.

### `POST /analysis/run`

Runs the suitability analysis.

Request body:

```json
{
  "studyArea": "Bangkok Metropolitan Area",
  "weights": {
    "greenness": 45,
    "pm25": 35,
    "distance": 20
  },
  "filters": {
    "minimumGreenness": 30,
    "maximumPm25": 28,
    "minimumDistanceFromSource": 500
  },
  "chosenLayers": ["ndvi", "pm25", "greenSpaces", "pollutionSources", "suitability"]
}
```

### `GET /analysis/result`

Returns the most recent suitability result, ranked cells, summary statistics, and layer payloads.

### `GET /rankings`

Returns ranked clean-and-green areas.

### `GET /export/geojson`

Downloads the latest output grid as GeoJSON.

### `GET /export/csv`

Downloads the latest output ranking table as CSV.

