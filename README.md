# Car Tracker

Car Tracker is a small, single-user application for recording vehicle fuel,
AdBlue, and general expenses. It has a React frontend and an Express JSON API
backed by SQLite. The repository is organized as npm workspaces for shared
`@car-tracker/contracts`, the backend, and the frontend.

All monetary values are whole Hungarian forints. Fuel and AdBlue total prices,
and general expense amounts are stored as integer HUF values; fractional
HUF input is not accepted. Liter quantities retain three-decimal precision.

## Prerequisites

- Node.js 24 LTS (the Phase 1 lockfile was produced with Node.js 24.20.0)
- npm 11 (the Phase 1 lockfile was produced with npm 11.19.0)

Run `nvm use` from the repository root when using nvm. npm installations fail
on Node versions below 24, and unreviewed dependency install scripts are
rejected.

## Install

Install the exact dependency versions recorded in the root lockfile:

```bash
npm ci
```

## Development

Run both development processes together:

```bash
npm run dev
```

Each process is labeled in the combined output. Press `Ctrl+C` to stop both.

Run the backend TypeScript watcher:

```bash
npm run dev:backend
```

Run the frontend Vite server in another terminal:

```bash
npm run dev:frontend
```

Vite proxies relative `/api` requests to `http://localhost:3000` during local
development. Start the backend first (optionally with a disposable
`DATABASE_PATH`), then open the Vite URL shown in the frontend terminal.

### Backend environment

The backend accepts these environment variables:

- `HOST`: listen address; defaults to `0.0.0.0`.
- `PORT`: integer from `1` through `65535`; defaults to `3000`.
- `DATABASE_PATH`: SQLite file path. It defaults to `./data/car.sqlite`
  relative to the backend working directory during local development and
  `/data/car.sqlite` when `NODE_ENV=production`.

The database parent directory and idempotent schema are created at startup.
For a disposable local API, run from the repository root:

```bash
DATABASE_PATH=/tmp/car-tracker-dev.sqlite npm run dev:backend
```

The V1 endpoints are:

```text
GET  /api/health
GET  /api/fuel
POST /api/fuel
GET  /api/adblue
POST /api/adblue
GET  /api/expenses
POST /api/expenses
```

For example:

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/fuel
curl -X POST http://127.0.0.1:3000/api/fuel \
  -H 'Content-Type: application/json' \
  -d '{"eventDate":"2026-09-17","odometerKm":82450,"liters":"47.300","price":"29284","fullTank":true,"remark":"Shell"}'
```

Press `Ctrl+C` to close the HTTP server and SQLite connection. Remove the
disposable database and its `-wal`/`-shm` files after testing.

## Quality checks

Run the complete current gate:

```bash
npm run check
```

Individual commands are also available:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

## Phased implementation

Implementation follows `car-tracker-phased-implementation-plan.md`. Each phase
includes its code, tests, documentation, and acceptance checks. After a phase's
review packet is submitted, work stops until that phase is explicitly approved;
later-phase code must not be scaffolded early.
