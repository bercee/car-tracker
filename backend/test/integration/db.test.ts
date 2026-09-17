import { existsSync } from 'node:fs';

import SqliteDatabase from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { openDatabase } from '../../src/db.js';
import type { TestDatabase } from '../helpers/testDb.js';
import { createTestDatabase } from '../helpers/testDb.js';

describe('SQLite persistence', () => {
  let testDatabase: TestDatabase | undefined;

  afterEach(() => {
    testDatabase?.closeAndRemove();
    testDatabase = undefined;
  });

  it('creates a nested database path and enables required pragmas', () => {
    testDatabase = createTestDatabase();

    expect(existsSync(testDatabase.databasePath)).toBe(true);
    expect(testDatabase.database.diagnostics()).toEqual({
      journalMode: 'wal',
      foreignKeys: true,
      busyTimeout: 5000,
    });
  });

  it('initializes the schema idempotently', () => {
    testDatabase = createTestDatabase();
    const secondConnection = openDatabase(testDatabase.databasePath);

    expect(secondConnection.listFuel()).toEqual([]);
    expect(secondConnection.listAdBlue()).toEqual([]);
    expect(secondConnection.listExpenses()).toEqual([]);
    secondConnection.close();
  });

  it('inserts and reads all three record types', () => {
    testDatabase = createTestDatabase();

    const fuel = testDatabase.database.addFuel({
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      litersMilliliters: 47_300,
      pricePerLiterHuf: 619,
      fullTank: true,
      remark: 'Shell',
    });
    const adBlue = testDatabase.database.addAdBlue({
      eventDate: '2026-09-16',
      odometerKm: 82_500,
      litersMilliliters: 10_000,
      priceHuf: 7490,
    });
    const expense = testDatabase.database.addExpense({
      eventDate: '2026-09-17',
      amountHuf: 32_000,
      notes: 'Annual inspection',
    });

    expect(fuel).toMatchObject({
      id: 1,
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      liters: '47.300',
      pricePerLiter: '619',
      fullTank: true,
      remark: 'Shell',
    });
    expect(adBlue).toMatchObject({ id: 1, liters: '10.000', price: '7490' });
    expect(expense).toMatchObject({ id: 1, amount: '32000', notes: 'Annual inspection' });
    expect(fuel.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(adBlue.createdAt).toMatch(/^\d{4}-/);
    expect(expense.createdAt).toMatch(/^\d{4}-/);
    expect(testDatabase.database.listFuel()).toEqual([fuel]);
    expect(testDatabase.database.listAdBlue()).toEqual([adBlue]);
    expect(testDatabase.database.listExpenses()).toEqual([expense]);
  });

  it('sorts each list by event date descending and then id descending', () => {
    testDatabase = createTestDatabase();
    const database = testDatabase.database;

    database.addFuel({
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      pricePerLiterHuf: 600,
      fullTank: false,
      remark: null,
    });
    database.addFuel({
      eventDate: '2026-02-01',
      odometerKm: 2,
      litersMilliliters: 2000,
      pricePerLiterHuf: 610,
      fullTank: true,
      remark: null,
    });
    database.addFuel({
      eventDate: '2026-02-01',
      odometerKm: 3,
      litersMilliliters: 3000,
      pricePerLiterHuf: 620,
      fullTank: true,
      remark: null,
    });

    database.addAdBlue({ eventDate: '2026-01-01', odometerKm: 1, litersMilliliters: 1000, priceHuf: 1000 });
    database.addAdBlue({ eventDate: '2026-02-01', odometerKm: 2, litersMilliliters: 1000, priceHuf: 2000 });
    database.addAdBlue({ eventDate: '2026-02-01', odometerKm: 3, litersMilliliters: 1000, priceHuf: 3000 });

    database.addExpense({ eventDate: '2026-01-01', amountHuf: 1000, notes: null });
    database.addExpense({ eventDate: '2026-02-01', amountHuf: 2000, notes: null });
    database.addExpense({ eventDate: '2026-02-01', amountHuf: 3000, notes: null });

    expect(database.listFuel().map(({ id }) => id)).toEqual([3, 2, 1]);
    expect(database.listAdBlue().map(({ id }) => id)).toEqual([3, 2, 1]);
    expect(database.listExpenses().map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it('preserves records after close and reopen', () => {
    testDatabase = createTestDatabase();
    testDatabase.database.addExpense({ eventDate: '2026-09-17', amountHuf: 5000, notes: null });
    testDatabase.database.close();

    const reopened = openDatabase(testDatabase.databasePath);
    expect(reopened.listExpenses()).toMatchObject([{ id: 1, amount: '5000' }]);
    reopened.close();
  });

  it('enforces database CHECK constraints on direct writes', () => {
    testDatabase = createTestDatabase();
    testDatabase.database.close();
    const connection = new SqliteDatabase(testDatabase.databasePath);

    const insertFuel = connection.prepare(
      `INSERT INTO fuel
        (event_date, odometer_km, liters_milliliters, price_per_liter_huf, full_tank, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    expect(() => insertFuel.run('invalid', 1, 1000, 1000, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', -1, 1000, 1000, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 0, 1000, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, -1, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, 619.5, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, 1000, 2, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, 1000, 1, 'x'.repeat(501))).toThrow();

    const insertAdBlue = connection.prepare(
      'INSERT INTO adblue (event_date, odometer_km, liters_milliliters, price_huf) VALUES (?, ?, ?, ?)',
    );
    expect(() => insertAdBlue.run('invalid', 1, 1000, 100)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', -1, 1000, 100)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', 1, 0, 100)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', 1, 1000, -1)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', 1, 1000, 7490.5)).toThrow();

    const insertExpense = connection.prepare('INSERT INTO expenses (event_date, amount_huf, notes) VALUES (?, ?, ?)');
    expect(() => insertExpense.run('invalid', 100, null)).toThrow();
    expect(() => insertExpense.run('2026-09-17', -1, null)).toThrow();
    expect(() => insertExpense.run('2026-09-17', 32_000.5, null)).toThrow();
    expect(() => insertExpense.run('2026-09-17', 100, 'x'.repeat(1001))).toThrow();

    expect(connection.prepare('SELECT count(*) AS count FROM fuel').get()).toEqual({ count: 0 });
    expect(connection.prepare('SELECT count(*) AS count FROM adblue').get()).toEqual({ count: 0 });
    expect(connection.prepare('SELECT count(*) AS count FROM expenses').get()).toEqual({ count: 0 });
    connection.close();
  });

  it('allows close to be called more than once and removes temporary files', () => {
    testDatabase = createTestDatabase();
    const databasePath = testDatabase.databasePath;

    testDatabase.database.close();
    testDatabase.database.close();
    testDatabase.closeAndRemove();

    expect(existsSync(databasePath)).toBe(false);
  });
});
