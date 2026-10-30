# Migrating Car Tracker from SQLite to Shared Postgres

One-off procedure. The decisions behind it are in [ADR 0001](adr/0001-shared-postgres-service.md) and [ADR 0002](adr/0002-drizzle-and-migration-flow.md); the code work is split into issues in [postgres-port-issues.md](postgres-port-issues.md). This guide covers only the cutover on the home server.

The shared server itself (compose file, provisioning script, network, upgrades) is documented in the [Shared Postgres README](https://github.com/bercee/docker-services/blob/main/postgres/README.md) in `bercee/docker-services`. Car Tracker's deployment lives in that repo's `car-tracker/` directory.

Nothing is imported: Car Tracker starts with an empty PostgreSQL database and the old SQLite file is left untouched.

## Prerequisites

- Backend and frontend images built from the Postgres port (issues 3 to 7) and pushed; note their `sha-` tags.
- Shared Postgres running and healthy (see its README).

## Cutover

1. In `bercee/docker-services`, run `bash scripts/provision-db.sh car_tracker` and copy the printed `DB_*` values into `car-tracker/.env` (gitignored).
2. Edit `car-tracker/compose.yaml`:
   - set both image tags to the new builds;
   - remove `DATABASE_PATH` and the `./data:/data` mount;
   - give the backend `env_file: .env`;
   - add a one-shot `migrate` service (backend image, `node dist/migrate.js`, `restart: "no"`), and make `backend` depend on it with `condition: service_completed_successfully`;
   - join `backend` and `migrate` to the external `database` network.
3. `docker compose up -d` in `car-tracker/`. `migrate` must exit 0 before the backend starts.
4. Check `/api/health` through the gateway. It reflects database reachability.
5. Update `car-tracker/README.md` to drop the SQLite note.

## Rollback

Restore the previous image tags and the `./data:/data` mount, then `docker compose up -d`. The SQLite file is unchanged, so rollback loses nothing created before the cutover. Anything entered in Postgres after it is not carried back.

## Cleanup

Once satisfied, delete `car-tracker/data/car.sqlite` by hand.
