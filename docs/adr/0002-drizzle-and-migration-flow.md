# Drizzle for schema and queries, migrations run as a separate step

The backend uses Drizzle on PostgreSQL (ADR 0001) instead of a full ORM such as Prisma, because migrations and queries stay close to plain SQL, so the learning transfers, and there is no engine binary. SQLite is removed entirely. The `CarDatabase` interface stays as the seam between routes and storage.

Migrations are not applied by the app at startup. The same backend image has a second entry point run as a one-shot compose service, and the backend starts only after it succeeds, so a failed migration blocks the deploy visibly and replicas cannot race. One role per app does both jobs for now.

Backend tests run against a real PostgreSQL 17 started by the `embedded-postgres` dev dependency, instead of a mock, PGlite or SQLite. Development happens on Ubuntu. Local development uses a PostgreSQL 17 container from Compose. Production and tests share major version 17; the test package's bundled patch release may temporarily differ from production's explicitly pinned patch release.
