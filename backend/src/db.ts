import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import type { CarDatabase } from './database/carDatabase.js';
import { SqliteCarDatabase } from './database/sqliteCarDatabase.js';

export type { CarDatabase, DatabaseDiagnostics } from './database/carDatabase.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

export function openDatabase(databasePath: string): CarDatabase {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const connection = new Database(databasePath);

  try {
    connection.defaultSafeIntegers(true);
    connection.exec(readFileSync(schemaPath, 'utf8'));
    return new SqliteCarDatabase(connection);
  } catch (error) {
    connection.close();
    throw error;
  }
}
