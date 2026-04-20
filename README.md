# Green & Clean Bangkok Finder

Green & Clean Bangkok Finder is currently a frontend-only Next.js app for exploring Bangkok public parks with live air-quality context.

The app focuses on helping users find parks that are both nearby and relatively cleaner right now by combining:

- live PM2.5 / AQI readings from WAQI
- browser geolocation
- inverse-distance weighted (IDW) interpolation between nearby sensor stations
- Bangkok park metadata, categories, images, and map geometry

## Current status

This repository does not currently include an active backend.

The old README described a FastAPI backend, GIS processing pipeline, Docker setup, and `backend/` / `data/` folders. Those are not present in the current project structure. The app now works by calling public APIs directly from the frontend and loading local static files from `frontend/public/`.

## Features

- interactive Bangkok map with street and satellite basemaps
- live PM2.5-based safety display for the user’s current location
- park markers with popup cards, park details, and directions links
- park ranking page sorted by interpolated air quality
- search, district filters, and amenity/category filters
- fullscreen map mode
- weather and short forecast support when an OpenWeather key is provided
- reverse geocoding for the user’s detected location

## Tech stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Leaflet / Leaflet
- Vitest + Testing Library

## Project structure

```text
README.md
scripts/
  add-featured-parks.py
frontend/
  app/                  Next.js app routes
  components/           UI and map components
  lib/                  API helpers, interpolation, park metadata
  public/               local GeoJSON / JSON assets and images
  package.json
```

## Main routes

- `/map` — main map experience
- `/map/fullscreen` — fullscreen map view
- `/ranking` — park ranking by interpolated PM2.5
- `/about` — project limitations and future ideas

The home route `/` redirects to `/map`.

## Data and API sources

The current app uses a mix of live APIs and local static assets:

- WAQI / AQICN API for air quality and sensor map data
- OpenWeather API for current weather and short forecast
- Open-Meteo air quality API for historical PM2.5 helper data
- OpenStreetMap Nominatim for reverse geocoding
- local files in `frontend/public/` such as:
  - `park.geojson`
  - `parks_clean.json`
  - `clairo-logo.png`

Park enrichment is assembled in the frontend from:

- BMA park metadata in [frontend/lib/bma-parks-meta.ts](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/frontend/lib/bma-parks-meta.ts)
- local park geometry from `frontend/public/park.geojson`
- live air-quality station data

## Environment variables

Create `frontend/.env.local` if you want live API access:

```bash
NEXT_PUBLIC_AQICN_TOKEN=your_waqi_token
NEXT_PUBLIC_OWM_KEY=your_openweathermap_key
```

Notes:

- `NEXT_PUBLIC_AQICN_TOKEN` is effectively required for live PM2.5 and station data.
- `NEXT_PUBLIC_OWM_KEY` is optional. Without it, weather and forecast sections will return empty data.
- Because these are `NEXT_PUBLIC_*` variables, they are exposed to the browser by design.

## Local development

```bash
cd frontend
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Available scripts

From `frontend/`:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
```

Repository-level helper script:

```bash
python scripts/add-featured-parks.py
```

## How PM2.5 is calculated in the app

The app does not run a server-side GIS pipeline right now.

Instead, it:

1. loads live station readings from the WAQI bounds endpoint
2. converts AQI-style readings into approximate PM2.5 values
3. uses IDW interpolation in the frontend to estimate PM2.5 at park and user locations
4. converts PM2.5 back to a US AQI-style display label for the UI

The interpolation logic lives in [frontend/lib/api.ts](/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/frontend/lib/api.ts).

## Limitations

- This app shows relative cleanliness, not pollution-free locations.
- PM2.5 changes over time, sometimes quickly.
- API availability and rate limits can affect results.
- Missing API keys will reduce functionality.
- Some park centroids fall back to manually provided coordinates when no polygon match is found.
- Air quality values are interpolated estimates, not direct on-site sensor readings for every park.

## Notes for future cleanup

If you continue maintaining this project, the next README update should stay aligned with the actual repo state:

- no backend should be documented unless a real `backend/` service is added back
- no Docker instructions should be documented unless Docker files are restored
- no nonexistent `docs/` or `data/` folders should be referenced
