import path from 'node:path';

export interface AppConfig {
  host: string;
  port: number;
  databasePath: string;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
  workingDirectory: string = process.cwd(),
): AppConfig {
  const host = environment.HOST ?? '0.0.0.0';
  if (host.trim() === '' || host.includes('\0')) {
    throw new Error('HOST must be a non-empty valid host');
  }

  const portText = environment.PORT ?? '3000';
  if (!/^\d+$/.test(portText)) {
    throw new Error('PORT must be an integer from 1 through 65535');
  }

  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer from 1 through 65535');
  }

  const configuredPath = environment.DATABASE_PATH;
  let databasePath: string;

  if (configuredPath !== undefined) {
    if (configuredPath.trim() === '' || configuredPath.includes('\0')) {
      throw new Error('DATABASE_PATH must be a non-empty valid path');
    }

    databasePath = path.resolve(workingDirectory, configuredPath);
  } else if (environment.NODE_ENV === 'production') {
    databasePath = '/data/car.sqlite';
  } else {
    databasePath = path.resolve(workingDirectory, 'data/car.sqlite');
  }

  return { host, port, databasePath };
}
