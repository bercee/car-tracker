# Shared PostgreSQL service, one database and role per app

The car tracker moves from an embedded SQLite file to PostgreSQL running as a separate service. The main reason is that several apps will be hosted at home and all need a database; one shared Postgres server is preferred over each app carrying its own SQLite file. Learning and portability are secondary reasons.

Each app gets its own database and its own role on the shared PostgreSQL 17 server (`car_tracker` database, `car_tracker` role). The role has no privileges on other apps' databases. Each app owns and runs its own migrations. Apps do not read each other's data directly.

The shared server is operated from the home-server deployment repo (`bercee/docker-services`, `postgres/`), which owns its topology, provisioning and verification: [Shared Postgres README](https://github.com/bercee/docker-services/blob/main/postgres/README.md). This repository owns only how Car Tracker uses it, see [the migration guide](../postgres-migration.md).

## Consequences

- Backup and restore automation is deliberately deferred. It must be designed before the database holds data that needs to be retained; per-app restore will be possible with `pg_dump` of one database.
- Postgres being down takes every dependent app down; the backend health check must reflect database reachability.
- Provisioning a new app needs a one-time `CREATE ROLE` / `CREATE DATABASE` in the shared-service deployment, following the Shared Postgres README.
- The `./data` volume and `DATABASE_PATH` configuration go away. The backend receives separately validated `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values, rather than a connection URL.

## Considered options

- Keep SQLite plus off-box backups (Litestream or scheduled copies): simpler, but each future app would repeat it.
- One database with a schema per app: shares roles and extensions, wider blast radius for a bad migration.
