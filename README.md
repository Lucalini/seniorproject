# POLI(SLO)

A civic engagement platform for San Luis Obispo County, built to make local government more accessible to Cal Poly students and community members.

## What it does

- **Events** — Browse, search, and submit local political events. Community-submitted events are geocoded automatically.
- **ASI Committee Tracking** — Syncs meeting schedules from Cal Poly's ASI WordPress calendars into a unified view. Covers all 9 student government committees (Board of Directors, Executive Cabinet, UUAB, etc.).
- **Municipal Code Browser** — Read and search the SLO municipal code with AI-generated section summaries.
- **Ordinance Drafting** — Rich-text editor for drafting ordinance amendments with PDF export.
- **Officials Directory** — Look up local elected officials.

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Supabase (PostgREST API + Edge Functions + pg_cron) |
| Auth | Supabase Auth, restricted to `@calpoly.edu` emails |
| Hosting | Vercel (frontend) |

## Local development

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment variables

Create `frontend/.env.local` with:

```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## Edge Functions

- **committee-calendar-sync** — Fetches ASI committee meetings from WordPress, expands recurrence rules, and upserts into the events table. Runs on a 6-hour pg_cron schedule.
- **create-event-geocoded** — Geocodes a user-submitted event address and inserts it.
- **mobilize-slo-scrape** — Scrapes political events from Mobilize.
- **summarize-municipal-sections** — Generates AI summaries of municipal code sections.

## Status

Active development. The committee calendar sync pipeline is built and deployed; a TLS issue on the Supabase Deno runtime currently blocks live WordPress fetches (function logic is correct, awaiting platform fix). See `SEED.md` for manual invocation and troubleshooting.
