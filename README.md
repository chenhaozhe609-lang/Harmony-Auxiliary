# Harmony Auxiliary

A local-first harmony assistant for music creation.

## Current Status

The project currently contains:

- A Vite + React + TypeScript scaffold.
- Installed npm dependencies and a committed lockfile.

Internal planning docs (PRD, UI/UX direction, technical design, and milestone task breakdowns) are kept locally under `docs/` and are not tracked.

## Intended Development Commands

```bash
npm run dev
npm run build
npm run test
```

## Optional: Configure Supabase for accounts

Authentication and cloud project storage are powered by [Supabase](https://supabase.com).
They are optional: when no Supabase credentials are present, the app runs in a
"not configured" mode and core creation still works.

1. Create a Supabase project.
2. In the SQL Editor, run `supabase/migrations/0001_create_projects.sql` to create
   the `projects` table with row-level security.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**.
4. Restart `npm run dev`.

Only the public anon key belongs in the frontend; never commit the `service_role`
key. Original MIDI files are never uploaded — only project snapshot JSON is stored.
