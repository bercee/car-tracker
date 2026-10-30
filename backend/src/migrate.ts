import path from 'node:path';

import { loadConfig } from './config.js';
import { runMigrations } from './migrations.js';

// Entry point for the one-shot compose `migrate` service; a non-zero exit blocks the backend from starting.
// The migrations folder sits next to dist/ in the image (and next to src/ in a checkout).
try {
  const config = loadConfig();
  await runMigrations(config.database, path.join(import.meta.dirname, '../drizzle'));
  console.log('Car Tracker migrations applied');
} catch (error: unknown) {
  console.error('Car Tracker migration failed', error);
  process.exitCode = 1;
}
