# Shared PostgreSQL service, one database and role per app

The car tracker moves from an embedded SQLite file to PostgreSQL running as a separate service. The main reason is that several apps will be hosted at home and all need a database; one shared Postgres server is preferred over each app carrying its own SQLite file. Learning and portability are secondary reasons.

Each app gets its own database and its own role on the shared server (`car_tracker` database, `car_tracker` role). The role has no privileges on other apps' databases. Each app owns and runs its own migrations. Apps do not read each other's data directly.

## Consequences

- Backups and restores of the server are a platform concern, outside this repo. Per-app restore is possible with `pg_dump` of one database.
- Postgres being down takes every dependent app down; the backend health check must reflect database reachability.
- Provisioning a new app needs a one-time `CREATE ROLE` / `CREATE DATABASE`, done in the Postgres service's own project, not in this one.
- The `./data` volume and `DATABASE_PATH` configuration go away, replaced by a connection URL.

## Considered options

- Keep SQLite plus off-box backups (Litestream or scheduled copies): simpler, but each future app would repeat it.
- One database with a schema per app: shares roles and extensions, wider blast radius for a bad migration.
