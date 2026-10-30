import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createPostgresConnection } from '../../src/postgres.js';
import type { PostgresConnection } from '../../src/postgres.js';
import type { TestDatabase } from '../helpers/testDb.js';
import { createTestDatabase } from '../helpers/testDb.js';
import type { TestPostgres } from '../helpers/testPostgres.js';
import { startTestPostgres } from '../helpers/testPostgres.js';

describe('GET /api/health against PostgreSQL', () => {
  let postgres: TestPostgres;
  let connection: PostgresConnection;
  let sqlite: TestDatabase;

  beforeAll(async () => {
    postgres = await startTestPostgres();
    connection = createPostgresConnection(postgres.config, { healthTimeoutMs: 1_000 });
    sqlite = createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await connection.close();
    await postgres.stop();
    sqlite.closeAndRemove();
  });

  it('passes while the database is up and fails once it is stopped', async () => {
    const app = createApp(sqlite.database, { error: () => undefined }, connection.checkHealth);

    const up = await request(app).get('/api/health');
    expect(up.status).toBe(200);
    expect(up.headers['content-type']).toMatch(/^application\/json/);
    expect(up.headers['x-powered-by']).toBeUndefined();
    expect(up.body).toEqual({ status: 'ok' });

    await postgres.stop();

    const down = await request(app).get('/api/health');
    expect(down.status).toBe(503);
    expect(down.body).toEqual({ status: 'unavailable' });
  }, 60_000);
});
