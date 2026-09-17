# Car Tracker

Car Tracker is a small, single-user application for recording vehicle fuel,
AdBlue, and general expenses. The backend currently contains the Phase 2
SQLite persistence and domain-validation core. HTTP endpoints and the product
frontend remain intentionally deferred to later approved phases.

All monetary values are whole Hungarian forints. Fuel unit price, AdBlue total
price, and general expense amount are stored as integer HUF values; fractional
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

The backend database path is read from `DATABASE_PATH`. It defaults to
`./data/car.sqlite` relative to the backend working directory during local
development and `/data/car.sqlite` when `NODE_ENV=production`. The database
parent directory and schema are created when `openDatabase()` is called. The
frontend remains the Phase 1 toolchain page until its later implementation
phase.

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
