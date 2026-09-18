import type { CarDatabase } from './database/carDatabase.js';

export interface ClosableServer {
  close(callback: (error?: Error) => void): void;
}

export interface ShutdownOptions {
  exit?: (code: number) => void;
  logger?: Pick<Console, 'error'>;
}

export type Shutdown = (signal: NodeJS.Signals) => Promise<void>;

export function createShutdownCoordinator(
  server: ClosableServer,
  database: Pick<CarDatabase, 'close'>,
  options: ShutdownOptions = {},
): Shutdown {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const logger = options.logger ?? console;
  let shutdown: Promise<void> | undefined;

  return (signal) => {
    shutdown ??= closeServer(server)
      .then(() => {
        database.close();
        exit(0);
      })
      .catch((error: unknown) => {
        logger.error(`Failed to shut down after ${signal}`, error);
        try {
          database.close();
        } catch (closeError: unknown) {
          logger.error('Failed to close database during shutdown', closeError);
        }
        exit(1);
      });

    return shutdown;
  };
}

function closeServer(server: ClosableServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}
