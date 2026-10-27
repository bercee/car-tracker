# Shared PostgreSQL service provisioning

This runbook provisions the shared PostgreSQL service required by Car Tracker.
It is executed in a separate, private deployment directory on the home server,
not from this repository. It is nevertheless part of this project's PostgreSQL
migration: it establishes the application contract in
[ADR 0001](adr/0001-shared-postgres-service.md).

The service runs PostgreSQL 17.10 without a published host port. Applications
join its external Docker network and authenticate with one generated role and
database per application. The example creates the `car_tracker` role and
database only; repeat the least-privilege pattern for another application.

## Prerequisites

- Docker Engine with the Compose plugin on the home server.
- A private deployment directory that is not this Git checkout.
- A safe way to generate secrets, such as `openssl rand -base64 32`.

Do not commit the deployment environment file or reuse either password below.
Backup and restore automation is intentionally deferred; this runbook does not
pretend that a local Docker volume is a backup.

## Create the service

Create a dedicated directory and lock down its environment file:

```bash
mkdir -p shared-postgres
cd shared-postgres
umask 077
openssl rand -base64 32
openssl rand -base64 32
```

Put the first generated value in `POSTGRES_PASSWORD` and the second in
`CAR_TRACKER_DB_PASSWORD` in a local `.env` file:

```dotenv
POSTGRES_PASSWORD=replace-with-generated-administrator-password
CAR_TRACKER_DB_PASSWORD=replace-with-generated-car-tracker-password
```

Then ensure it is readable only by its owner:

```bash
chmod 600 .env
```

Create `compose.yml` with the following content. `postgres:17.10` deliberately
pins both major and patch; review and change that tag as part of normal
PostgreSQL patch maintenance, never to `latest`.

```yaml
name: shared-postgres

services:
  postgres:
    image: postgres:17.10
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - database
    security_opt:
      - no-new-privileges:true

volumes:
  postgres-data:

networks:
  database:
    external: true
```

Create the shared, external network once and start PostgreSQL:

```bash
docker network create database
docker compose config --quiet
docker compose up -d
until docker compose exec -T postgres pg_isready -U postgres -d postgres; do sleep 1; done
docker compose ps
```

The Compose file intentionally has no `ports` section. PostgreSQL is reachable
only to containers attached to `database`; the service DNS name is `postgres`.

## Provision Car Tracker's database and role

Load the local secrets into the shell, then run the one-time bootstrap SQL.
This is for a new service; do not rerun it unchanged after the role exists.

```bash
set -a
. ./.env
set +a
docker compose exec -T postgres psql -U postgres -d postgres \
  --set=ON_ERROR_STOP=1 --set=car_tracker_password="$CAR_TRACKER_DB_PASSWORD" <<'SQL'
CREATE ROLE car_tracker LOGIN PASSWORD :'car_tracker_password';
CREATE DATABASE car_tracker OWNER car_tracker;
REVOKE ALL ON DATABASE car_tracker FROM PUBLIC;
GRANT CONNECT ON DATABASE car_tracker TO car_tracker;
SQL
```

When provisioning every subsequent application database, also run `REVOKE ALL
ON DATABASE its_database FROM PUBLIC` before granting its own role `CONNECT`.
That is what prevents `car_tracker` from connecting through PostgreSQL's
otherwise broad `PUBLIC` database privilege.

The administrator password remains only with the shared service. Give the Car
Tracker deployment only these values in its uncommitted deployment `.env`:

```dotenv
DB_HOST=postgres
DB_PORT=5432
DB_NAME=car_tracker
DB_USER=car_tracker
DB_PASSWORD=replace-with-CAR_TRACKER_DB_PASSWORD
```

## Verify isolation and connectivity

From the service directory, verify that a container on the private network can
connect with the application credentials:

```bash
docker run --rm --network database -e PGPASSWORD="$CAR_TRACKER_DB_PASSWORD" \
  postgres:17.10 psql -h postgres -U car_tracker -d car_tracker -c 'SELECT current_database(), current_user;'
```

For every other application database, the `car_tracker` role must not have
`CONNECT` privilege. Check it from the administrator account after those
databases exist:

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c \
  "SELECT has_database_privilege('car_tracker', 'other_app_database', 'CONNECT');"
```

It must return `false`. The Car Tracker deployment's backend and one-shot
migration service both join the same external `database` network; neither gets
the administrator credential. A successful application health check after the
migration is the final end-to-end verification.
