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

## API Endpoints

- `GET /health` – Health check
- `GET /api/evolution-configs` – List evolution configurations
- `POST /api/evolution-configs` – Create configuration
- `GET /api/evolution-configs/{id}` – Retrieve configuration
- `PUT /api/evolution-configs/{id}` – Update configuration
- `DELETE /api/evolution-configs/{id}` – Remove configuration
- `GET /api/test-case-groups` – List test case groups
- `POST /api/test-case-groups` – Create test case group
- `GET /api/test-case-groups/{id}` – Retrieve test case group
- `PUT /api/test-case-groups/{id}` – Update test case group
- `DELETE /api/test-case-groups/{id}` – Remove test case group

