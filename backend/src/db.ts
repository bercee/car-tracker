import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import type { CarDatabase } from './database/carDatabase.js';
import { SqliteCarDatabase } from './database/sqliteCarDatabase.js';

export type { CarDatabase } from './database/carDatabase.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

export function openDatabase(databasePath: string): CarDatabase {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const connection = new Database(databasePath);

  try {
    connection.defaultSafeIntegers(true);
    assertNotLegacySchema(connection, databasePath);
    connection.exec(readFileSync(schemaPath, 'utf8'));
    return new SqliteCarDatabase(connection);
  } catch (error) {
    connection.close();
    throw error;
  }
}

function assertNotLegacySchema(connection: Database.Database, databasePath: string): void {
  const tables = new Set(
    (connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      ({ name }) => name,
    ),
  );
  const recordTables = ['fuel', 'adblue', 'expenses'].filter((name) => tables.has(name));
  const missingCars = recordTables.length > 0 && !tables.has('cars');
  const missingCarId = recordTables.some(
    (table) =>
      !(connection.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
        ({ name }) => name === 'car_id',
      ),
  );

  if (missingCars || missingCarId) {
    throw new Error(
      `Database at ${databasePath} uses the old single-car schema. Delete the file (and its -wal/-shm files) and restart; there is no migration.`,
    );
  }
}
