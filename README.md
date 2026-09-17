# Car Tracker

Car Tracker is a small, single-user application for recording vehicle fuel,
AdBlue, and general expenses. The repository currently contains the Phase 1
tooling foundation and compile-only application placeholders.

## Prerequisites

- Node.js 24 LTS (the Phase 1 lockfile was produced with Node.js 24.20.0)
- npm 11 (the Phase 1 lockfile was produced with npm 11.19.0)

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

The Phase 1 backend is an exported compile target only. The frontend displays a
minimal page that proves the React and Vite toolchain works. API, persistence,
and product UI behavior are intentionally deferred to later approved phases.

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
