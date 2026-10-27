# Shared PostgreSQL service, one database and role per app

The car tracker moves from an embedded SQLite file to PostgreSQL running as a separate service. The main reason is that several apps will be hosted at home and all need a database; one shared Postgres server is preferred over each app carrying its own SQLite file. Learning and portability are secondary reasons.

Each app gets its own database and its own role on the shared PostgreSQL 17 server (`car_tracker` database, `car_tracker` role). The role has no privileges on other apps' databases. Each app owns and runs its own migrations. Apps do not read each other's data directly.

Provisioning is part of this migration's delivery, although an operator performs it in the separate shared-service deployment rather than in this checkout. The app repository owns the required topology, least-privilege SQL, credentials contract, and verification procedure in [the shared-service runbook](../shared-postgres-service.md).

## Consequences

- Backup and restore automation is deliberately deferred. It must be designed before the database holds data that needs to be retained; per-app restore will be possible with `pg_dump` of one database.
- Postgres being down takes every dependent app down; the backend health check must reflect database reachability.
- Provisioning a new app needs a one-time `CREATE ROLE` / `CREATE DATABASE` in the shared-service deployment, following the runbook.
- The `./data` volume and `DATABASE_PATH` configuration go away. The backend receives separately validated `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values, rather than a connection URL.

## Considered options

- Keep SQLite plus off-box backups (Litestream or scheduled copies): simpler, but each future app would repeat it.
- One database with a schema per app: shares roles and extensions, wider blast radius for a bad migration.
