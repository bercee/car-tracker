import { sql } from 'drizzle-orm';

import type { CarDatabase } from '../../src/database/carDatabase.js';
import { PostgresCarDatabase } from '../../src/database/postgresCarDatabase.js';
import type { Car } from '../../src/domain.js';
import { applyMigrations } from '../../src/database/migrations.js';
import { createPostgresConnection } from '../../src/database/postgres.js';
import type { PostgresConnection } from '../../src/database/postgres.js';
import { startTestPostgres } from './testPostgres.js';
import type { TestPostgres } from './testPostgres.js';

export interface TestDatabase {
  database: CarDatabase;
  connection: PostgresConnection;
  postgres: TestPostgres;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

// One migrated PostgreSQL per test file; call reset() between tests to empty every table and restart ids.
export async function startTestDatabase(): Promise<TestDatabase> {
  const postgres = await startTestPostgres();
  const connection = createPostgresConnection(postgres.config);
  try {
    await applyMigrations(connection.db);
  } catch (error: unknown) {
    await connection.close();
    await postgres.stop();
    throw error;
  }

  return {
    database: new PostgresCarDatabase(connection.db),
    connection,
    postgres,
    async reset() {
      await connection.db.execute(sql`TRUNCATE cars, fuel, adblue, expenses RESTART IDENTITY`);
    },
    async stop() {
      await connection.close();
      await postgres.stop();
    },
  };
}

export function createCar(database: CarDatabase, name = 'Test car'): Promise<Car> {
  return database.addCar({ name });
}
