# Green & Clean Bangkok Finder

Green & Clean Bangkok Finder is a full-stack GIS decision-support web app for identifying relatively greener and lower-pollution areas in Bangkok and nearby provinces. It combines greenness, PM2.5 interpolation, and distance from pollution sources into a configurable spatial suitability score.

This project is designed for a Location-Based Services / GIS academic mini-project. It runs locally with mock Bangkok-area datasets and is structured so real Thailand datasets can be added later without changing the application architecture.

## What the app does

- Displays an interactive map centered on Bangkok
- Toggles NDVI, PM2.5, green spaces, pollution sources, and suitability layers
- Runs a weighted suitability analysis:
  - Greenness: 45%
  - PM2.5: 35%
  - Distance from pollution sources: 20%
- Returns ranked clean-and-green candidate areas
- Exports results as GeoJSON and CSV
- Includes methodology, datasets, and limitations pages

## Important limitations

- The app identifies relatively greener and lower-pollution areas, not zero-pollution areas.
- PM2.5 varies over time and can change quickly.
- Greenness does not always mean public accessibility.
- PM2.5 interpolation is an estimate and depends on station coverage.
- Mock data is included for local demonstration and should be replaced for real-world use.

## Architecture

- Frontend: Next.js 14, TypeScript, Tailwind CSS, React Leaflet, Recharts
- Backend: FastAPI, Pydantic, GeoPandas, Rasterio, Shapely, NumPy, Pandas
- Data mode: Local file-based processing with mock fallbacks
- Containerization: Docker and docker-compose

## Project structure

```text
frontend/                Next.js application
backend/                 FastAPI API and analysis pipeline
data/
  boundaries/            Study area files
  green_spaces/          Parks and open space files
  pollution/             Pollution source files
  pm25/                  PM2.5 station CSV files
  rasters/               NDVI rasters or raster placeholders
  output/                Generated exports
scripts/                 Data preparation and pipeline helpers
docs/                    Project report support docs
```

## Local setup

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Docker

```bash
docker-compose up --build
```

Frontend: `http://localhost:3000`
Backend docs: `http://localhost:8000/docs`

## How mock data works

The backend reads local files from `../data`. If raster or vector inputs are missing, it falls back to synthetic Bangkok-like sample data so the full analysis pipeline still runs.

Included sample files:

- `data/boundaries/bangkok_study_area.geojson`
- `data/green_spaces/parks.geojson`
- `data/pollution/pollution_sources.geojson`
- `data/pm25/pm25_stations.csv`

If no NDVI raster exists, the backend generates a synthetic NDVI surface inside the study area boundary.

## Replacing mock data with real Bangkok datasets

1. Put study area polygons in `data/boundaries/`
2. Put parks or open-space polygons in `data/green_spaces/`
3. Put pollution source points in `data/pollution/`
4. Put PM2.5 station data in `data/pm25/`
5. Put NDVI GeoTIFF rasters in `data/rasters/`
6. Keep CRS metadata valid. The app standardizes layers to EPSG:32647 by default.
7. Update file names or adjust loader settings in [backend/app/config/settings.py](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/backend/app/config/settings.py)

Recommended future real sources:

- Air4Thai / Pollution Control Department
- GISTDA Open Data
- Bangkok open urban datasets
- ONEP / Thai Green Urban datasets
- Industrial or factory source datasets

## Scoring workflow

1. Load and standardize all layers into a common CRS
2. Clip them to the selected study area
3. Interpolate PM2.5 using IDW
4. Build a pollution-distance surface
5. Normalize each factor to 0-100
6. Combine factors with weighted overlay
7. Classify output into:
   - Very High
   - High
   - Moderate
   - Low
   - Very Low

The scoring configuration is stored in [backend/app/config/scoring.py](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/backend/app/config/scoring.py).

## Scripts

- `scripts/generate_sample_data.py`
- `scripts/validate_data.py`
- `scripts/reproject_data.py`
- `scripts/interpolate_pm25.py`
- `scripts/calculate_suitability.py`
- `scripts/export_outputs.py`

## Testing

Backend:

```bash
cd backend
pytest
```

Frontend:

```bash
cd frontend
npm test
```

## Documentation

- [docs/methodology.md](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/docs/methodology.md)
- [docs/datasets.md](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/docs/datasets.md)
- [docs/api.md](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/docs/api.md)
- [docs/setup.md](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/docs/setup.md)
