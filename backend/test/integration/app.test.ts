import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import type { TestDatabase } from '../helpers/testDb.js';
import { createTestDatabase } from '../helpers/testDb.js';

describe('Express API', () => {
  let testDatabase: TestDatabase;
  const logger = { error: vi.fn() };

  beforeEach(() => {
    testDatabase = createTestDatabase();
    logger.error.mockClear();
  });

  afterEach(() => {
    testDatabase.closeAndRemove();
  });

  it('serves health from the database without exposing Express', async () => {
    const response = await request(createApp(testDatabase.database, logger)).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns unavailable health when SQLite cannot be queried', async () => {
    testDatabase.database.close();

    const response = await request(createApp(testDatabase.database, logger)).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
  });

  it('creates, canonicalizes, and lists a fuel record', async () => {
    const app = createApp(testDatabase.database, logger);
    const empty = await request(app).get('/api/fuel');
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const created = await request(app).post('/api/fuel').send({
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      liters: '47.3',
      pricePerLiter: '619',
      fullTank: true,
      remark: ' Shell ',
    });

    expect(created.status).toBe(201);
    expect(created.headers['content-type']).toMatch(/^application\/json/);
    expect(created.body).toMatchObject({
      id: 1,
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      liters: '47.300',
      pricePerLiter: '619',
      fullTank: true,
      remark: 'Shell',
    });
    expect(created.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const listed = await request(app).get('/api/fuel');
    expect(listed.body).toEqual([created.body]);
  });

  it('creates, canonicalizes, and lists an AdBlue record', async () => {
    const app = createApp(testDatabase.database, logger);
    expect((await request(app).get('/api/adblue')).body).toEqual([]);

    const created = await request(app).post('/api/adblue').send({
      eventDate: '2026-09-16',
      odometerKm: 82_500,
      liters: '10',
      price: '7490',
    });

    expect(created.status).toBe(201);
    expect(created.headers['content-type']).toMatch(/^application\/json/);
    expect(created.body).toMatchObject({
      id: 1,
      eventDate: '2026-09-16',
      odometerKm: 82_500,
      liters: '10.000',
      price: '7490',
    });
    expect((await request(app).get('/api/adblue')).body).toEqual([created.body]);
  });

  it('creates, canonicalizes, and lists an expense record', async () => {
    const app = createApp(testDatabase.database, logger);
    expect((await request(app).get('/api/expenses')).body).toEqual([]);

    const created = await request(app).post('/api/expenses').send({
      eventDate: '2026-09-17',
      amount: '32000',
      notes: ' Annual inspection ',
    });

    expect(created.status).toBe(201);
    expect(created.headers['content-type']).toMatch(/^application\/json/);
    expect(created.body).toMatchObject({
      id: 1,
      eventDate: '2026-09-17',
      amount: '32000',
      notes: 'Annual inspection',
    });
    expect((await request(app).get('/api/expenses')).body).toEqual([created.body]);
  });

  it('sorts every resource by event date and then id descending', async () => {
    const app = createApp(testDatabase.database, logger);
    const dates = ['2026-01-01', '2026-02-01', '2026-02-01'];

    for (const [index, eventDate] of dates.entries()) {
      await request(app)
        .post('/api/fuel')
        .send({
          eventDate,
          odometerKm: index,
          liters: '1',
          pricePerLiter: '600',
          fullTank: false,
        })
        .expect(201);
      await request(app)
        .post('/api/adblue')
        .send({ eventDate, odometerKm: index, liters: '1', price: '1000' })
        .expect(201);
      await request(app).post('/api/expenses').send({ eventDate, amount: '1000' }).expect(201);
    }

    expect((await request(app).get('/api/fuel')).body.map((record: { id: number }) => record.id)).toEqual([3, 2, 1]);
    expect((await request(app).get('/api/adblue')).body.map((record: { id: number }) => record.id)).toEqual([3, 2, 1]);
    expect((await request(app).get('/api/expenses')).body.map((record: { id: number }) => record.id)).toEqual([
      3, 2, 1,
    ]);
  });

  it.each([
    ['/api/fuel', { eventDate: 'bad' }],
    ['/api/adblue', []],
    ['/api/expenses', { eventDate: '2026-09-17', amount: '1.5' }],
  ])('rejects invalid input without writing a row for %s', async (path, body) => {
    const app = createApp(testDatabase.database, logger);
    const rejected = await request(app).post(path).send(body);

    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((await request(app).get(path)).body).toEqual([]);
  });

  it('requires JSON for POST requests', async () => {
    const app = createApp(testDatabase.database, logger);
    const response = await request(app).post('/api/fuel').type('form').send('eventDate=2026-09-17');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' },
    });

    const missingHeader = await request(app).post('/api/fuel');
    expect(missingHeader.status).toBe(415);
  });

  it('returns 404 for an unknown POST before applying resource body rules', async () => {
    const response = await request(createApp(testDatabase.database, logger)).post('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns a standard 413 response for bodies above 16 KB', async () => {
    const response = await request(createApp(testDatabase.database, logger))
      .post('/api/expenses')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ eventDate: '2026-09-17', amount: '1', notes: 'x'.repeat(17 * 1024) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'request body must not exceed 16 KB',
        field: 'body',
      },
    });
  });

  it('returns a standard 400 response for malformed JSON', async () => {
    const response = await request(createApp(testDatabase.database, logger))
      .post('/api/expenses')
      .set('Content-Type', 'application/json')
      .send('{');

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'body must contain valid JSON',
      field: 'body',
    });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await request(createApp(testDatabase.database, logger)).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'API endpoint not found' },
    });
  });

  it('sanitizes and logs internal failures', async () => {
    vi.spyOn(testDatabase.database, 'listFuel').mockImplementation(() => {
      throw new Error('SQL statement and private path');
    });

    const response = await request(createApp(testDatabase.database, logger)).get('/api/fuel');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
    expect(response.text).not.toContain('SQL statement');
    expect(response.text).not.toContain('stack');
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
