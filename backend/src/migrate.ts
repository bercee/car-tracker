import { loadConfig } from './config.js';
import { runMigrations } from './database/migrations.js';

// Entry point for the one-shot compose `migrate` service; a non-zero exit blocks the backend from starting.
try {
  await runMigrations(loadConfig().database);
  console.log('Car Tracker migrations applied');
} catch (error: unknown) {
  console.error('Car Tracker migration failed', error);
  process.exitCode = 1;
}
