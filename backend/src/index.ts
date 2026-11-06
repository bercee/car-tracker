import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PostgresCarDatabase } from './database/postgresCarDatabase.js';
import { createPostgresConnection } from './database/postgres.js';
import { createShutdownCoordinator } from './shutdown.js';

async function startup() {
  const config = loadConfig();
  const postgres = createPostgresConnection(config.database);

  // Check database health immediately on startup and signal loudly if not available
  try {
    await postgres.checkHealth();
    console.log('Database connection verified on startup.');
  } catch (error) {
    console.error('========================================');
    console.error('DATABASE UNAVAILABLE ON STARTUP!');
    console.error('========================================');
    console.error('The backend will continue running but database operations will fail.');
    console.error('Error:', error);
    console.error('========================================');
    // Set a flag so the health check endpoint can report this
    process.env.DATABASE_UNHEALTHY = 'true';
  }

  const app = createApp(new PostgresCarDatabase(postgres.db), postgres.checkHealth);
  const server = app.listen(config.port, config.host);
  server.once('listening', () => {
    console.log(`Car Tracker backend listening on http://${config.host}:${config.port}`);
  });
  server.once('error', (error: Error) => {
    console.error('Failed to start Car Tracker backend', error);
    process.exit(1);
  });
  const shutdown = createShutdownCoordinator(server, postgres);

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

startup().catch((error: unknown) => {
  console.error('Failed to start Car Tracker backend', error);
  process.exitCode = 1;
});
