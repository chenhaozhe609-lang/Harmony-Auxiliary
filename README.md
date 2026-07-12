# Harmony Auxiliary

A local-first harmony assistant for music creation.

## Current Status

The project currently contains:

- `apps/web`: the Vite + React + TypeScript editor.
- `apps/api`: a Vercel Function boundary for the future project/sync API.
- `packages/*`: shared domain, API-contract and harmony-core boundaries.
- Dependencies managed with [pnpm](https://pnpm.io) (`pnpm-lock.yaml` committed).

The Round 8 audit, task plan and architecture decisions are tracked in
[`docs/round-8`](docs/round-8/README.md).

## Intended Development Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## Environment and current migration state

The legacy Supabase integration remains in the web app until A4. Do not create
or configure a new Supabase project: the Round 8 target is a local-first client
with an API-owned PostgreSQL, authentication and controlled audio assets.

Copy `.env.example` to `.env` only when a locally hosted API needs a public
base URL. Credentials belong exclusively in the API/deployment secret manager.

See [ADR-0001](docs/round-8/adr/ADR-0001-long-term-platform.md) for the
accepted production boundary.
