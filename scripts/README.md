# Browser verification scripts

These Playwright scripts drive a running dev server and assert on the real DOM.
They are run manually (not part of `npm test`). Start a dev server first, then
point a script at it:

```bash
npx vite --port 5184 --host 127.0.0.1 &
VERIFY_URL=http://127.0.0.1:5184 node scripts/verify-t5-4.mjs
```

## Current scripts

- `verify-t5-2.mjs` — auth soft gate: landing prompt, workspace gate, demo entry.
- `verify-t5-3.mjs` — live Supabase cloud round-trip (needs `.env`; create/list/update/rename/RLS/delete).
- `verify-t5-4.mjs` — guided step flow + expert view toggle.
- `verify-t5-5.mjs` — account/privacy copy (auth note, demo data-scope note).
- `verify-t4.mjs` — Task 4 playback/piano-roll/window checks. Updated for the
  Task 5 soft gate: it enters via the demo path and switches to the **Expert**
  view, which restores the single-screen workspace the assertions expect.

## Legacy scripts (retained, not maintained)

`verify-t2-*.mjs` and `verify-t3-7.mjs` were point-in-time acceptance checks for
Milestones 2–3. They query DOM (`.timeline-grid`, `.timeline-scroll`, the
"Input actions" group) that the **Task 4** window-split redesign removed, so they
were already stale before Task 5. They are kept for history; current coverage
lives in the scripts above.
