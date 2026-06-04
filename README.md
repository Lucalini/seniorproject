# POLI(SLO)

POLI(SLO) is a local civic engagement app for San Luis Obispo and Cal Poly students. The main goal is to put local meetings, ASI committee info, public discussion, officials, and municipal code tools in one place.

## Tech overview

The frontend is a React + TypeScript app built with Vite. Routing is handled with React Router in `frontend/src/App.tsx`. Most pages call helper functions in `frontend/src/api/poli.ts`, which talks to Supabase through PostgREST or Supabase Edge Functions.

Supabase is the backend. It stores events, officials, ASI committee tracking, bulletin board posts, municipal code sections, and ordinance drafts. The database schema is managed through SQL files in `supabase/migrations`.

Auth uses Supabase Auth with email and password login. Signups are limited to `@calpoly.edu` emails in the frontend, and there is also a database trigger that enforces the same rule on the backend.

## Main features

Events

The events page loads upcoming rows from the `events` table. Users can search events on the frontend. Logged-in users can submit a new event, which calls the `create-event-geocoded` Edge Function. That function geocodes the address with OpenStreetMap Nominatim, then inserts the event into Supabase with PostGIS coordinates.

ASI committees

ASI committee data lives in `frontend/src/data/asiCommittees.ts` and is also seeded into Supabase. Each committee has a page with its description, official ASI link, and matching meetings. Users can track committees. If they are logged in, follows are saved in `user_committee_follows`; if not, the app falls back to local storage.

City committees

City advisory body pages work almost the same way as ASI committee pages. The static city committee list is in `frontend/src/data/cityCommittees.ts`. The page filters shared event data by committee key or title matching.

Calendar syncing

The `committee-calendar-sync` Edge Function imports meetings from ASI WordPress event pages and the SLO City government meetings calendar. It expands recurring meetings, handles cancelled meetings, attaches agenda links when available, and upserts everything into the `events` table. A pg_cron job runs it every 6 hours.

Bulletin board

The bulletin board is a small discussion system. It supports normal posts, polls, event-style posts, comments, replies, likes, dislikes, tags, filtering, sorting, and user preferences. The frontend builds the board in `BulletinBoardPage.tsx`. Supabase stores threads, tags, comments, votes, poll options, poll responses, and preferences. Some seed threads are still used as fallback/demo content.

Municipal code browser

Municipal code sections are stored as a tree in `municipal_code_nodes`. The parser script in `scripts/parse-municipal-code.ts` can read a municipal code PDF, split it into titles, chapters, and sections, then insert those nodes into Supabase. The frontend loads the tree and lets users select sections for ordinance drafting.

AI summaries

The `summarize-municipal-sections` Edge Function takes selected municipal code sections and sends them to Gemini. It returns a plain-English summary. The function requires a logged-in user.

Ordinance drafting

The ordinance draft page lets a logged-in user build a draft ordinance from selected municipal code sections. The editor uses TipTap. Drafts autosave to the `ordinance_drafts` table as JSON. PDF export uses `@react-pdf/renderer` and keeps strikethrough text and green insertion marks.

Officials directory

The officials page reads from the `politicians` table. Users can search, sort, paginate, and open a detail page. Detail pages show bio, contact info, and recent seeded news articles.

Education page

The education page currently uses local seed data from `frontend/src/api/seeds.ts`. It is kept in the app, but navigation currently points more toward the bulletin board.

## Local development

Install and run the frontend:

```bash
cd frontend
npm install
npm run dev
```

The app usually runs at `http://localhost:5173`.

Create `frontend/.env.local`:

```bash
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Useful commands:

```bash
cd frontend
npm run test
npm run build
```

## Project structure

`frontend/src/pages` has the main app screens.

`frontend/src/components` has shared UI, auth provider, calendar display, and ordinance editor/PDF code.

`frontend/src/api` has the Supabase API helpers.

`frontend/src/data` has static ASI and city committee metadata.

`supabase/functions` has the Edge Functions.

`supabase/migrations` has the database schema.

`scripts` has one-off data import tools.
