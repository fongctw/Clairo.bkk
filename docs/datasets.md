# Datasets

## Local data folders

- `data/boundaries/`
- `data/green_spaces/`
- `data/pollution/`
- `data/pm25/`
- `data/rasters/`
- `data/output/`

## Mock datasets included

### Study area

- `bangkok_study_area.geojson`
- Simplified polygon covering part of Bangkok Metropolitan Area for demo use

### Green spaces

- `parks.geojson`
- Sample park polygons with names and area types

### Pollution sources

- `pollution_sources.geojson`
- Sample industrial and traffic-related point sources

### PM2.5 stations

- `pm25_stations.csv`
- Sample station coordinates and PM2.5 values
- Live Air4Thai region-1 data is now used as the primary PM2.5 source when available
- Local CSV remains the fallback if the Air4Thai feed is unavailable or invalid

## Expected real-data formats

### Boundaries / green spaces / pollution sources

- GeoJSON
- ESRI Shapefile

### PM2.5

- CSV with fields similar to:
  - `id`
  - `name`
  - `latitude`
  - `longitude`
  - `pm25`
  - `timestamp`
- Air4Thai region-1 JSON can also be ingested directly and mapped into the same structure

### NDVI

- GeoTIFF preferred
- Satellite bands can also be supported later for NDVI calculation from raw bands

## Suggested real sources

- Air4Thai / PCD
- GISTDA Open Data
- Bangkok Metropolitan Administration open data
- Urbanis or equivalent urban geospatial data portals
- ONEP or Thai green-space/environment datasets

## Data quality notes

- PM2.5 measurements must be time-aware
- Pollution source datasets should be categorized if possible
- Green spaces should distinguish public and private access if available
- Raster resolution affects detail and processing time

## Highest-priority real data still needed

- Real Bangkok park / green-space polygons
- Real Bangkok study-area or district boundaries
- Real NDVI raster or other greenness raster
- Real pollution-source points such as factories or industrial sites
