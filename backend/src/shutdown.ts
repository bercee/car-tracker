export interface ClosableServer {
  close(callback: (error?: Error) => void): void;
}

export interface Closable {
  close(): void | Promise<void>;
}

export interface ShutdownOptions {
  exit?: (code: number) => void;
  logger?: Pick<Console, 'error'>;
}

export type Shutdown = (signal: NodeJS.Signals) => Promise<void>;

export function createShutdownCoordinator(
  server: ClosableServer,
  database: Closable,
  options: ShutdownOptions = {},
): Shutdown {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const logger = options.logger ?? console;
  let shutdown: Promise<void> | undefined;

  return (signal) => {
    shutdown ??= closeServer(server)
      .then(async () => {
        await database.close();
        exit(0);
      })
      .catch(async (error: unknown) => {
        logger.error(`Failed to shut down after ${signal}`, error);
        try {
          await database.close();
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
