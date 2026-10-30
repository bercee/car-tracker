import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { DatabaseConfig } from './config.js';
import { createPostgresConnection } from './postgres.js';

export async function runMigrations(config: DatabaseConfig, migrationsFolder: string): Promise<void> {
  const connection = createPostgresConnection(config);
  try {
    await migrate(connection.db, { migrationsFolder });
  } finally {
    await connection.close();
  }
}
