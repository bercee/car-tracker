# Postgres port: sequenced issues (draft)

Draft for `bercee/car-tracker`. Context: [ADR 0001](adr/0001-shared-postgres-service.md), [ADR 0002](adr/0002-drizzle-and-migration-flow.md), and [GLOSSARY.md](../GLOSSARY.md). Multi-car support is complete, so the baseline migration can use its shipped schema. The shared Postgres and the `car_tracker` database and role are already provisioned (see the [Shared Postgres README](https://github.com/bercee/docker-services/blob/main/postgres/README.md)). This is a clean PostgreSQL start: the application neither imports nor deletes the existing SQLite file. Backups are deferred, see ADR 0001.

Create with `gh issue create`; then record blockers per `docs/agents/issue-tracker.md` (native dependencies, or a `Blocked by:` line at the top of the body).

---

## 1. Dev Postgres and `DB_*` configuration

Blocked by: none.

Add a PostgreSQL 17 Compose service for development, published on `127.0.0.1` only. Replace `DATABASE_PATH` in `config.ts` with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, validated like `HOST` and `PORT` today, and update `deploy/.env.example`. The backend passes them to the driver as separate parameters, never as a URL string.

Done when: config unit tests cover valid and invalid values, including passwords containing `@` and `/`, and the dev container starts with one command.

## 2. Tracer: Drizzle connection, `embedded-postgres` test harness, database-aware health check

Blocked by: 1.

Add Drizzle and `embedded-postgres` for PostgreSQL 17. A shared test helper starts a throwaway instance on a random port. `/api/health` runs `SELECT 1` with a short timeout and fails when it does; the backend retries its connection instead of crash-looping. Update CI so `npm test` needs no service container. Touches only the health path and test helpers, not the Record queries.

Done when: an integration test shows health passing with the database up and failing with it stopped, in CI on a non-root runner.

## 3. Baseline Drizzle schema and first migration

Blocked by: 2.

Write the Drizzle schema from the shipped multi-car schema: a `cars` table and `fuel`, `adblue`, and `expenses` tables, each with a required `car_id` foreign key. Use `date` for event dates, `timestamptz` defaulting to `now()` for creation times, `integer` for HUF, millilitres and kilometres, and integer identity ids. Retain the existing length and value `CHECK`s except SQLite `typeof()` checks; represent `full_tank` as a PostgreSQL boolean. Enforce case-insensitive Car-name uniqueness with a unique index on `lower(name)`, and use restrictive foreign keys so a Car with Records cannot be deleted. Recreate the three `(car_id, event_date DESC, id DESC)` indexes. Generate one baseline migration for an empty database only: no SQLite history is replayed, imported, or deleted.

Done when: the migration applies to an empty database and the constraint tests from `db.test.ts` pass against it.

## 4. Port `CarDatabase` to Drizzle and remove SQLite

Blocked by: 3.

Implement every `CarDatabase` method for all Record kinds with Drizzle, keeping API behaviour and the nested `/api/cars/:carId/...` routes unchanged. Remove `better-sqlite3`, `schema.sql`, the `bigint` conversions in `mappers.ts` that Postgres makes unnecessary, and the `python3 make g++` build step in the backend Dockerfile.

Done when: all backend tests pass on `embedded-postgres` and no SQLite reference remains in the repo.

## 5. Migrate step and deploy changes

Blocked by: 4.

Add a migrate entry point to the backend image (for example `node dist/migrate.js`) and a one-shot `migrate` service in `deploy/compose.example.yml`; the backend depends on `service_completed_successfully`. Join the external `database` network, drop the `/data` volume, update the example env file and the README (drop the SQLite note). On the server, `car-tracker/.env` holds the `DB_*` values. Rollback is restoring the previous image tags and the `/data` mount; the SQLite file stays untouched until deleted by hand after the cutover is verified.

Done when: a fresh compose deployment migrates an empty database, then serves traffic, and a deliberately failing migration blocks the backend from starting.
