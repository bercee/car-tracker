import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config.js';

describe('application configuration', () => {
  it('uses HTTP and database defaults', () => {
    expect(loadConfig({}, '/work/backend')).toEqual({
      host: '0.0.0.0',
      port: 3000,
      databasePath: path.resolve('/work/backend/data/car.sqlite'),
    });
  });

  it('accepts valid overrides', () => {
    expect(
      loadConfig({ HOST: '127.0.0.1', PORT: '4321', DATABASE_PATH: './temporary.sqlite' }, '/work/backend'),
    ).toEqual({
      host: '127.0.0.1',
      port: 4321,
      databasePath: '/work/backend/temporary.sqlite',
    });
  });

  it.each(['', ' ', 'localhost\0invalid'])('rejects invalid host %s', (host) => {
    expect(() => loadConfig({ HOST: host })).toThrow('HOST must be a non-empty valid host');
  });

  it.each(['', '0', '-1', '3.5', ' 3000', '65536', 'not-a-port'])('rejects invalid port %s', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow('PORT must be an integer from 1 through 65535');
  });
});

describe('database configuration', () => {
  it('uses a local development database by default', () => {
    expect(loadConfig({}, '/work/backend').databasePath).toBe(path.resolve('/work/backend/data/car.sqlite'));
  });

  it('uses the production volume path in production', () => {
    expect(loadConfig({ NODE_ENV: 'production' }, '/work/backend').databasePath).toBe('/data/car.sqlite');
  });

  it('resolves an explicit relative path and preserves an absolute path', () => {
    expect(loadConfig({ DATABASE_PATH: './custom.sqlite' }, '/work/backend').databasePath).toBe(
      '/work/backend/custom.sqlite',
    );
    expect(loadConfig({ DATABASE_PATH: '/var/lib/car.sqlite' }, '/work/backend').databasePath).toBe(
      '/var/lib/car.sqlite',
    );
  });

  it.each(['', '  ', 'bad\0path'])('rejects invalid path %s', (databasePath) => {
    expect(() => loadConfig({ DATABASE_PATH: databasePath })).toThrow('DATABASE_PATH must be a non-empty valid path');
  });
});
