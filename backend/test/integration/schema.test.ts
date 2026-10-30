import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyMigrations } from '../../src/database/migrations.js';
import { createPostgresConnection } from '../../src/database/postgres.js';
import type { PostgresConnection } from '../../src/database/postgres.js';
import type { TestPostgres } from '../helpers/testPostgres.js';
import { startTestPostgres } from '../helpers/testPostgres.js';

describe('baseline migration on an empty PostgreSQL database', () => {
  let postgres: TestPostgres;
  let connection: PostgresConnection;
  let client: pg.Client;

  beforeAll(async () => {
    postgres = await startTestPostgres();
    connection = createPostgresConnection(postgres.config);
    await applyMigrations(connection.db);
    client = new pg.Client({
      host: postgres.config.host,
      port: postgres.config.port,
      database: postgres.config.name,
      user: postgres.config.user,
      password: postgres.config.password,
    });
    await client.connect();
  }, 60_000);

  afterAll(async () => {
    await client.end();
    await connection.close();
    await postgres.stop();
  });

  async function expectViolation(sql: string, params: unknown[], code: string): Promise<void> {
    await client.query('BEGIN');
    try {
      await expect(client.query(sql, params)).rejects.toMatchObject({ code });
    } finally {
      await client.query('ROLLBACK');
    }
  }

  async function insertCar(name: string): Promise<number> {
    const result = await client.query<{ id: number }>('INSERT INTO cars (name) VALUES ($1) RETURNING id', [name]);
    return result.rows[0]!.id;
  }

  it('creates the four tables', async () => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(['adblue', 'cars', 'expenses', 'fuel']);
  });

  it('uses the specified column types and defaults', async () => {
    const columns = await client.query<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN ('cars', 'fuel', 'adblue', 'expenses')`,
    );
    const typeOf = (table: string, column: string) =>
      columns.rows.find((row) => row.table_name === table && row.column_name === column)?.data_type;

    expect(typeOf('cars', 'id')).toBe('integer');
    expect(typeOf('cars', 'created_at')).toBe('timestamp with time zone');
    for (const table of ['fuel', 'adblue', 'expenses']) {
      expect(typeOf(table, 'id')).toBe('integer');
      expect(typeOf(table, 'car_id')).toBe('integer');
      expect(typeOf(table, 'event_date')).toBe('date');
      expect(typeOf(table, 'created_at')).toBe('timestamp with time zone');
    }
    for (const table of ['fuel', 'adblue']) {
      expect(typeOf(table, 'odometer_km')).toBe('integer');
    }
    expect(typeOf('fuel', 'liters_milliliters')).toBe('integer');
    expect(typeOf('fuel', 'price_huf')).toBe('integer');
    expect(typeOf('adblue', 'liters')).toBe('numeric');
    expect(typeOf('adblue', 'price')).toBe('integer');
    expect(typeOf('fuel', 'full_tank')).toBe('boolean');
    expect(typeOf('expenses', 'price')).toBe('integer');

    const identity = await client.query<{ table_name: string; is_identity: string }>(
      `SELECT table_name, is_identity FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'id'`,
    );
    expect(identity.rows.every((row) => row.is_identity === 'YES')).toBe(true);
    expect(identity.rows).toHaveLength(4);
  });

  it('assigns identity ids and a creation timestamp', async () => {
    const first = await insertCar('Timestamped');
    const second = await insertCar('Timestamped two');
    expect(second).toBeGreaterThan(first);

    const row = await client.query<{ created_at: Date }>('SELECT created_at FROM cars WHERE id = $1', [first]);
    expect(Math.abs(row.rows[0]!.created_at.getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('enforces Car name length and case-insensitive uniqueness', async () => {
    await insertCar('Octavia');

    await expectViolation('INSERT INTO cars (name) VALUES ($1)', [''], '23514');
    await expectViolation('INSERT INTO cars (name) VALUES ($1)', ['x'.repeat(61)], '23514');
    await expectViolation('INSERT INTO cars (name) VALUES ($1)', ['OCTAVIA'], '23505');
    await expectViolation('INSERT INTO cars (name) VALUES ($1)', ['octavia'], '23505');

    const index = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'cars' AND indexdef ILIKE '%lower%'`,
    );
    expect(index.rows[0]?.indexdef).toMatch(/UNIQUE INDEX .* \(lower\(\(name COLLATE "C"\)\)\)/);
  });

  it('accepts a 60-character Car name', async () => {
    await expect(insertCar('n'.repeat(60))).resolves.toEqual(expect.any(Number));
  });

  it('enforces the fuel CHECKs and the boolean full_tank', async () => {
    const carId = await insertCar('Fuel checks');
    const insertFuel = `INSERT INTO fuel
      (car_id, event_date, odometer_km, liters_milliliters, price_huf, full_tank, remark)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    const ok = [carId, '2026-09-17', 1, 1000, 1, true, null];
    const withValue = (index: number, value: unknown) => ok.map((entry, i) => (i === index ? value : entry));

    await expect(client.query(insertFuel, ok)).resolves.toMatchObject({ rowCount: 1 });
    await expectViolation(insertFuel, withValue(1, 'invalid'), '22007');
    await expectViolation(insertFuel, withValue(2, -1), '23514');
    await expectViolation(insertFuel, withValue(3, 0), '23514');
    await expectViolation(insertFuel, withValue(4, -1), '23514');
    await expectViolation(insertFuel, withValue(5, 'maybe'), '22P02');
    await expectViolation(insertFuel, withValue(6, 'x'.repeat(501)), '23514');
    await expect(client.query(insertFuel, withValue(6, 'x'.repeat(500)))).resolves.toMatchObject({ rowCount: 1 });
    await expect(client.query(insertFuel, withValue(4, 0))).resolves.toMatchObject({ rowCount: 1 });
  });

  it('enforces the AdBlue CHECKs', async () => {
    const carId = await insertCar('AdBlue checks');
    const insertAdBlue = `INSERT INTO adblue (car_id, event_date, odometer_km, liters, price)
      VALUES ($1, $2, $3, $4, $5)`;
    const ok = [carId, '2026-09-17', 1, 1.5, 100];
    const withValue = (index: number, value: unknown) => ok.map((entry, i) => (i === index ? value : entry));

    await expect(client.query(insertAdBlue, ok)).resolves.toMatchObject({ rowCount: 1 });
    await expectViolation(insertAdBlue, withValue(1, 'invalid'), '22007');
    await expectViolation(insertAdBlue, withValue(2, -1), '23514');
    await expectViolation(insertAdBlue, withValue(3, 0), '23514');
    await expectViolation(insertAdBlue, withValue(3, -1), '23514');
    await expectViolation(insertAdBlue, withValue(3, 10_000), '22003');
    await expect(client.query(insertAdBlue, withValue(3, 9999.999))).resolves.toMatchObject({ rowCount: 1 });
    await expectViolation(insertAdBlue, withValue(4, -1), '23514');
  });

  it('enforces the expense CHECKs', async () => {
    const carId = await insertCar('Expense checks');
    const insertExpense = 'INSERT INTO expenses (car_id, event_date, price, notes) VALUES ($1, $2, $3, $4)';
    const ok = [carId, '2026-09-17', 100, null];
    const withValue = (index: number, value: unknown) => ok.map((entry, i) => (i === index ? value : entry));

    await expect(client.query(insertExpense, ok)).resolves.toMatchObject({ rowCount: 1 });
    await expectViolation(insertExpense, withValue(1, 'invalid'), '22007');
    await expectViolation(insertExpense, withValue(2, -1), '23514');
    await expectViolation(insertExpense, withValue(3, 'x'.repeat(1001)), '23514');
    await expect(client.query(insertExpense, withValue(3, 'x'.repeat(1000)))).resolves.toMatchObject({ rowCount: 1 });
  });

  it('requires an existing Car and refuses to delete a Car that has Records', async () => {
    const carId = await insertCar('Restricted');

    await expectViolation(
      'INSERT INTO expenses (car_id, event_date, price) VALUES ($1, $2, $3)',
      [999_999, '2026-09-17', 100],
      '23503',
    );
    await expectViolation(
      'INSERT INTO expenses (car_id, event_date, price) VALUES ($1, $2, $3)',
      [null, '2026-09-17', 100],
      '23502',
    );

    await client.query(
      'INSERT INTO fuel (car_id, event_date, odometer_km, liters_milliliters, price_huf, full_tank) VALUES ($1, $2, 1, 1000, 1, false)',
      [carId, '2026-09-17'],
    );
    await client.query(
      'INSERT INTO adblue (car_id, event_date, odometer_km, liters, price) VALUES ($1, $2, 1, 1000, 1)',
      [carId, '2026-09-17'],
    );
    await client.query('INSERT INTO expenses (car_id, event_date, price) VALUES ($1, $2, 1)', [carId, '2026-09-17']);

    await expectViolation('DELETE FROM cars WHERE id = $1', [carId], '23503');
    for (const table of ['fuel', 'adblue', 'expenses']) {
      await client.query(`DELETE FROM ${table} WHERE car_id = $1`, [carId]);
      if (table !== 'expenses') {
        await expectViolation('DELETE FROM cars WHERE id = $1', [carId], '23503');
      }
    }
    await expect(client.query('DELETE FROM cars WHERE id = $1', [carId])).resolves.toMatchObject({ rowCount: 1 });
  });

  it('recreates the three (car_id, event_date DESC, id DESC) indexes', async () => {
    const indexes = await client.query<{ tablename: string; indexdef: string }>(
      `SELECT tablename, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename IN ('fuel', 'adblue', 'expenses')
         AND indexname NOT LIKE '%pkey'`,
    );
    expect(indexes.rows.map((row) => row.tablename).sort()).toEqual(['adblue', 'expenses', 'fuel']);
    for (const row of indexes.rows) {
      expect(row.indexdef).toMatch(/\(car_id, event_date DESC, id DESC\)/);
    }
  });
});
