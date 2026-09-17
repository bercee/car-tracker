import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { CarDatabase } from '../../src/db.js';
import { openDatabase } from '../../src/db.js';

export interface TestDatabase {
  database: CarDatabase;
  databasePath: string;
  closeAndRemove(): void;
}

export function createTestDatabase(): TestDatabase {
  const directory = mkdtempSync(path.join(tmpdir(), 'car-tracker-'));
  const databasePath = path.join(directory, 'nested', 'test.sqlite');
  const database = openDatabase(databasePath);
  let cleanedUp = false;

  return {
    database,
    databasePath,
    closeAndRemove() {
      if (!cleanedUp) {
        database.close();
        rmSync(directory, { recursive: true, force: true });
        cleanedUp = true;
      }
    },
  };
}
