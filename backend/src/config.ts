import path from 'node:path';

export interface DatabaseConfig {
  databasePath: string;
}

export function loadDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
  workingDirectory: string = process.cwd(),
): DatabaseConfig {
  const configuredPath = environment.DATABASE_PATH;

  if (configuredPath !== undefined) {
    if (configuredPath.trim() === '' || configuredPath.includes('\0')) {
      throw new Error('DATABASE_PATH must be a non-empty valid path');
    }

    return { databasePath: path.resolve(workingDirectory, configuredPath) };
  }

  if (environment.NODE_ENV === 'production') {
    return { databasePath: '/data/car.sqlite' };
  }

  return { databasePath: path.resolve(workingDirectory, 'data/car.sqlite') };
}
