import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadDatabaseConfig } from '../../src/config.js';

describe('database configuration', () => {
  it('uses a local development database by default', () => {
    expect(loadDatabaseConfig({}, '/work/backend')).toEqual({
      databasePath: path.resolve('/work/backend/data/car.sqlite'),
    });
  });

  it('uses the production volume path in production', () => {
    expect(loadDatabaseConfig({ NODE_ENV: 'production' }, '/work/backend')).toEqual({
      databasePath: '/data/car.sqlite',
    });
  });

  it('resolves an explicit relative path and preserves an absolute path', () => {
    expect(loadDatabaseConfig({ DATABASE_PATH: './custom.sqlite' }, '/work/backend').databasePath).toBe(
      '/work/backend/custom.sqlite',
    );
    expect(loadDatabaseConfig({ DATABASE_PATH: '/var/lib/car.sqlite' }, '/work/backend').databasePath).toBe(
      '/var/lib/car.sqlite',
    );
  });

  it.each(['', '  ', 'bad\0path'])('rejects invalid path %s', (databasePath) => {
    expect(() => loadDatabaseConfig({ DATABASE_PATH: databasePath })).toThrow(
      'DATABASE_PATH must be a non-empty valid path',
    );
  });
});
