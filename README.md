# Car Tracker

Car Tracker is a small, single-user application for recording fuel,
AdBlue, and general expenses for one or more cars. It has a React frontend and an Express JSON API
backed by PostgreSQL. The repository is organized as npm workspaces for shared
`@car-tracker/contracts`, the backend, and the frontend.

All monetary values are whole Hungarian forints. Fuel and AdBlue total prices,
and general expense amounts are stored as integer HUF values; fractional
HUF input is not accepted. Liter quantities retain three-decimal precision.

## Prerequisites

- Node.js 24 LTS (the lockfile was produced with Node.js 24.20.0)
- npm 11 (the lockfile was produced with npm 11.19.0)
- Docker with Compose, for the development database and the container builds

Run `nvm use` from the repository root when using nvm. npm installations fail
on Node versions below 24, and unreviewed dependency install scripts are
rejected.

## Install

Install the exact dependency versions recorded in the root lockfile:

```bash
npm ci
```

## Development

Development runs the backend and frontend on the host, against a PostgreSQL
container. Start the database first (see [Development database](#development-database)):

```bash
npm run db:up
```

Apply the database migrations. The backend never migrates on its own, so run
this on a fresh database and after pulling a change that adds a migration:

```bash
npm run migrate --workspace backend
```

Then run both development processes together:

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
development. Start the backend first, then open the Vite URL shown in the
frontend terminal. `Ctrl+C` closes the HTTP server and the PostgreSQL pool.

### Backend environment

The backend accepts these environment variables:

- `HOST`: listen address; defaults to `0.0.0.0`.
- `PORT`: integer from `1` through `65535`; defaults to `3000`.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL
  connection parameters, passed to the driver separately (never as a URL, so
  passwords may contain `@` or `/`). `DB_PORT` is an integer from `1` through
  `65535`. Outside production they default to the development container
  below (`127.0.0.1:5432`, database, user and password `car_tracker`); with
  `NODE_ENV=production` all five are required.

### Development database

`deploy/compose.dev.yml` defines a single PostgreSQL 17 service and no
application containers. Start it, published on `127.0.0.1:5432` only:

```bash
npm run db:up
```

`npm run db:down` stops it; data persists in a Docker volume.

### Schema changes

The schema is defined in `backend/src/schema.ts`. After changing it, generate
a new SQL migration into `backend/drizzle/` and commit it with the schema
change:

```bash
cd backend && npx drizzle-kit generate --name <short-description>
```

Migrations run in order through the `migrate` entry point, both in development
and in the deployed `migrate` service.

## API

The API endpoints are:

```text
GET  /api/health
GET  /api/cars
POST /api/cars
PUT  /api/cars/:carId
GET  /api/cars/:carId/fuel
POST /api/cars/:carId/fuel
PUT  /api/cars/:carId/fuel/:id
DELETE /api/cars/:carId/fuel/:id
GET  /api/cars/:carId/adblue
POST /api/cars/:carId/adblue
PUT  /api/cars/:carId/adblue/:id
DELETE /api/cars/:carId/adblue/:id
GET  /api/cars/:carId/expenses
POST /api/cars/:carId/expenses
PUT  /api/cars/:carId/expenses/:id
DELETE /api/cars/:carId/expenses/:id
```

Every fuel, AdBlue, and expense record belongs to exactly one car, so create a
car first and use its `id` in the record URLs. For example:

```bash
curl http://127.0.0.1:3000/api/health
curl -X POST http://127.0.0.1:3000/api/cars \
  -H 'Content-Type: application/json' \
  -d '{"name":"Octavia"}'
curl http://127.0.0.1:3000/api/cars
curl -X PUT http://127.0.0.1:3000/api/cars/1 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Octavia Combi"}'
curl http://127.0.0.1:3000/api/cars/1/fuel
curl -X POST http://127.0.0.1:3000/api/cars/1/fuel \
  -H 'Content-Type: application/json' \
  -d '{"eventDate":"2026-09-17","odometerKm":82450,"liters":"47.300","price":"29284","fullTank":true,"remark":"Shell"}'
curl -X PUT http://127.0.0.1:3000/api/cars/1/fuel/1 \
  -H 'Content-Type: application/json' \
  -d '{"eventDate":"2026-09-18","odometerKm":82500,"liters":"46.800","price":"29000","fullTank":true,"remark":"Updated"}'
curl -i -X DELETE http://127.0.0.1:3000/api/cars/1/fuel/1
```

`GET /api/health` runs `SELECT 1` against PostgreSQL with a 2-second limit. It
returns `200 {"status":"ok"}` when the database answers and
`503 {"status":"unavailable"}` when it does not. The backend keeps running
while the database is down and reconnects once it is back.

A car is `{ "id": 1, "name": "Octavia", "createdAt": "2026-09-17T08:00:00.000Z" }`.
Car names are trimmed, must be 1 to 60 characters, and are unique ignoring
ASCII case. `GET /api/cars` returns `200` with all cars sorted by name
(case-insensitive), then ID; `POST /api/cars` returns `201` with the new car;
`PUT /api/cars/:carId` renames a car and returns `200` with the updated car.
Cars cannot be deleted. A duplicate name returns `409` with the error code
`CONFLICT` and field `name`. Renaming an unknown car returns `404 NOT_FOUND`
(field `carId`), and an invalid name returns `400 VALIDATION_ERROR` (field
`name`).

Record request and response bodies do not contain a car ID; the car comes from
the URL.
Successful record creates return `201`, lists and updates return `200`, and
successful deletes return `204` with an empty body. Records are only visible
through their own car's URLs. A `carId` or record `id` that is not a positive
safe integer returns `400 VALIDATION_ERROR` (field `carId` or `id`), and an
unknown car or record returns the standard JSON `404 NOT_FOUND` error envelope
(field `carId` or `id`). Nested routes validate in this order: `carId` format,
car existence, record `id`, then the request body.

Body checks apply to every `POST` and `PUT` under `/api/cars` before the
`carId` is validated: a `Content-Type` other than `application/json` returns
`415 UNSUPPORTED_MEDIA_TYPE`, a body over 16 KB returns `413`, and malformed
JSON returns `400`. So a request with a bad body and a bad `carId` reports the
body problem.

## Quality checks

Before creating a commit, run `npm run check` and make sure it passes. The
pre-commit hook runs this gate automatically; create commits only after all
checks pass.

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

Backend tests need neither Docker nor the development database: each test file
starts its own throwaway PostgreSQL 17 through `embedded-postgres`. PostgreSQL
refuses to run as root, so run the tests as a regular user.

## Compose files

All live in `deploy/`:

- `compose.dev.yml`: PostgreSQL only, for `npm run dev` (see above).
- `compose.local.yml`: the whole application built from this checkout, for a
  local production-like test (see [Local production-stack test](#local-production-stack-test)).
- `compose.example.yml`: the home-server template (see
  [Home-server Compose setup](#home-server-compose-setup)).

## Production containers

The production images target `linux/amd64`, matching the home server. They are
built from the repository root so the shared contracts workspace is available
to both build stages:

```bash
docker build -f backend/Dockerfile -t car-tracker-backend:test .
docker build -f frontend/Dockerfile -t car-tracker-frontend:test .
```

The backend image contains compiled JavaScript and production dependencies,
and the Drizzle migrations; it runs as the built-in numeric `node` user (UID/GID
`1000`) and stores data in PostgreSQL. It has two entry points: `dist/index.js`
(the server, default) and `dist/migrate.js` (applies pending migrations and
exits). The frontend image is static Nginx content.

### Home-server Compose setup

Do this in a new deployment directory, outside the Git checkout if preferred:

```bash
mkdir -p car-tracker-deploy
cp deploy/compose.example.yml car-tracker-deploy/compose.yml
cp deploy/.env.example car-tracker-deploy/.env
docker network create reverse-proxy
```

Replace `OWNER` in `compose.yml` with the lowercase GitHub owner. Fill in
the `DB_*` values in `.env`, and set `APP_VERSION` to an immutable
`sha-<full commit SHA>` image tag after publication.

Both networks are external. Attach the existing TLS reverse-proxy container to
`reverse-proxy` separately. `database` is the network of the shared PostgreSQL
service, which already holds the `car_tracker` database and role (see the
[Shared Postgres README](https://github.com/bercee/docker-services/blob/main/postgres/README.md));
the `migrate` and `backend` services join it. No service publishes a host
port.

On `docker compose up`, the one-shot `migrate` service applies pending
migrations first; the `backend` starts only after it exits successfully. A
failing migration leaves `backend` uncreated and `migrate` exited non-zero, so
check `docker compose logs migrate`. Migrations are not applied by the backend
itself.

From the deployment directory, validate the generated configuration and start
the containers:

```bash
docker compose config
docker compose pull
docker compose up -d
docker compose ps
```

Copy `deploy/reverse-proxy.example.conf` into the existing TLS proxy's managed
configuration, replacing the example hostname and retaining that proxy's
certificate directives. Basic Auth and TLS stay exclusively in that outer
proxy. Validate its configuration with `nginx -t` before any separately
approved reload. The `/api/` `proxy_pass` has no URI suffix, preserving request
paths such as `/api/cars`.

For local teardown of this example deployment, run `docker compose down` from
the deployment directory. This removes containers; the data stays in PostgreSQL.

### Local production-stack test

`deploy/compose.local.yml` builds both application images from this checkout,
starts a throwaway PostgreSQL 17 container, runs the `migrate` step, and runs a
local HTTP-only Nginx proxy. It does not use GHCR, your external
proxy network, TLS, or Basic Auth. Only the proxy binds a host port, and it is
limited to `127.0.0.1:8080`.

```bash
docker compose -f deploy/compose.local.yml up --build
```

Open `http://127.0.0.1:8080` or check the complete proxy path with:

```bash
curl http://127.0.0.1:8080/api/health
```

The test database is a Docker-managed named volume and survives normal
teardown. Stop the stack while retaining it with:

```bash
docker compose -f deploy/compose.local.yml down
```

Remove the disposable database too with:

```bash
docker compose -f deploy/compose.local.yml down -v
```

## CI, GHCR, and releases

Two GitHub Actions workflows live in `.github/workflows/`:

- `pr.yml` runs on every pull request: formatting, linting, strict type
  checking, coverage tests, application builds, and non-publishing
  `linux/amd64` Docker builds. It never logs in to GHCR.
- `release.yml` is manual (**Run workflow**, or `gh workflow run release.yml
-f version=0.2.0`) and only runs on `main`. It re-runs the same checks, then
  publishes both images to GHCR as `X.Y.Z`, `X.Y`, `sha-<full commit SHA>` and
  `latest`, and finally creates the `v<version>` git tag and a GitHub Release
  with generated notes. It fails early if the version is not `X.Y.Z` or the tag
  already exists. Finally it bumps the patch version in every `package.json` and
  `package-lock.json` and pushes that commit to `main` using the `RELEASE_TOKEN`
  secret (a fine-grained token with `Contents: Read and write`, owned by a
  repository admin who can bypass the `main` ruleset). For a minor or major
  release, edit the version through a pull request before running the workflow.

Before the first publication, ensure GitHub Packages is enabled for the
repository. The workflow labels each image with its source repository; verify
on the package settings page that each package is linked to this repository and
inherits its access permissions. Keep both packages private unless a deliberate
visibility change is approved. The workflow uses its scoped `GITHUB_TOKEN` and
does not store registry credentials in the repository.

The home server needs Docker credentials with package-read access only. Create a
classic personal access token with only `read:packages`, then log in
interactively on the server so the token remains in Docker's credential store
and never in Compose, `.env`, or source control:

```bash
docker login ghcr.io
```

### Release checklist

1. Open a pull request and confirm `verify` and both `images` matrix builds
   pass. Those builds must report `push: false`.
2. Review and merge the pull request. In GitHub Actions, choose **Release >
   Run workflow**, and select `main`. Confirm both
   `publish-images` matrix entries publish `car-tracker-frontend` and
   `car-tracker-backend` with the same full-SHA tag.
3. On the home server, pull both exact tags before changing containers:

   ```bash
   docker pull ghcr.io/OWNER/car-tracker-frontend:sha-<full-commit-sha>
   docker pull ghcr.io/OWNER/car-tracker-backend:sha-<full-commit-sha>
   ```

4. Back up the database before any schema-changing release (see
   [Backup and restore](#backup-and-restore)).
5. Set `APP_VERSION=sha-<full-commit-sha>` in the deployment directory's
   private `.env`; prefer the immutable `sha-` tag or an `X.Y.Z` tag over the
   mutable `latest`.
6. Run `docker compose pull && docker compose up -d`, then inspect
   `docker compose ps`, `docker compose logs migrate` and
   `docker compose logs backend`.
7. Open the authenticated application. Do not create synthetic production rows
   just to test the deployment.

After the workflow completes, verify that the version tags and that commit's
`sha-<full-commit-sha>` tag resolve to the same image digest for each package.

### Backup and restore

Backups are manual until automation is designed (see
[ADR 0001](docs/adr/0001-shared-postgres-service.md)). Run this on the home
server before any schema-changing release, replacing `<postgres-container>` with the shared PostgreSQL container's name.
It writes a compressed dump of only the `car_tracker` database:

```bash
docker exec <postgres-container> pg_dump -U car_tracker -d car_tracker -Fc > car-tracker-$(date +%F).dump
```

Keep the dump off the server too, and check it is readable with
`pg_restore --list car-tracker-<date>.dump`. To restore, stop the backend, then
replace the database contents from the dump:

```bash
docker compose stop backend
docker exec -i <postgres-container> pg_restore -U car_tracker -d car_tracker --clean --if-exists --no-owner < car-tracker-<date>.dump
docker compose up -d
```

### Rollback and troubleshooting

To roll back a release, restore the prior SHA in `.env` and run the command
below. Migrations are not reverted automatically; if the release changed the
schema, restore its pre-release dump first.

```bash
docker compose pull && docker compose up -d
```

If pulls fail, confirm the registry login uses a package-read credential and
that package visibility/linkage permits the account access. If a container does
not start, check `docker compose ps`, then `docker compose logs migrate`,
`docker compose logs backend` or `docker compose logs frontend`; confirm `APP_VERSION` exists for both images
and that the `DB_*` settings reach the PostgreSQL server. If the proxy returns
an error, validate its configuration with `nginx -t`, confirm all containers are
on `reverse-proxy`, and check that its `/api/` upstream preserves the `/api`
prefix. CI never accesses the home server, SSH, Basic Auth material, or database
data.
