# Car Tracker

Car Tracker is a small, single-user application for recording fuel,
AdBlue, and general expenses for one or more vehicles. It has a React frontend and an Express JSON API
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

A car is `{ "id": 1, "name": "Octavia", "createdAt": "2026-09-17T08:00:00.000Z" }`.
Car names are trimmed, must be 1 to 60 characters, and are unique ignoring
ASCII case. `GET /api/cars` returns `200` with all cars sorted by name
(case-insensitive), then ID; `POST /api/cars` returns `201` with the new car;
`PUT /api/cars/:carId` renames a car and returns `200` with the updated car.
Cars cannot be deleted. A duplicate name returns `409` with the error code
`CONFLICT` and field `name`. Renaming an unknown car returns `404 NOT_FOUND`
(field `carId`), and an invalid name returns `400 VALIDATION_ERROR` (field
`name`).

Record request and response bodies are unchanged and do not contain a car ID.
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

Press `Ctrl+C` to close the HTTP server and SQLite connection. Remove the
disposable database and its `-wal`/`-shm` files after testing.

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

## Production containers

The production images target `linux/amd64`, matching the home server. They are
built from the repository root so the shared contracts workspace is available
to both build stages:

```bash
docker build -f backend/Dockerfile -t car-tracker-backend:test .
docker build -f frontend/Dockerfile -t car-tracker-frontend:test .
```

The backend image contains compiled JavaScript and production dependencies
only, runs as the built-in numeric `node` user (UID/GID `1000`), and persists
SQLite data at `/data/car.sqlite`. The frontend image is static Nginx content.

### Home-server Compose setup

Do this in a new deployment directory, outside the Git checkout if preferred:

```bash
mkdir -p car-tracker-deploy/data
cp deploy/compose.example.yml car-tracker-deploy/compose.yml
cp deploy/.env.example car-tracker-deploy/.env
docker network create reverse-proxy
```

Replace `OWNER` in `compose.yml` with the lowercase GitHub owner. Set
`APP_VERSION` in `.env` to an immutable `sha-<full commit SHA>` image tag after
publication. The `reverse-proxy` network is external: attach the existing TLS
reverse-proxy container to it separately. Neither application service publishes
a host port.

The bind mount must be writable by the backend's runtime user and must not be
world-writable:

```bash
chown 1000:1000 car-tracker-deploy/data
chmod 750 car-tracker-deploy/data
```

Confirm the UID/GID before setup with:

```bash
docker run --rm --entrypoint id car-tracker-backend:test
```

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
the deployment directory. This removes containers but retains `./data` and its
SQLite database. Remove that directory manually only when the data is no longer
needed.

### Upgrading an existing deployment

The multi-car release changes the database schema without a migration, and the
backend refuses to start on an old database. Follow the release checklist below
through the image pull and the backup step (see Backup, rollback, and
troubleshooting), so the old records are saved first. Then run
`docker compose down` in the deployment directory and delete
`./data/car.sqlite` together with `./data/car.sqlite-wal` and
`./data/car.sqlite-shm` (they are `/data/car.sqlite`, `/data/car.sqlite-wal`,
and `/data/car.sqlite-shm` inside the container). Continue with the remaining
checklist steps; the backend creates a fresh database on start. For the local
production-stack test, run `docker compose -f deploy/compose.local.yml down -v`
to drop its volume. The proxy's `/api/` rule needs no change.

### Local production-stack test

`deploy/compose.local.yml` builds both application images from this checkout
and runs a local HTTP-only Nginx proxy. It does not use GHCR, your external
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

GitHub Actions runs formatting, linting, strict type checking, coverage tests,
application builds, and non-publishing `linux/amd64` Docker builds for every
pull request and eligible push. Docker publication is manual: use **Run
workflow** in GitHub Actions to publish a branch, or GitHub CLI/API with a tag
ref to publish a version tag. Pull requests and ordinary pushes never log in to
GHCR or publish an image. A manual run on `main` publishes `main` and immutable
`sha-<full commit SHA>` tags; a manual run on a `v*` tag also publishes the
matching version and major/minor version tags.

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
2. Review and merge the pull request. In GitHub Actions, choose **Run
   workflow**, select `main`, and confirm both `publish-images` matrix entries
   publish `car-tracker-frontend` and `car-tracker-backend` with the same
   full-SHA tag.
3. On the home server, pull both exact tags before changing containers:

   ```bash
   docker pull ghcr.io/OWNER/car-tracker-frontend:sha-<full-commit-sha>
   docker pull ghcr.io/OWNER/car-tracker-backend:sha-<full-commit-sha>
   ```

4. Back up the SQLite database before any schema-changing release.
5. Set `APP_VERSION=sha-<full-commit-sha>` in the deployment directory's
   private `.env`; never use the mutable `main` tag for a release.
6. Run `docker compose pull && docker compose up -d`, then inspect
   `docker compose ps` and `docker compose logs backend`.
7. Open the authenticated application. Do not create synthetic production rows
   just to test the deployment.

For a versioned release, push an annotated tag after the commit is on `main`,
then manually dispatch the workflow against that tag with GitHub CLI:

```bash
git tag -a v1.0.0 -m 'v1.0.0'
git push origin v1.0.0
gh workflow run ci.yml --ref v1.0.0
```

After its workflow completes, verify that the semantic tags and that commit's
`sha-<full-commit-sha>` tag resolve to the same image digest for each package.

### Backup, rollback, and troubleshooting

Run SQLite's online backup command on the server; do not copy only a live main
database file while WAL writes may be active:

```bash
mkdir -p backups
sqlite3 ./data/car.sqlite ".backup './backups/car-$(date +%F-%H%M%S).sqlite'"
```

To roll back, restore the prior immutable SHA in `.env`, then run:

```bash
docker compose pull && docker compose up -d
```

Schema initialization is idempotent, so an ordinary image rollback between
multi-car releases does not require restoring the database. Rolling back from
the multi-car release to a single-car image requires restoring the pre-upgrade
backup, and loses every record entered since the upgrade. Restore a backup
whenever a rollback crosses an incompatible schema change, such as this
release, and test restoration periodically.

If pulls fail, confirm the registry login uses a package-read credential and
that package visibility/linkage permits the account access. If a container does
not start, check `docker compose ps`, then `docker compose logs backend` or
`docker compose logs frontend`; confirm `APP_VERSION` exists for both images
and that `./data` is owned by the backend runtime UID/GID. If the proxy returns
an error, validate its configuration with `nginx -t`, confirm all containers are
on `reverse-proxy`, and check that its `/api/` upstream preserves the `/api`
prefix. CI never accesses the home server, SSH, Basic Auth material, or SQLite
data.
