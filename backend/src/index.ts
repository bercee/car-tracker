import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './database/index.js';
import { createShutdownCoordinator } from './shutdown.js';

try {
  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  const app = createApp(database);
  const server = app.listen(config.port, config.host);
  server.once('listening', () => {
    console.log(`Car Tracker backend listening on http://${config.host}:${config.port}`);
  });
  server.once('error', (error: Error) => {
    console.error('Failed to start Car Tracker backend', error);
    process.exit(1);
  });
  const shutdown = createShutdownCoordinator(server, database);

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
} catch (error: unknown) {
  console.error('Failed to start Car Tracker backend', error);
  process.exitCode = 1;
}
