# Postgres port: sequenced issues (draft)

Draft for `bercee/car-tracker`. Context: [ADR 0001](adr/0001-shared-postgres-service.md), [ADR 0002](adr/0002-drizzle-and-migration-flow.md), [GLOSSARY.md](../GLOSSARY.md). Issues 1-4 can start now; 5-7 wait for the separate multi-car work to merge, because they depend on its final schema and touch the same files (`schema.sql`, `sqliteCarDatabase.ts`, `CarDatabase`, `mappers.ts`).

Create with `gh issue create`; then record blockers per `docs/agents/issue-tracker.md` (native dependencies, or a `Blocked by:` line at the top of the body).

---

## 1. Provision the car tracker's database and role on the shared Postgres (HITL)

Blocked by: none. Lives outside this repo (platform project).

Create the `car_tracker` database and `car_tracker` role on the shared server, owned by that role, with no privileges on other apps' databases. Create the external `database` Docker network both projects join. Postgres publishes no port in production.

Done when: a client on the `database` network can connect as `car_tracker` to `car_tracker` and cannot connect to any other database.

## 2. Nightly backup and a tested restore of the shared Postgres (HITL)

Blocked by: 1. Lives outside this repo (platform project).

Nightly `pg_dump` per database, copied off the machine. Restore the car tracker's dump into a scratch database once, to prove it works. Document the restore steps in this repo's README.

Done when: a dump has been restored and its row counts checked.

## 3. Dev Postgres and `DB_*` configuration

Blocked by: none.

Add a compose Postgres for development, published on `127.0.0.1` only. Replace `DATABASE_PATH` in `config.ts` with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, validated like `HOST` and `PORT` today, and update `deploy/.env.example`. The backend passes them to the driver as separate parameters, never as a URL string.

Done when: config unit tests cover valid and invalid values, including passwords containing `@` and `/`, and the dev container starts with one command.

## 4. Tracer: Drizzle connection, `embedded-postgres` test harness, database-aware health check

Blocked by: 3.

Add Drizzle and `embedded-postgres` (pinned to production's Postgres major version). A shared test helper starts a throwaway instance on a random port. `/api/health` runs `SELECT 1` with a short timeout and fails when it does; the backend retries its connection instead of crash-looping. Update CI so `npm test` needs no service container. Touches only the health path and test helpers, not the Record queries.

Done when: an integration test shows health passing with the database up and failing with it stopped, in CI on a non-root runner.

## 5. Baseline Drizzle schema and first migration

Blocked by: 4, and the multi-car work merged.

Write the Drizzle schema from the final multi-car schema: `date` for event dates, `timestamptz` defaulting to `now()` for creation times, `integer` for HUF, millilitres and kilometres, integer identity ids, existing `CHECK`s except the SQLite `typeof()` ones. Generate one baseline migration. No SQLite history is replayed and no data is imported.

Done when: the migration applies to an empty database and the constraint tests from `db.test.ts` pass against it.

## 6. Port `CarDatabase` to Drizzle and remove SQLite

Blocked by: 5.

Implement every `CarDatabase` method for all Record kinds with Drizzle, keeping API behaviour and the nested `/api/cars/:carId/...` routes unchanged. Remove `better-sqlite3`, `schema.sql`, the `bigint` conversions in `mappers.ts` that Postgres makes unnecessary, and the `python3 make g++` build step in the backend Dockerfile.

Done when: all backend tests pass on `embedded-postgres` and no SQLite reference remains in the repo.

## 7. Migrate step and deploy changes

Blocked by: 5, and 1 for end-to-end verification.

Add a migrate entry point to the backend image (for example `node dist/migrate.js`) and a one-shot `migrate` service in `deploy/compose.example.yml`; the backend depends on `service_completed_successfully`. Join the external `database` network, drop the `/data` volume, update the example env file and the README.

Done when: a fresh compose deployment migrates an empty database, then serves traffic, and a deliberately failing migration blocks the backend from starting.
