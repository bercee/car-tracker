import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';

import type { DatabaseConfig } from './config.js';

export interface PostgresOptions {
  healthTimeoutMs?: number;
}

export interface PostgresConnection {
  db: ReturnType<typeof drizzle>;
  checkHealth(): Promise<void>;
  close(): Promise<void>;
}

export function createPostgresConnection(
  config: DatabaseConfig,
  options: PostgresOptions = {},
  logger: Pick<Console, 'error'> = console,
): PostgresConnection {
  const healthTimeoutMs = options.healthTimeoutMs ?? 2_000;
  // Credentials go in as separate fields, never a URL. The pool connects lazily and opens a fresh
  // connection after a failure, so a database that is down at startup does not crash the backend.
  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.name,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis: healthTimeoutMs,
    query_timeout: healthTimeoutMs,
  });
  // An idle client dropped by a restarting server emits 'error'; unhandled, it would kill the process.
  pool.on('error', (error) => {
    logger.error('PostgreSQL pool error', error);
  });
  const db = drizzle(pool);

  return {
    db,
    async checkHealth() {
      await db.execute(sql`SELECT 1`);
    },
    async close() {
      await pool.end();
    },
  };
}
