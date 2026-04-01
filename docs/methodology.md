# Methodology

## Overview

The application performs spatial suitability analysis to identify relatively green and lower-pollution areas in Bangkok and nearby provinces. It is a multi-criteria decision analysis workflow rather than a zero-pollution detector.

## Inputs

- Study area boundary
- Green-space polygons
- PM2.5 station observations
- Pollution source points
- NDVI raster or synthetic greenness surface

## Processing workflow

1. Load all datasets
2. Standardize CRS to EPSG:32647
3. Clip to the study area
4. Interpolate PM2.5 into a continuous surface using IDW
5. Calculate distance from pollution sources
6. Create an analysis grid
7. Assign NDVI, PM2.5, and distance values to each grid cell
8. Normalize scores from 0 to 100
9. Apply weighted overlay
10. Classify results into five suitability classes
11. Rank top-performing cells or polygons

## Formula

```text
Suitability = (NDVI_score * 0.45) + (PM25_score * 0.35) + (Distance_score * 0.20)
```

Where:

- `NDVI_score` is min-max normalized, higher is better
- `PM25_score` is inversely normalized, lower is better
- `Distance_score` is min-max normalized, farther is better

## Classification

- 80 to 100: Very High
- 60 to 79.99: High
- 40 to 59.99: Moderate
- 20 to 39.99: Low
- 0 to 19.99: Very Low

## Notes

- IDW is modular and can later be replaced or extended with kriging.
- If an NDVI raster is unavailable, a synthetic surface is generated for demonstration.
- Results depend strongly on data quality and temporal coverage.

