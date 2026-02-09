# POLI(SLO)

A starter full‑stack web app for **San Luis Obispo County political content**:

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python (FastAPI)

## Local dev

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/healthz`.

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

## What’s implemented (matches your wireframes)

- **Home**: latest news + upcoming events
- **Events**: list + search + “schedule an event” form (map view is a placeholder)
- **Civil servants**: searchable directory + detail page with contact + related news
- **Education**: starter topics (how local gov works + strategies to create change)

## Color palette (light theme)

- **Primary green**: `#5c996b` (92, 153, 107)
- **Banner green**: `#3d6647` (61, 102, 71)
- **Text green**: `#1f3324` (31, 51, 36)
- **Background**: `#f7f7f7` (247, 247, 247)
- **Surface**: `#ffffff` (255, 255, 255)

## Next steps (recommended)

- Replace placeholder seed data with **real ingestion** (RSS + agendas/minutes + elections).
- Add a database (SQLite first, then Postgres) and persist:
  - `events` (community submitted + imported)
  - `articles` (from feeds)
  - `officials` (from civic sources + scraped pages)
- Add a “**Who represents me?**” flow (address → districts → officials).

