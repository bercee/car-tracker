import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import type { TestDatabase } from '../helpers/testDb.js';
import { createCar, startTestDatabase } from '../helpers/testDb.js';

const healthy = () => Promise.resolve();

describe('Express API', () => {
  let testDatabase: TestDatabase;
  let carId: number;
  const logger = { error: vi.fn() };

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await testDatabase.stop();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await testDatabase.reset();
    carId = (await createCar(testDatabase.database)).id;
    logger.error.mockClear();
  });

  it('creates, canonicalizes, and lists a fuel record', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    const empty = await request(app).get(`/api/cars/${carId}/fuel`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const created = await request(app).post(`/api/cars/${carId}/fuel`).send({
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      liters: '47.3',
      price: '29284',
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
      price: '29284',
      fullTank: true,
      remark: 'Shell',
    });
    expect(created.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const listed = await request(app).get(`/api/cars/${carId}/fuel`);
    expect(listed.body).toEqual([created.body]);
  });

  it('creates, canonicalizes, and lists an AdBlue record', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    expect((await request(app).get(`/api/cars/${carId}/adblue`)).body).toEqual([]);

    const created = await request(app).post(`/api/cars/${carId}/adblue`).send({
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
    expect((await request(app).get(`/api/cars/${carId}/adblue`)).body).toEqual([created.body]);
  });

  it('creates, canonicalizes, and lists an expense record', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    expect((await request(app).get(`/api/cars/${carId}/expenses`)).body).toEqual([]);

    const created = await request(app).post(`/api/cars/${carId}/expenses`).send({
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
    expect((await request(app).get(`/api/cars/${carId}/expenses`)).body).toEqual([created.body]);
  });

  it('sorts every resource by event date and then id descending', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    const dates = ['2026-01-01', '2026-02-01', '2026-02-01'];

    for (const [index, eventDate] of dates.entries()) {
      await request(app)
        .post(`/api/cars/${carId}/fuel`)
        .send({
          eventDate,
          odometerKm: index,
          liters: '1',
          price: '600',
          fullTank: false,
        })
        .expect(201);
      await request(app)
        .post(`/api/cars/${carId}/adblue`)
        .send({ eventDate, odometerKm: index, liters: '1', price: '1000' })
        .expect(201);
      await request(app).post(`/api/cars/${carId}/expenses`).send({ eventDate, amount: '1000' }).expect(201);
    }

    expect((await request(app).get(`/api/cars/${carId}/fuel`)).body.map((record: { id: number }) => record.id)).toEqual(
      [3, 2, 1],
    );
    expect(
      (await request(app).get(`/api/cars/${carId}/adblue`)).body.map((record: { id: number }) => record.id),
    ).toEqual([3, 2, 1]);
    expect(
      (await request(app).get(`/api/cars/${carId}/expenses`)).body.map((record: { id: number }) => record.id),
    ).toEqual([3, 2, 1]);
  });

  it('updates and deletes every resource and returns field-level member errors', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    const specs = [
      [
        `/api/cars/${carId}/fuel`,
        { eventDate: '2026-09-15', odometerKm: 10, liters: '1', price: '100', fullTank: true, remark: 'old' },
        { eventDate: '2026-09-16', odometerKm: 11, liters: '2', price: '200', fullTank: false, remark: ' new ' },
      ],
      [
        `/api/cars/${carId}/adblue`,
        { eventDate: '2026-09-15', odometerKm: 10, liters: '1', price: '100' },
        { eventDate: '2026-09-16', odometerKm: 11, liters: '2', price: '200' },
      ],
      [
        `/api/cars/${carId}/expenses`,
        { eventDate: '2026-09-15', amount: '100', notes: 'old' },
        { eventDate: '2026-09-16', amount: '200', notes: ' new ' },
      ],
    ] as const;
    for (const [path, original, changed] of specs) {
      const created = await request(app).post(path).send(original).expect(201);
      const updated = await request(app).put(`${path}/${created.body.id}`).send(changed).expect(200);
      expect(updated.body).toMatchObject({
        id: created.body.id,
        createdAt: created.body.createdAt,
        eventDate: '2026-09-16',
      });
      expect((await request(app).get(path)).body).toHaveLength(1);
      await request(app).delete(`${path}/${created.body.id}`).expect(204, '');
      expect((await request(app).get(path)).body).toEqual([]);
      const missing = await request(app).delete(`${path}/999`).expect(404);
      expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', field: 'id' });
    }
    for (const id of ['abc', '0', '-1', '1.2', '9007199254740992']) {
      const response = await request(app).delete(`/api/cars/${carId}/fuel/${id}`).expect(400);
      expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'id' });
      await request(app).put(`/api/cars/${carId}/fuel/${id}`).send({}).expect(400);
    }
  });

  it.each([
    [
      'fuel',
      { eventDate: 'bad' },
      { eventDate: '2026-09-15', odometerKm: 1, liters: '1', price: '1', fullTank: false },
    ],
    ['adblue', [], { eventDate: '2026-09-15', odometerKm: 1, liters: '1', price: '1' }],
    ['expenses', { eventDate: '2026-09-15', amount: '1.5' }, { eventDate: '2026-09-15', amount: '1' }],
  ])('rejects invalid PUT bodies without changing %s', async (resource, invalid, valid) => {
    const path = `/api/cars/${carId}/${resource}`;
    const app = createApp(testDatabase.database, healthy, logger);
    const created = await request(app).post(path).send(valid).expect(201);
    const rejected = await request(app).put(`${path}/${created.body.id}`).send(invalid).expect(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
    expect((await request(app).get(path)).body).toEqual([created.body]);
  });

  it.each([
    ['fuel', { eventDate: 'bad' }],
    ['adblue', []],
    ['expenses', { eventDate: '2026-09-17', amount: '1.5' }],
  ])('rejects invalid input without writing a row for %s', async (resource, body) => {
    const path = `/api/cars/${carId}/${resource}`;
    const app = createApp(testDatabase.database, healthy, logger);
    const rejected = await request(app).post(path).send(body);

    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((await request(app).get(path)).body).toEqual([]);
  });

  it('requires JSON for POST requests', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    const response = await request(app).post(`/api/cars/${carId}/fuel`).type('form').send('eventDate=2026-09-17');

    expect(response.status).toBe(415);
    expect(response.body).toEqual({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' },
    });

    const missingHeader = await request(app).post(`/api/cars/${carId}/fuel`);
    expect(missingHeader.status).toBe(415);
  });

  it('requires JSON for PUT and accepts bodyless DELETE without a content type', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    const created = await request(app)
      .post(`/api/cars/${carId}/expenses`)
      .send({ eventDate: '2026-09-17', amount: '10' })
      .expect(201);
    await request(app).put(`/api/cars/${carId}/expenses/${created.body.id}`).expect(415);
    const updated = await request(app)
      .put(`/api/cars/${carId}/expenses/${created.body.id}`)
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(updated.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'body' });
    await request(app).delete(`/api/cars/${carId}/expenses/${created.body.id}`).expect(204);
  });

  it('scopes records to the car in the URL', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    const otherCarId = (await createCar(testDatabase.database, 'Other car')).id;
    const bodies = {
      fuel: { eventDate: '2026-09-15', odometerKm: 10, liters: '1', price: '100', fullTank: true },
      adblue: { eventDate: '2026-09-15', odometerKm: 10, liters: '1', price: '100' },
      expenses: { eventDate: '2026-09-15', amount: '100' },
    };

    for (const [resource, body] of Object.entries(bodies)) {
      const created = await request(app).post(`/api/cars/${carId}/${resource}`).send(body).expect(201);
      const otherPath = `/api/cars/${otherCarId}/${resource}`;

      expect((await request(app).get(otherPath).expect(200)).body).toEqual([]);
      const putResponse = await request(app).put(`${otherPath}/${created.body.id}`).send(body).expect(404);
      expect(putResponse.body.error).toMatchObject({ code: 'NOT_FOUND', field: 'id' });
      const deleteResponse = await request(app).delete(`${otherPath}/${created.body.id}`).expect(404);
      expect(deleteResponse.body.error).toMatchObject({ code: 'NOT_FOUND', field: 'id' });
      expect((await request(app).get(`/api/cars/${carId}/${resource}`)).body).toEqual([created.body]);
    }
  });

  it('validates the car id before the record id and the body', async () => {
    const app = createApp(testDatabase.database, healthy, logger);

    const unknown = await request(app).get('/api/cars/999/fuel').expect(404);
    expect(unknown.body.error).toEqual({ code: 'NOT_FOUND', message: 'Car not found', field: 'carId' });
    const unknownPut = await request(app).put('/api/cars/999/fuel/abc').send({}).expect(404);
    expect(unknownPut.body.error).toMatchObject({ code: 'NOT_FOUND', field: 'carId' });

    for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) {
      const response = await request(app).get(`/api/cars/${id}/fuel`).expect(400);
      expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'carId' });
      const renamed = await request(app).put(`/api/cars/${id}`).send({ name: 'X' }).expect(400);
      expect(renamed.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'carId' });
    }

    const badRecordId = await request(app).put(`/api/cars/${carId}/fuel/abc`).send({}).expect(400);
    expect(badRecordId.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'id' });
  });

  it('no longer serves the un-nested record routes', async () => {
    const app = createApp(testDatabase.database, healthy, logger);

    for (const resource of ['fuel', 'adblue', 'expenses']) {
      const response = await request(app).get(`/api/${resource}`).expect(404);
      expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } });
    }
  });

  it('returns 404 for an unknown POST before applying resource body rules', async () => {
    const response = await request(createApp(testDatabase.database, healthy, logger)).post('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns a standard 413 response for bodies above 16 KB', async () => {
    const app = createApp(testDatabase.database, healthy, logger);
    const response = await request(app)
      .post(`/api/cars/${carId}/expenses`)
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
    const created = await request(app)
      .post(`/api/cars/${carId}/expenses`)
      .send({ eventDate: '2026-09-17', amount: '1' })
      .expect(201);
    await request(app)
      .put(`/api/cars/${carId}/expenses/${created.body.id}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ eventDate: '2026-09-17', amount: '1', notes: 'x'.repeat(17 * 1024) }))
      .expect(413);
  });

  it('returns a standard 400 response for malformed JSON', async () => {
    const response = await request(createApp(testDatabase.database, healthy, logger))
      .post(`/api/cars/${carId}/expenses`)
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
    const response = await request(createApp(testDatabase.database, healthy, logger)).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'API endpoint not found' },
    });
  });

  it('sanitizes and logs internal failures', async () => {
    vi.spyOn(testDatabase.database, 'listFuel').mockRejectedValue(new Error('SQL statement and private path'));

    const response = await request(createApp(testDatabase.database, healthy, logger)).get(`/api/cars/${carId}/fuel`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
    expect(response.text).not.toContain('SQL statement');
    expect(response.text).not.toContain('stack');
    expect(logger.error).toHaveBeenCalledOnce();
  });

  describe('cars', () => {
    const postCar = (app: ReturnType<typeof createApp>, name: unknown) => request(app).post('/api/cars').send({ name });

    it('returns an empty list on a fresh database', async () => {
      await testDatabase.reset();
      const response = await request(createApp(testDatabase.database, healthy, logger)).get('/api/cars');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('creates a car with a trimmed name and lists cars sorted by name', async () => {
      const app = createApp(testDatabase.database, healthy, logger);

      const created = await postCar(app, '  alpha  ');
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: 'alpha' });
      expect(created.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      await postCar(app, 'Zeta');

      const listed = await request(app).get('/api/cars');
      expect(listed.status).toBe(200);
      expect(listed.body.map((car: { name: string }) => car.name)).toEqual(['alpha', 'Test car', 'Zeta']);
    });

    it('rejects duplicate names, case-insensitively, with 409 CONFLICT', async () => {
      const app = createApp(testDatabase.database, healthy, logger);

      for (const name of ['Test car', 'TEST CAR']) {
        const response = await postCar(app, name);
        expect(response.status).toBe(409);
        expect(response.body).toEqual({
          error: { code: 'CONFLICT', message: 'A car with this name already exists', field: 'name' },
        });
      }
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('renames a car without affecting its records', async () => {
      const app = createApp(testDatabase.database, healthy, logger);
      await request(app)
        .post(`/api/cars/${carId}/expenses`)
        .send({ eventDate: '2026-09-17', amount: '15000' })
        .expect(201);
      const before = await request(app).get(`/api/cars/${carId}/expenses`);
      expect(before.body).toHaveLength(1);

      const renamed = await request(app).put(`/api/cars/${carId}`).send({ name: ' Renamed ' });
      expect(renamed.status).toBe(200);
      expect(renamed.body).toMatchObject({ id: carId, name: 'Renamed' });

      const after = await request(app).get(`/api/cars/${carId}/expenses`);
      expect(after.body).toEqual(before.body);
    });

    it('allows renaming a car to its own name in a different case', async () => {
      const response = await request(createApp(testDatabase.database, healthy, logger))
        .put(`/api/cars/${carId}`)
        .send({ name: 'TEST CAR' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('TEST CAR');
    });

    it("rejects renaming to another car's name with 409", async () => {
      const app = createApp(testDatabase.database, healthy, logger);
      const other = await postCar(app, 'Other');

      const response = await request(app).put(`/api/cars/${other.body.id}`).send({ name: 'test car' });

      expect(response.status).toBe(409);
      expect(response.body.error).toEqual({
        code: 'CONFLICT',
        message: 'A car with this name already exists',
        field: 'name',
      });
    });

    it('returns 404 when renaming an unknown car', async () => {
      const response = await request(createApp(testDatabase.database, healthy, logger))
        .put('/api/cars/999')
        .send({ name: 'Ghost' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Car not found', field: 'carId' },
      });
    });

    it('returns 400 for an invalid carId on rename', async () => {
      const response = await request(createApp(testDatabase.database, healthy, logger))
        .put('/api/cars/abc')
        .send({ name: 'X' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'carId' });
    });

    it('rejects empty and over-long names with 400', async () => {
      const app = createApp(testDatabase.database, healthy, logger);

      for (const name of ['   ', 'x'.repeat(61)]) {
        const created = await postCar(app, name);
        expect(created.status).toBe(400);
        expect(created.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'name' });
        const renamed = await request(app).put(`/api/cars/${carId}`).send({ name });
        expect(renamed.status).toBe(400);
        expect(renamed.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'name' });
      }
    });

    it('requires JSON for POST and PUT', async () => {
      const app = createApp(testDatabase.database, healthy, logger);

      const created = await request(app).post('/api/cars').set('Content-Type', 'text/plain').send('name');
      const renamed = await request(app).put(`/api/cars/${carId}`).set('Content-Type', 'text/plain').send('name');

      expect(created.status).toBe(415);
      expect(renamed.status).toBe(415);
      expect(created.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(renamed.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('has no DELETE route and does not shadow nested record routes', async () => {
      const app = createApp(testDatabase.database, healthy, logger);

      const deleted = await request(app).delete(`/api/cars/${carId}`);
      expect(deleted.status).toBe(404);
      expect(deleted.body.error.code).toBe('NOT_FOUND');

      const fuel = await request(app).get(`/api/cars/${carId}/fuel`);
      expect(fuel.status).toBe(200);
      expect(fuel.body).toEqual([]);
    });
  });

  describe('Car name validation', () => {
    const invalidBodies: [string, string | object | undefined, string][] = [
      ['blank', { name: '' }, 'name'],
      ['whitespace-only', { name: '   ' }, 'name'],
      ['over 60 characters after trimming', { name: 'x'.repeat(61) }, 'name'],
      ['non-string', { name: 5 }, 'name'],
      ['missing name', {}, 'name'],
      ['unknown key', { name: 'A', extra: 1 }, 'body'],
      ['array body', [], 'body'],
      ['null body', 'null', 'body'],
    ];

    it.each(invalidBodies)('rejects a %s name on create', async (_label, body, field) => {
      const app = createApp(testDatabase.database, healthy, logger);
      const response = await request(app).post('/api/cars').type('json').send(body).expect(400);
      expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field });
      expect(typeof response.body.error.message).toBe('string');
    });

    it.each(invalidBodies)('rejects a %s name on rename', async (_label, body, field) => {
      const app = createApp(testDatabase.database, healthy, logger);
      const response = await request(app).put(`/api/cars/${carId}`).type('json').send(body).expect(400);
      expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field });
    });

    it('stores a trimmed name on create and rename and accepts 60 characters', async () => {
      const app = createApp(testDatabase.database, healthy, logger);
      const created = await request(app).post('/api/cars').send({ name: '  Skoda Octavia  ' }).expect(201);
      expect(created.body.name).toBe('Skoda Octavia');

      const renamed = await request(app).put(`/api/cars/${created.body.id}`).send({ name: '  Fabia  ' }).expect(200);
      expect(renamed.body.name).toBe('Fabia');

      const longest = 'y'.repeat(60);
      const padded = await request(app)
        .post('/api/cars')
        .send({ name: ` ${longest} ` })
        .expect(201);
      expect(padded.body.name).toBe(longest);
    });
  });
});
