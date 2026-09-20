import { mkdirSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { z } from 'zod';

import { addAdBlue, listAdBlue } from './adblue/index.js';
import { addExpense, listExpenses } from './expenses/index.js';
import { addFuel, listFuel } from './fuel/index.js';
import * as schema from './drizzle-schema.js';

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface CarDatabase {
  checkHealth(): void;
  addFuel(value: unknown): ReturnType<typeof addFuel>;
  listFuel(): ReturnType<typeof listFuel>;
  addAdBlue(value: unknown): ReturnType<typeof addAdBlue>;
  listAdBlue(): ReturnType<typeof listAdBlue>;
  addExpense(value: unknown): ReturnType<typeof addExpense>;
  listExpenses(): ReturnType<typeof listExpenses>;
  close(): void;
}

export function openDatabase(databasePath: string): CarDatabase {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const connection = new Database(databasePath);
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  connection.pragma('busy_timeout = 5000');

  const database = drizzle(connection, { schema });
  migrate(database, { migrationsFolder: path.resolve(import.meta.dirname, '../drizzle') });

  return {
    checkHealth: () => { z.literal(1).parse(connection.prepare('SELECT 1').pluck().get()); },
    addFuel: (value) => addFuel(database, value),
    listFuel: () => listFuel(database),
    addAdBlue: (value) => addAdBlue(database, value),
    listAdBlue: () => listAdBlue(database),
    addExpense: (value) => addExpense(database, value),
    listExpenses: () => listExpenses(database),
    close: () => { if (connection.open) connection.close(); },
  };
}
