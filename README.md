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

Required frontend env vars (in `frontend/.env`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Deploy the event creation function (geocodes + calls `create_event` RPC):

```bash
supabase functions deploy create-event-geocoded --no-verify-jwt
```

Deploy the ASI committee calendar sync function:

```bash
supabase functions deploy committee-calendar-sync --no-verify-jwt
```

See `supabase/README.md` for the twice-daily `pg_cron` schedule and required secrets.

## Authentication

The app uses Supabase Auth with email verification:

- Only `@calpoly.edu` email addresses can sign up
- Email verification is required before sign-in
- See `supabase/migrations/EMAIL_VERIFICATION_SETUP.md` for setup instructions

## What's implemented

- **Home**: latest news + upcoming events
- **Events**: list + search + "schedule an event" form (map view is a placeholder)
- **ASI**: committee directory, committee-specific calendars, and tracked committees
- **Authentication**: Sign up / Sign in with @calpoly.edu email verification

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
- Add a "**Who represents me?**" flow (address → districts → officials).
