# Setup Guide

This guide explains two complete ways to run **Green & Clean Bangkok Finder**:

1. Local development setup
2. Docker setup

Use the **local setup** if you want to actively develop frontend and backend code on your machine.  
Use the **Docker setup** if you want a more reproducible environment and fewer dependency issues.

---

## Method 1: Local Setup

This method runs:
- FastAPI backend on port `8000`
- Next.js frontend on port `3000`

### Prerequisites

Install these tools first on macOS:

```bash
brew install python@3.11
brew install gdal
brew install node
```

Check that they are installed:

```bash
python3.11 --version
gdal-config --version
node --version
npm --version
```

Important:
- Use **Python 3.11**
- Do **not** use Python 3.14 for this project
- GDAL must be installed before `pip install -r requirements.txt`

### Step A: Backend Setup

Open Terminal 1:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/backend"
rm -rf .venv
python3.11 -m venv .venv
source .venv/bin/activate
export GDAL_CONFIG="$(brew --prefix gdal)/bin/gdal-config"
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend URLs:

- `http://localhost:8000`
- `http://localhost:8000/docs`

Optional backend environment variables:

```bash
export USE_LIVE_PM25=true
export AIR4THAI_REGION_URL="http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=1"
export AIR4THAI_TIMEOUT_SECONDS=5
```

By default, the backend now tries to use the live Air4Thai region-1 feed for PM2.5 stations and falls back to `data/pm25/*.csv` if the feed is unavailable.

### Why these backend commands matter

These commands solve the exact issues already encountered:

- `python3.11 -m venv .venv`
  avoids the `pydantic-core` build failure caused by Python 3.14
- `export GDAL_CONFIG=...`
  avoids the `gdal-config` / `rasterio` installation error
- `python -m uvicorn app.main:app --reload`
  avoids the `uvicorn: command not found` problem

### Step B: Frontend Setup

Open Terminal 2:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/frontend"
rm -rf node_modules package-lock.json
npm install
npm run dev
```

Frontend URL:

- `http://localhost:3000`

### Local End-to-End Run

When both terminals are running:

- Frontend is available at `http://localhost:3000`
- Backend API is available at `http://localhost:8000`
- Backend API docs are available at `http://localhost:8000/docs`

Open:

```text
http://localhost:3000/map
```

This loads the Bangkok-focused GIS map page.

### Local Setup Troubleshooting

#### Problem: `uvicorn: command not found`

Use:

```bash
python -m uvicorn app.main:app --reload
```

#### Problem: `gdal-config` not found

Install GDAL:

```bash
brew install gdal
```

Then export:

```bash
export GDAL_CONFIG="$(brew --prefix gdal)/bin/gdal-config"
```

#### Problem: `Failed to build pydantic-core`

This usually means Python 3.14 was used by mistake. Recreate the virtual environment:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/backend"
rm -rf .venv
python3.11 -m venv .venv
source .venv/bin/activate
export GDAL_CONFIG="$(brew --prefix gdal)/bin/gdal-config"
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

#### Problem: `next: command not found`

Install frontend dependencies:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/frontend"
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## Method 2: Docker Setup

This method runs the project in containers.

### Prerequisites

Install Docker Desktop:

- [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

Check Docker is available:

```bash
docker --version
docker-compose --version
```

### Step A: Build and Start Everything

From the project root:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder"
docker-compose up --build
```

This builds and starts:

- `frontend` container
- `backend` container

### Docker End-to-End Run

After startup:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`

Main page:

```text
http://localhost:3000
```

Map page:

```text
http://localhost:3000/map
```

### Stop Docker

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder"
docker-compose down
```

### Restart Docker Later

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder"
docker-compose up
```

### Rebuild After Dependency Changes

If `package.json`, `requirements.txt`, or Dockerfiles change:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder"
docker-compose up --build
```

---

## Which Method Should You Use?

### Use local setup if:

- you want to actively code both frontend and backend
- you want faster development iteration
- you are comfortable managing Python, Node.js, and GDAL locally

### Use Docker if:

- you want the easiest handoff to teammates
- you want more consistent environments
- you want to reduce local dependency problems

---

## Recommended Handoff to a Teammate

If your friend continues the project:

### Simplest way

Tell them to use Docker:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder"
docker-compose up --build
```

### If they want to code locally

Tell them to use these exact backend commands:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/backend"
rm -rf .venv
python3.11 -m venv .venv
source .venv/bin/activate
export GDAL_CONFIG="$(brew --prefix gdal)/bin/gdal-config"
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

And these frontend commands:

```bash
cd "/Users/chaitawatboonkitticharoen/Documents/year 3/term2/lbs/Green & Clean Bangkok Finder/frontend"
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## Summary

### Local method

1. Install Python 3.11, GDAL, and Node
2. Set up backend venv with Python 3.11
3. Export `GDAL_CONFIG`
4. Install backend requirements
5. Run backend with `python -m uvicorn`
6. Install frontend packages
7. Run frontend with `npm run dev`

### Docker method

1. Install Docker Desktop
2. Run `docker-compose up --build`
3. Open frontend and backend URLs
