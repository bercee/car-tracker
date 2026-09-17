# Car Tracker V1: Implementation Handout

Status: implementation-ready plan  
Target: single-user home-server application  
Deployment: two Docker containers behind an existing Nginx TLS reverse proxy  
CI output: two private GHCR images  
Out of scope: end-to-end browser tests

## 1. Outcome and fixed decisions

Build a lightweight car-event tracker with:

- React + TypeScript single-page frontend.
- Express + TypeScript backend.
- One SQLite database owned exclusively by the backend.
- Three record types: fuel, AdBlue, and general expenses.
- Create and list functionality only in V1.
- HTTPS and HTTP Basic Authentication at the existing outer Nginx reverse proxy.
- Two production images: static frontend and backend API.
- GitHub Actions for checks, builds, and image publication to GHCR.
- Deliberate home-server deployment with `docker compose pull && docker compose up -d`; CI does not receive SSH access to the home server.

Fixed implementation choices:

- Node.js 24 LTS, npm, TypeScript strict mode.
- npm workspaces monorepo.
- Vite, React, native `fetch`; no Axios, Redux, React Query, router, or UI framework.
- Express and `better-sqlite3`; no ORM or migrations framework.
- Vitest everywhere, Supertest for backend HTTP integration, React Testing Library for component integration.
- ESLint and Prettier at repository root.
- ISO calendar dates (`YYYY-MM-DD`) for `eventDate`; UTC timestamps for `createdAt`.
- Every monetary value is denominated in whole Hungarian forints and stored as an integer HUF amount, including fuel unit prices. Fractional HUF values are not accepted.
- Liter and HUF request/response values are strings so API boundaries never coerce user-entered numeric text through binary floating point.
- AdBlue `price` means total amount paid, not price per liter.
- Currency is fixed to `HUF`, is not configurable, and is not stored per row.
- No application authentication or CORS. Both are unnecessary because Nginx protects one same-origin site.

## 2. Repository layout

```text
car-tracker/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── index.ts
│   │   ├── config.ts
│   │   ├── db.ts
│   │   ├── schema.sql
│   │   ├── errors.ts
│   │   ├── database/
│   │   │   ├── carDatabase.ts
│   │   │   ├── mappers.ts
│   │   │   └── sqliteCarDatabase.ts
│   │   ├── validation/
│   │   │   ├── common.ts
│   │   │   ├── fuel.ts
│   │   │   ├── adblue.ts
│   │   │   └── expense.ts
│   │   └── routes/
│   │       ├── fuel.ts
│   │       ├── adblue.ts
│   │       ├── expenses.ts
│   │       └── health.ts
│   ├── test/
│   │   ├── helpers/
│   │   │   └── testDb.ts
│   │   ├── unit/
│   │   └── integration/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── types.ts
│   │   ├── format.ts
│   │   ├── components/
│   │   │   ├── FuelPanel.tsx
│   │   │   ├── AdBluePanel.tsx
│   │   │   ├── ExpensesPanel.tsx
│   │   │   ├── StatusMessage.tsx
│   │   │   └── RecordTable.tsx
│   │   └── styles.css
│   ├── test/
│   │   ├── setup.ts
│   │   ├── unit/
│   │   └── integration/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── vitest.config.ts
├── deploy/
│   ├── compose.example.yml
│   ├── .env.example
│   └── reverse-proxy.example.conf
├── .dockerignore
├── .editorconfig
├── .gitignore
├── .prettierignore
├── eslint.config.js
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── README.md
```

Keep `app.ts` free of `listen()` so tests can instantiate the Express application. `index.ts` is the only process entry point and calls `listen()`.

## 3. Root tooling and commands

Root `package.json`:

```json
{
  "name": "car-tracker",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "engines": { "node": ">=24" },
  "scripts": {
    "dev:backend": "npm run dev --workspace backend",
    "dev:frontend": "npm run dev --workspace frontend",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "eslint . --max-warnings=0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "npm run test --workspaces --if-present",
    "test:coverage": "npm run test:coverage --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "check": "npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Required dependency groups:

- Root dev: `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier`, `globals`.
- Backend runtime: `express`, `better-sqlite3`.
- Backend dev: `@types/express`, `@types/better-sqlite3`, `@types/node`, `supertest`, `@types/supertest`, `vitest`, `@vitest/coverage-v8`, `tsx`.
- Frontend runtime: `react`, `react-dom`.
- Frontend dev: `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/react`, `@types/react-dom`.

Hygiene rules:

- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- ESLint must fail on warnings in CI.
- Prettier uses defaults except `singleQuote: true`, `trailingComma: all`.
- Commit the root `package-lock.json`; use only `npm ci` in CI and Docker builds.
- Never commit `.env`, SQLite files, WAL/SHM files, coverage, `dist`, or `node_modules`.
- No `any` unless isolated at an untyped library boundary and justified by a comment.

## 4. Database contract

Database location comes from `DATABASE_PATH`; production default is `/data/car.sqlite`. Development should require an explicit value or default to `./data/car.sqlite` relative to the backend working directory. Tests use an isolated temporary directory and delete it after each test.

`backend/src/schema.sql`:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS fuel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date TEXT NOT NULL
    CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  liters_milliliters INTEGER NOT NULL CHECK (liters_milliliters > 0),
  price_per_liter_huf INTEGER NOT NULL
    CHECK (typeof(price_per_liter_huf) = 'integer' AND price_per_liter_huf >= 0),
  full_tank INTEGER NOT NULL CHECK (full_tank IN (0, 1)),
  remark TEXT CHECK (remark IS NULL OR length(remark) <= 500)
);

CREATE TABLE IF NOT EXISTS adblue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date TEXT NOT NULL
    CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  odometer_km INTEGER NOT NULL CHECK (odometer_km >= 0),
  liters_milliliters INTEGER NOT NULL CHECK (liters_milliliters > 0),
  price_huf INTEGER NOT NULL
    CHECK (typeof(price_huf) = 'integer' AND price_huf >= 0)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date TEXT NOT NULL
    CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at TEXT NOT NULL
    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  amount_huf INTEGER NOT NULL
    CHECK (typeof(amount_huf) = 'integer' AND amount_huf >= 0),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_fuel_event_date
  ON fuel(event_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_adblue_event_date
  ON adblue(event_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_event_date
  ON expenses(event_date DESC, id DESC);
```

Application initialization:

1. Create the database parent directory if absent.
2. Open one `better-sqlite3` connection per backend process.
3. Execute `schema.sql` at startup. The SQL must be idempotent.
4. Enable safe integers with `db.defaultSafeIntegers(true)` or explicitly assert every returned integer is within JavaScript safe range.
5. Close the connection on `SIGTERM` and `SIGINT`, then exit.
6. If initialization fails, log the error to stderr and terminate non-zero. Do not start HTTP with an unusable database.

V1 schema changes are applied idempotently at startup. Before any later destructive or column-changing migration, introduce numbered migration files and a schema-version table.

## 5. API contract

All API endpoints consume and produce JSON. All success responses include `Content-Type: application/json`. Unknown `/api/*` paths return JSON `404`. Unhandled failures return JSON `500` without stack traces.

Endpoints:

```text
GET  /api/health
GET  /api/fuel
POST /api/fuel
GET  /api/adblue
POST /api/adblue
GET  /api/expenses
POST /api/expenses
```

List order is always `event_date DESC, id DESC`. V1 has no pagination. A successful POST returns `201` plus the inserted canonical record. A successful GET returns `200` plus a JSON array.

### Fuel

POST body and response record:

```json
{
  "eventDate": "2026-09-15",
  "odometerKm": 82450,
  "liters": "47.300",
  "pricePerLiter": "619",
  "fullTank": true,
  "remark": "Shell"
}
```

Response adds:

```json
{
  "id": 42,
  "createdAt": "2026-09-16T12:34:56.789Z"
}
```

Persist `liters` as milliliters and `pricePerLiter` as whole HUF. Responses render liters with exactly three fractional digits and the unit price as a whole-number string.

### AdBlue

```json
{
  "eventDate": "2026-09-15",
  "odometerKm": 82450,
  "liters": "10.000",
  "price": "7490"
}
```

Persist `liters` as milliliters and total `price` as whole HUF. Responses use three fractional digits for liters and a whole-number string for price.

### Expense

```json
{
  "eventDate": "2026-09-15",
  "amount": "32000",
  "notes": "Annual inspection"
}
```

Persist `amount` as whole HUF. Responses use a whole-number string.

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "liters must be greater than 0",
    "field": "liters"
  }
}
```

Codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNSUPPORTED_MEDIA_TYPE`, `INTERNAL_ERROR`.

### Validation rules

- Reject bodies above `16kb` through `express.json({ limit: '16kb' })`.
- Require `Content-Type: application/json` for POST.
- Body must be a plain JSON object; reject arrays and unknown fields.
- `eventDate`: required string, real calendar date, exact `YYYY-MM-DD`; allow past and future dates because delayed/planned entry policy was not specified.
- `odometerKm`: integer from `0` through `9,999,999`.
- Liter strings: canonical decimal syntax, greater than `0`, at most `9999.999`, up to three fractional digits. Reject exponent notation, signs, commas, and extra precision.
- General and AdBlue HUF strings: canonical non-negative whole-number syntax, at most `9,999,999`. Reject decimals, exponent notation, signs, commas, whitespace, and leading zeros except for `0`.
- Fuel unit-price HUF strings: canonical non-negative whole-number syntax, at most `9,999`, with the same rejection rules.
- `fullTank`: Boolean only.
- Optional text: accept missing, `null`, or string; trim; convert empty string to `null`; enforce limits from schema.
- Validation conversion must be string-based, not `parseFloat()`. For liters, split on `.`, validate digits, right-pad the fraction, and construct milliliters. For HUF, accept digits only and construct the integer amount directly.

Health response:

```json
{ "status": "ok" }
```

The health handler executes `SELECT 1` and returns `503` with `{ "status": "unavailable" }` if SQLite is unavailable. It remains behind Basic Auth externally.

## 6. Backend module responsibilities

- `config.ts`: read and validate `HOST`, `PORT`, and `DATABASE_PATH`. Defaults: `HOST=0.0.0.0` inside Docker, `PORT=3000`, `DATABASE_PATH=/data/car.sqlite` in production.
- `db.ts`: create the parent directory, open/configure SQLite, execute the schema, and return the database implementation. Accept the database path as an argument to support tests.
- `database/carDatabase.ts`: narrow persistence interface and database diagnostics shape, independent of SQLite.
- `database/mappers.ts`: private SQLite row shapes and pure row-to-API record mapping.
- `database/sqliteCarDatabase.ts`: prepared statements and the SQLite implementation of the persistence interface, including explicit close behavior.
- `validation/common.ts`: plain-object check, exact-key check, calendar-date parser, integer range validator, liter-string-to-scaled-integer conversion, whole-HUF parser, optional text normalization.
- Per-record validators: return a discriminated result or throw one typed `ValidationError`; do not depend on Express.
- Route factories: accept the database instance. Prepare SQL once when the router is created. Use transactions only where more than one statement must be atomic.
- `app.ts`: create Express app, disable `x-powered-by`, install JSON parsing, register injected routers, add API 404 handler, final error middleware.
- `index.ts`: load configuration, initialize DB, create app, listen, log one startup line, handle signals.
- `errors.ts`: typed HTTP-safe errors and centralized conversion to the error envelope.

Backend security behavior:

- Never trust `X-Forwarded-*` for authorization. There is no application authorization.
- Do not log request bodies or Basic Auth headers.
- Use parameterized SQLite statements only.
- The container runs as a non-root user and writes only under `/data` and temporary OS paths.

## 7. Frontend behavior

Use one page with three navigation buttons or tabs: Fuel, AdBlue, Expenses. Client-side routing is unnecessary. Each panel owns its form and list state.

Each panel must:

1. Fetch its complete list when first shown.
2. Show a loading state without hiding the form.
3. Render a responsive table on wide screens and allow horizontal scrolling on narrow screens.
4. Use semantic labels, inputs, fieldsets, table headings, and an `aria-live="polite"` status region.
5. Submit with the button disabled while pending.
6. Show field-level errors for client validation and the API error message for server rejection.
7. On success, reset record fields, retain today's `eventDate`, and refetch the table.
8. Preserve the form if submission fails.
9. Render full-tank as `Yes`/`No`, not raw Boolean.
10. Format dates with the browser locale without timezone conversion; `eventDate` is a calendar date.

Inputs:

- Dates: `<input type="date">`, default to the user's local current date.
- Odometer: number input, `min=0`, `max=9999999`, `step=1`.
- Liters use a text or number input with `step=0.001`. HUF prices use text or number inputs with `step=1`. Keep state as strings and submit strings unchanged.
- Full tank: checkbox.
- Remarks/notes: textarea with matching `maxLength`.

`api.ts` requirements:

- Base paths are relative, such as `/api/fuel`; do not bake in a domain.
- Central `request<T>()` wrapper sets JSON headers for POST, checks `response.ok`, parses the standard error envelope, and throws a typed `ApiError`.
- A `204` response need not be supported because V1 never returns it.
- Export exactly `getFuel`, `addFuel`, `getAdBlue`, `addAdBlue`, `getExpenses`, `addExpense`.

Formatting:

- Use `Intl.NumberFormat` with currency fixed to `HUF` for money display after converting trusted API strings to numbers. Keep raw form and API state as strings.
- Show liters to three decimals and every HUF value without fractional digits.

## 8. Test plan

No Playwright, Cypress, Selenium, or deployed-system E2E tests are required.

### Backend unit tests

Test pure validation and conversion functions without Express or SQLite:

- Accept valid leap dates; reject impossible dates and malformed formats.
- Liter conversions: `1`, `1.6`, `1.619`, `0.001`, maximum boundary.
- HUF conversions: `0`, `1`, representative and maximum values; reject every fractional form.
- Reject negative, exponent, comma, whitespace-only, excessive precision, over-maximum, and zero where prohibited.
- Validate odometer integer and both boundaries.
- Reject unknown fields, arrays, missing required fields, and wrong Boolean types.
- Trim optional strings, turn empty into `null`, and reject excessive length.
- Map storage integers to canonical API strings.

### Backend module integration tests

Run the real Express app, route modules, validation, SQL, and a real temporary SQLite file through Supertest. Do not start a TCP listener.

For each resource:

- Empty GET returns `200 []`.
- Valid POST returns `201`, generated ID/timestamp, canonical liters/HUF strings, and expected fields.
- Following GET returns the stored record.
- Multiple records sort by `eventDate DESC`, then `id DESC`.
- Invalid body returns `400` and writes no row.
- Database constraints reject invalid direct writes in a focused DB test.

Cross-cutting:

- Non-JSON POST returns `415`.
- Oversize body returns `413` in the standard error format.
- Unknown API route returns JSON `404`.
- Health returns `200` with a working DB and `503` when the injected DB check fails.
- Internal exception returns sanitized `500`, not a stack trace.
- Startup schema execution is idempotent.
- WAL, foreign keys, and busy timeout are enabled.

### Frontend unit tests

- Date and numeric formatting helpers.
- `request()` returns parsed data and maps a non-2xx error envelope to `ApiError`.
- Network/invalid-response failures produce a safe generic message.
- Pure client validation mirrors the most useful server rules.

Mock `global.fetch` only in `api.ts` unit tests.

### Frontend module integration tests

Use React Testing Library and `user-event`; mock the exported `api.ts` functions rather than HTTP.

For each panel:

- Loads and displays rows.
- Displays loading, empty, and load-failure states.
- Submits exact values typed by the user.
- Disables duplicate submission while pending.
- On success, shows confirmation, resets appropriate fields, refetches, and renders the new result.
- On failure, displays the error and preserves form values.
- Client-invalid input blocks the API call and focuses or identifies the invalid field.

App-level integration:

- Default panel is Fuel.
- Switching among the three panels displays the correct form/table and loads each list only on first activation unless a successful mutation requires a refresh.
- Basic keyboard navigation and accessible names work.

### Coverage and test isolation

- Initial line/statement/function/branch thresholds: 80% per workspace.
- Coverage is a guard, not a substitute for the cases above.
- Tests must not depend on order, real time, network, production database, or developer locale.
- Use fake/fixed time for default-date tests.
- Temporary database paths must be unique per test file or test and cleaned after the DB closes.

## 9. Local development acceptance loop

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
docker build -t car-tracker-backend:test ./backend
docker build -t car-tracker-frontend:test ./frontend
docker compose -f deploy/compose.example.yml config
```

The Docker commands validate packaging only; they are not E2E tests.

## 10. Production Dockerfiles

Backend `Dockerfile` requirements:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY backend backend
RUN npm run build --workspace backend
RUN npm prune --omit=dev --workspace backend

FROM node:24-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/car.sqlite
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/dist ./dist
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
```

The implementer must verify the workspace/prune output layout. If npm hoisting makes the copied production tree ambiguous, use a backend-specific production install stage with the root lockfile. Do not copy the full source or dev dependencies into the runtime image. `better-sqlite3` is native; the build and runtime Alpine/architecture must match.

Frontend `Dockerfile`:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY frontend frontend
RUN npm run build --workspace frontend

FROM nginx:1.29-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
```

Pin base images to reviewed patch versions or digests when implementing release hardening. Do not use `latest`.

Frontend inner `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;

    location = /index.html {
        add_header Cache-Control "no-store";
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 11. Docker Compose example

`deploy/compose.example.yml`:

```yaml
name: car-tracker

services:
  frontend:
    image: ghcr.io/OWNER/car-tracker-frontend:${APP_VERSION:-main}
    restart: unless-stopped
    networks:
      - proxy
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
    security_opt:
      - no-new-privileges:true

  backend:
    image: ghcr.io/OWNER/car-tracker-backend:${APP_VERSION:-main}
    restart: unless-stopped
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: "3000"
      DATABASE_PATH: /data/car.sqlite
    volumes:
      - ./data:/data
    networks:
      - proxy
    expose:
      - "3000"
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    security_opt:
      - no-new-privileges:true

networks:
  proxy:
    external: true
    name: reverse-proxy
```

`deploy/.env.example`:

```dotenv
APP_VERSION=sha-0123456789abcdef0123456789abcdef01234567
```

Replace `OWNER` with the lowercase GitHub owner. Create the shared network once with `docker network create reverse-proxy`, then attach the existing reverse-proxy container to it. No application service publishes a host port. If the existing proxy stack cannot join a shared network, bind host ports to a LAN-restricted address instead and update the upstreams; never publish them on all interfaces by accident.

Database host directory:

```bash
mkdir -p data
# Set ownership to the numeric UID/GID used by the backend image.
```

Confirm the actual runtime UID from the built image before `chown`. Do not make the directory world-writable.

## 12. Outer reverse-proxy Nginx example

This belongs in the existing TLS/Let's Encrypt reverse-proxy container. Both containers must share the `reverse-proxy` Docker network.

```nginx
server {
    listen 80;
    server_name myapp.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name myapp.example.com;

    # Keep the certificate directives generated/managed by the existing
    # Let's Encrypt setup here.
    ssl_certificate /etc/letsencrypt/live/myapp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myapp.example.com/privkey.pem;

    auth_basic "Car Tracker";
    auth_basic_user_file /etc/nginx/auth/car-tracker.htpasswd;

    client_max_body_size 16k;

    location /api/ {
        proxy_pass http://car-tracker-backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location / {
        proxy_pass http://car-tracker-frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
}
```

Important `proxy_pass` behavior: there is no trailing URI component, so `/api/fuel` reaches the backend unchanged as `/api/fuel`.

Basic Auth is acceptable only with HTTPS. Create the password file outside Git, mount it read-only into the proxy, and use a strong unique password. Validate with `nginx -t` before reload.

## 13. GitHub Actions CI and image publication

Triggers:

- Pull requests: quality/test/build and Docker build validation, no push.
- Push to `main`: same checks, then publish `main` and immutable `sha-<40-character SHA>` images.
- Version tag `v*`: same checks, then publish version, major/minor where appropriate, and SHA images.

Permissions must be least privilege: `contents: read`; image job adds `packages: write`. Do not run image publishing for fork pull requests. Use job concurrency to cancel superseded branch checks, but do not cancel an in-progress release publication.

`.github/workflows/ci.yml` implementation outline:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]
    tags: ["v*"]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ !startsWith(github.ref, 'refs/tags/v') }}

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:coverage
      - run: npm run build

  images:
    needs: verify
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        include:
          - component: frontend
            image: car-tracker-frontend
          - component: backend
            image: car-tracker-backend
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Log in to GHCR
        if: github.event_name == 'push'
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Generate tags and labels
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/${{ matrix.image }}
          tags: |
            type=raw,value=main,enable={{is_default_branch}}
            type=sha,prefix=sha-,format=long
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
      - name: Build and optionally publish
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ matrix.component }}/Dockerfile
          push: ${{ github.event_name == 'push' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ matrix.component }}
          cache-to: type=gha,mode=max,scope=${{ matrix.component }}
          platforms: linux/amd64
```

If the home server is ARM64, change `platforms` to `linux/arm64`; if images must support both, use `linux/amd64,linux/arm64` and accept longer builds. Choose based on `docker info --format '{{.Architecture}}'` on the server.

For supply-chain hardening, pin third-party actions to full reviewed commit SHAs while leaving a comment with the release tag. Major tags above are readable examples, not immutable pins.

Definition of “CI ends with Docker image deployment” for this project: after every successful push/tag workflow, CI pushes both production images to GHCR. Deployment to the home server is intentionally a separate manual pull/recreate step.

## 14. Home-server release and rollback

Initial private-GHCR login on the server uses a fine-grained/read-only credential where supported, or a classic token with only `read:packages`. Store it through Docker's credential mechanism; do not put it in Compose.

Release:

1. Wait for both SHA-tagged images to publish successfully.
2. Set `APP_VERSION=sha-<full commit SHA>` in the server `.env`.
3. Back up SQLite with its online backup command before schema-changing releases.
4. Run `docker compose pull`.
5. Run `docker compose up -d`.
6. Inspect `docker compose ps` and backend logs.
7. Open the authenticated site and create no synthetic production row merely for testing.

Rollback:

1. Restore the previous immutable `APP_VERSION`.
2. Run `docker compose pull && docker compose up -d`.
3. Restore the database only if the release made an incompatible schema change. V1 startup SQL is additive/idempotent, so normal image rollback should not require this.

Backup example executed on the host with SQLite available:

```bash
sqlite3 ./data/car.sqlite ".backup './backups/car-$(date +%F-%H%M%S).sqlite'"
```

Schedule backups separately and test restoration periodically. Never copy only the live main database file while WAL writes may be active.

## 15. Phased implementation workflow

This section is the execution contract for an implementation agent. Implement exactly one phase at a time. A phase includes its code, tests, documentation, and acceptance checks.

### Mandatory review-stop protocol

For every phase, the implementing agent must:

1. Read the complete handout and inspect the current repository state.
2. Implement only the current phase. Do not create functional code or configuration assigned to a later phase, except for the smallest compile-only placeholder explicitly allowed by the current phase.
3. Add or update the tests required by that phase in the same change.
4. Run every phase-specific command plus all checks inherited from completed phases.
5. Fix failures caused by the phase. Do not weaken assertions, coverage thresholds, strictness, or lint rules to make checks pass.
6. Present a review packet containing:
   - phase name and result;
   - files added, changed, or deleted;
   - important implementation decisions and any deviation from this handout;
   - exact commands run and whether each passed;
   - test cases added;
   - known limitations, risks, and questions;
   - concise manual review instructions.
7. Stop. Do not begin, scaffold, or propose a patch for the next phase in the same implementation turn.

The next phase starts only after the user explicitly approves the completed phase. Questions, review feedback, and change requests keep the agent in the current phase. Apply requested changes, rerun the gate, issue a revised review packet, and stop again. Silence, an unrelated question, or a request for explanation is not approval to continue.

Recommended approval phrase: `Approve Phase N and begin Phase N+1.`

If the phase uncovers a decision that materially changes the schema, public API, architecture, deployment model, security boundary, or later phase scope, stop and ask one focused question before implementing that decision.

### Phase 1: repository foundation and code hygiene

Goal: establish a reproducible, strict monorepo in which both applications can compile and the quality commands are stable.

Implement:

- Root npm-workspaces structure for `backend` and `frontend`.
- Root and workspace `package.json` files with the scripts from section 3.
- One committed root `package-lock.json`, produced by the selected Node/npm versions.
- Root `tsconfig.base.json` plus workspace TypeScript configurations.
- ESLint flat configuration for Node/Express and browser/React files.
- Prettier configuration and `.prettierignore`.
- `.editorconfig`, `.gitignore`, and `.dockerignore`.
- Minimal backend compile target, such as an exported placeholder function. Do not create Express routes, SQLite code, or production startup behavior.
- Minimal Vite React page proving the frontend toolchain works. Do not create the car-tracker panels or API client.
- Vitest configuration in both workspaces and one trivial, meaningful test per workspace proving test discovery works.
- Root README containing prerequisites, install commands, development commands, and the phase-review rule.

Tests:

- Backend test runner discovers and passes a TypeScript test.
- Frontend `jsdom` test runner renders the minimal root component.
- No coverage threshold is required for the placeholders. Configure the final 80% threshold now only if placeholder files are excluded explicitly and narrowly.

Required gate:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Review focus:

- Dependency set remains minimal.
- The lockfile is committed and `npm ci` works from a clean checkout.
- Strict TypeScript, ESLint, and Prettier apply to both workspaces.
- No Phase 2+ behavior is hidden in scaffolding.

Hard stop: submit the Phase 1 review packet and wait for approval.

### Phase 2: SQLite and domain-validation core

Prerequisite: Phase 1 explicitly approved.

Goal: implement and fully test persistence, record mapping, and input validation without exposing HTTP endpoints.

Implement:

- `backend/src/schema.sql` exactly as specified in section 4.
- `backend/src/config.ts` parsing for database-related configuration needed in this phase.
- `backend/src/db.ts` with parent-directory creation, connection initialization, and schema execution.
- A separate narrow database interface, SQLite implementation with prepared statements and close behavior, and pure row-mapping helpers under `backend/src/database/`.
- Typed domain/request/response shapes for fuel, AdBlue, and expenses.
- `validation/common.ts` and all three resource validators.
- Exact string-based liter conversion, whole-HUF parsing, and canonical response formatting.
- Row-to-API mapping, including SQLite integer Boolean conversion and field-name conversion.
- Test database helper using a unique temporary directory and real on-disk SQLite file.

Do not implement:

- Express application, routers, middleware, `listen()`, React forms, Docker, or CI.

Unit tests:

- Every validation and conversion case listed under “Backend unit tests” in section 8.
- Boundaries for dates, odometer, liters, HUF amounts, unit price, Boolean, optional text, and unknown fields.
- Database row-to-response mapping, canonical liter padding, and whole-HUF formatting.

Database integration tests:

- Schema initializes on a new file and can initialize again without error.
- All three tables accept valid inserts and return expected values.
- Database `CHECK` constraints reject invalid direct writes.
- List queries use `event_date DESC, id DESC`.
- WAL, foreign keys, and 5000 ms busy timeout are active.
- Closing and reopening preserves records.
- Temporary files and connections are cleaned after tests.

Required gate:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test --workspace backend
npm run test:coverage --workspace backend
npm run build --workspace backend
```

Coverage: enforce the 80% backend thresholds now. Exclusions are limited to generated declarations and the not-yet-created process entry point.

Review focus:

- Storage uses integer milliliters for volume and integer HUF for money, never SQLite `REAL`.
- API-boundary liters and HUF strings are parsed without `parseFloat()`; fractional HUF is rejected.
- Database ownership and lifecycle are explicit and testable.
- No HTTP or frontend scope has leaked into this phase.

Hard stop: submit the Phase 2 review packet and wait for approval.

### Phase 3: Express API and backend integration

Prerequisite: Phase 2 explicitly approved.

Goal: expose the completed domain/database core through the full V1 HTTP API and verify integration from HTTP request through SQLite response.

Implement:

- Typed HTTP-safe errors and standard error envelope in `errors.ts`.
- Route factories for fuel, AdBlue, expenses, and health with database injection.
- `app.ts` with disabled `x-powered-by`, 16 KB JSON limit, content-type enforcement, routers, JSON API 404, payload-too-large handling, and sanitized final error middleware.
- `config.ts` parsing for `HOST`, `PORT`, and `DATABASE_PATH`.
- `index.ts` startup, one startup log line, signal handling, server close, and DB close.
- All endpoints and status codes from section 5.
- Backend README details for environment variables and local API use.

Do not implement:

- Frontend API client or UI, Dockerfiles, Compose, Nginx, or GitHub Actions.

Unit tests:

- Typed error-to-envelope mapping.
- Configuration defaults, valid overrides, and invalid port/path handling.
- Any new pure middleware helpers.

Backend module integration tests:

- Use Supertest with the real Express app and a real temporary SQLite database; do not bind a TCP port.
- Execute every resource and cross-cutting case listed under “Backend module integration tests” in section 8.
- Verify a rejected POST writes no row.
- Verify response content type, status, canonical fields, sorting, and sanitized errors.
- Test signal shutdown logic through an extracted/testable shutdown coordinator rather than sending signals to the test runner.

Required gate:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test --workspace backend
npm run test:coverage --workspace backend
npm run build --workspace backend
```

Coverage: retain at least 80% for backend lines, statements, functions, and branches.

Manual review:

1. Start the backend with a disposable local database.
2. Call `/api/health` and one GET endpoint.
3. POST one valid disposable record and confirm it is returned by GET.
4. Remove the disposable database afterward. Do not use production data.

Review focus:

- Route modules coordinate validated input and prepared database operations without duplicating domain rules.
- Errors never expose stack traces or SQL details.
- `app.ts` is importable without opening a port.
- All resource routes behave consistently.

Hard stop: submit the Phase 3 review packet and wait for approval.

### Phase 4: React SPA and frontend integration

Prerequisite: Phase 3 explicitly approved.

Goal: implement the complete accessible V1 user interface against the approved API contract.

Implement:

- `types.ts` containing frontend representations of every API request, record, and error envelope.
- `api.ts` typed request wrapper and the six resource functions from section 7.
- Formatting and lightweight client-validation helpers.
- `FuelPanel`, `AdBluePanel`, `ExpensesPanel`, shared status/table components, and the three-panel app shell.
- All loading, empty, success, failure, pending-submit, reset, and refresh behavior from section 7.
- Semantic labels, keyboard-operable tab buttons, `aria-live` messages, accessible tables, and visible focus states.
- Responsive CSS with narrow-screen table scrolling.
- Currency formatting hard-coded to `HUF`, with no currency environment variable or build option.
- README instructions for frontend development against a local backend. Configure Vite development proxying for `/api` if needed; production requests must stay relative.

Do not implement:

- Dockerfiles, production Nginx, Compose, outer reverse-proxy configuration, or GitHub Actions.

Unit tests:

- All cases under “Frontend unit tests” in section 8.
- Exact API function method, path, headers, request body, success parsing, and error parsing.

Frontend module integration tests:

- All panel and app-level cases under “Frontend module integration tests” in section 8.
- Mock exported `api.ts` functions; do not introduce Mock Service Worker unless a concrete test gap requires it and the user approves the new dependency.
- Verify accessible roles/names for tabs, forms, errors, and status messages.

Required gate:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Coverage: both workspaces must meet at least 80% for lines, statements, functions, and branches.

Manual review:

1. Run the approved backend against a disposable database and start Vite.
2. Inspect all three panels at desktop and narrow viewport widths.
3. Create one disposable record of each type and confirm refreshed ordering and formatting.
4. Trigger one client validation error and one simulated/unavailable-backend error.
5. Check keyboard-only navigation and labels.
6. Delete the disposable database afterward.

This is manual component/system review, not an automated E2E suite.

Review focus:

- UI matches the exact approved API contract.
- Liter/HUF strings and calendar dates are not accidentally rounded or timezone-shifted.
- Failure never clears user input.
- The interface remains simple and readable on mobile and desktop.

Hard stop: submit the Phase 4 review packet and wait for approval.

### Phase 5: production containers and reverse-proxy deployment files

Prerequisite: Phase 4 explicitly approved.

Goal: package the approved applications into two minimal production containers and supply safe home-server deployment configuration.

Implement:

- Backend multi-stage Dockerfile with compiled JavaScript, production dependencies, non-root runtime, `/data` volume, and no source/dev dependencies in the final stage.
- Frontend multi-stage Dockerfile with Vite build and static Nginx runtime.
- Inner frontend Nginx SPA/cache configuration.
- `deploy/compose.example.yml`, `.env.example`, and outer reverse-proxy example from sections 11 and 12.
- Shared external Docker network configuration with no published application ports.
- Backend container health check.
- README instructions for image build, shared-network creation, bind-mount ownership, Compose startup, Nginx validation, and local teardown.
- Document the chosen target architecture: `linux/amd64`, `linux/arm64`, or both. Do not guess; inspect or ask for the home-server architecture if it is not known.

Packaging checks:

- Confirm runtime images do not contain TypeScript source, test files, or dev-only packages.
- Confirm the backend process runs non-root and can create/write `/data/car.sqlite` with documented host permissions.
- Confirm the frontend serves a nested SPA path via `index.html` and applies the intended cache headers.
- Confirm `/api/fuel` reaches the backend with the `/api` prefix unchanged.
- Confirm both services can join the existing reverse-proxy network by service/container DNS name.
- Confirm replacing the backend container preserves SQLite data.

Required gate:

```bash
npm run check
docker build -f backend/Dockerfile -t car-tracker-backend:test .
docker build -f frontend/Dockerfile -t car-tracker-frontend:test .
docker compose -f deploy/compose.example.yml config
```

Also run safe container inspection and disposable-data checks needed to prove the packaging checks. Do not connect to, reload, or modify the user's real reverse proxy or production Compose project during this phase unless separately requested.

No automated browser E2E suite is added. Container startup and persistence checks are packaging/module integration checks.

Review focus:

- Images are small, deterministic, and contain only runtime requirements.
- Persistent data is outside the disposable backend filesystem.
- No service accidentally binds a public host port.
- TLS and Basic Auth remain exclusively at the existing outer proxy.

Hard stop: submit the Phase 5 review packet and wait for approval.

### Phase 6: GitHub Actions, GHCR publication, and operational handoff

Prerequisite: Phase 5 explicitly approved.

Goal: make every change verifiable in hosted CI and finish successful push/tag workflows by publishing both immutable production images to GHCR.

Implement:

- `.github/workflows/ci.yml` using the triggers, permissions, concurrency, verification job, image matrix, cache scopes, and tags from section 13.
- Pull requests build both images without logging into or pushing to GHCR.
- `main` pushes `main` and full-SHA tags for both images.
- `v*` tags push semantic-version and full-SHA tags for both images.
- Set the approved container platform or multi-platform list from Phase 5.
- Pin third-party actions to reviewed full commit SHAs and annotate each pin with its release tag.
- Document GHCR package visibility/linkage and the home server's read-only authentication requirements.
- Complete release, rollback, SQLite backup/restore, and troubleshooting instructions.
- Add a release checklist that pins `APP_VERSION` to `sha-<full SHA>`.

CI validation:

- Local workflow syntax/configuration review.
- Open or update a pull request and confirm `verify` plus both matrix image builds pass without publishing.
- After approval to merge/push, confirm `main` publishes both images with the same full-SHA tag.
- Confirm the home server can pull both exact SHA tags. Do not start or replace production containers unless explicitly requested.
- If a release tag is part of the requested rollout, verify semantic tags point to the same image digests as that commit's SHA tags.

Required local gate before remote CI:

```bash
npm ci
npm run check
docker build -f backend/Dockerfile -t car-tracker-backend:test .
docker build -f frontend/Dockerfile -t car-tracker-frontend:test .
docker compose -f deploy/compose.example.yml config
```

Security review:

- Workflow permissions are `contents: read` globally and `packages: write` only in the publishing job.
- Publishing is impossible for pull requests.
- No home-server SSH key, Basic Auth password, SQLite data, `.env`, or registry pull token enters source control or build context.
- CI publishes application images only; it does not reach into the home network.

Review focus:

- Every check is required before image publication.
- Frontend and backend use the same commit-derived immutable tag.
- The documented manual deployment and rollback are reproducible.
- The final state satisfies every item in section 16.

Hard stop: submit the Phase 6 review packet. The implementation is complete only after final user approval; do not deploy to the production home server without a separate explicit request.

## 16. V1 definition of done

- All three forms create valid records and all three tables display complete datasets newest-event-first.
- Backend rejects invalid input, stores money only as integer HUF, and never stores floating-point money or volume.
- Event date and creation timestamp remain distinct.
- Unit and module integration suites pass with at least 80% coverage thresholds.
- Formatting, lint, strict typecheck, tests, application builds, and Docker builds pass in CI.
- CI publishes two private, immutable SHA-tagged GHCR images.
- Compose persists `/data/car.sqlite` outside the backend container.
- Existing Nginx enforces HTTPS and Basic Auth for frontend and API.
- Neither application container publishes a public host port when using the shared proxy network.
- Deployment and rollback use a pinned immutable image tag.
- No E2E suite, edit/delete API, pagination, multi-user auth, analytics, or charting has been added.

## 17. Deferred features

Do not implement these in V1: edit/delete, filters, pagination, CSV export, consumption calculations, dashboards/charts, service schedules, expense categories, multiple vehicles, accounts/JWTs, automated home-server SSH deployment, self-hosted registry, or Artifactory.
