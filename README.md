# POLI(SLO)

A web app for **San Luis Obispo County political content**:

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Supabase (PostgREST + Edge Functions)

## Local dev

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

## Supabase setup

The frontend calls Supabase directly:

- PostgREST routes under `/rest/v1/*`
- Edge Functions under `/functions/v1/*`

Required frontend env vars:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Deploy the event creation function (geocodes + calls `create_event` RPC):

```bash
supabase functions deploy create-event-geocoded --no-verify-jwt
```

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

