# Shader Search 3 - FastAPI Server

Minimal FastAPI backend with a CDN-powered React single-page app for managing shader evolution data.

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Run

```bash
# Development mode (with auto-reload)
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend

- `GET /` serves `static/index.html`, a React SPA loaded from CDNjs (no bundlers required).
- Additional SPA assets (if any) live under `static/` and are served at `/static/*`.

## Seed Data

On first launch, the API seeds a `Starter Sandbox` evolution configuration containing a simple `GridSimulation` subclass with four cell types (`EMPTY`, `SAND`, `WATER`, `STONE`) and a basic ruleset. Delete or replace it by calling the evolution-config endpoints.

It also seeds a `Starter Tests` group with two example scenarios (`sand_falls_straight_down`, `water_slides_right`) so the browser UI has immediate data to display.

## API Endpoints

- `GET /health`