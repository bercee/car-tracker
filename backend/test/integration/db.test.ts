import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import SqliteDatabase from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { DuplicateCarNameError } from '../../src/database/errors.js';
import { openDatabase } from '../../src/db.js';
import type { TestDatabase } from '../helpers/testDb.js';
import { createCar, createTestDatabase } from '../helpers/testDb.js';

describe('SQLite persistence', () => {
  let testDatabase: TestDatabase | undefined;

  afterEach(() => {
    testDatabase?.closeAndRemove();
    testDatabase = undefined;
  });

  it('creates a nested database path', () => {
    testDatabase = createTestDatabase();

    expect(existsSync(testDatabase.databasePath)).toBe(true);
  });

  it('explicitly enables WAL, foreign keys, and a 5000 ms busy timeout', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'car-tracker-pragmas-'));
    const databasePath = path.join(directory, 'pragma-test.sqlite');
    const connection = new SqliteDatabase(databasePath, { timeout: 1 });

    try {
      connection.pragma('foreign_keys = OFF');
      expect(connection.pragma('foreign_keys', { simple: true })).toBe(0);
      expect(connection.pragma('busy_timeout', { simple: true })).toBe(1);

      connection.exec(readFileSync(new URL('../../src/schema.sql', import.meta.url), 'utf8'));

      expect({
        journalMode: connection.pragma('journal_mode', { simple: true }),
        foreignKeys: connection.pragma('foreign_keys', { simple: true }) === 1,
        busyTimeout: connection.pragma('busy_timeout', { simple: true }),
      }).toEqual({
        journalMode: 'wal',
        foreignKeys: true,
        busyTimeout: 5000,
      });

      connection.exec(`
        CREATE TABLE pragma_parent (id INTEGER PRIMARY KEY);
        CREATE TABLE pragma_child (
          parent_id INTEGER NOT NULL REFERENCES pragma_parent(id)
        );
      `);
      expect(() => connection.prepare('INSERT INTO pragma_child (parent_id) VALUES (?)').run(1)).toThrow(
        /FOREIGN KEY constraint failed/,
      );
    } finally {
      connection.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('initializes the schema idempotently', () => {
    testDatabase = createTestDatabase();
    const car = createCar(testDatabase.database);
    const secondConnection = openDatabase(testDatabase.databasePath);

    expect(secondConnection.listFuel(car.id)).toEqual([]);
    expect(secondConnection.listAdBlue(car.id)).toEqual([]);
    expect(secondConnection.listExpenses(car.id)).toEqual([]);
    secondConnection.close();
  });

  it('inserts and reads all three record types', () => {
    testDatabase = createTestDatabase();
    const car = createCar(testDatabase.database);

    const fuel = testDatabase.database.addFuel(car.id, {
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      litersMilliliters: 47_300,
      priceHuf: 29_284,
      fullTank: true,
      remark: 'Shell',
    });
    const adBlue = testDatabase.database.addAdBlue(car.id, {
      eventDate: '2026-09-16',
      odometerKm: 82_500,
      litersMilliliters: 10_000,
      priceHuf: 7490,
    });
    const expense = testDatabase.database.addExpense(car.id, {
      eventDate: '2026-09-17',
      amountHuf: 32_000,
      notes: 'Annual inspection',
    });

    expect(fuel).toMatchObject({
      id: 1,
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      liters: '47.300',
      price: '29284',
      fullTank: true,
      remark: 'Shell',
    });
    expect(adBlue).toMatchObject({ id: 1, liters: '10.000', price: '7490' });
    expect(expense).toMatchObject({ id: 1, amount: '32000', notes: 'Annual inspection' });
    expect(fuel.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(adBlue.createdAt).toMatch(/^\d{4}-/);
    expect(expense.createdAt).toMatch(/^\d{4}-/);
    expect(testDatabase.database.listFuel(car.id)).toEqual([fuel]);
    expect(testDatabase.database.listAdBlue(car.id)).toEqual([adBlue]);
    expect(testDatabase.database.listExpenses(car.id)).toEqual([expense]);
  });

  it('sorts each list by event date descending and then id descending', () => {
    testDatabase = createTestDatabase();
    const database = testDatabase.database;
    const car = createCar(database);

    database.addFuel(car.id, {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 600,
      fullTank: false,
      remark: null,
    });
    database.addFuel(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 2,
      litersMilliliters: 2000,
      priceHuf: 610,
      fullTank: true,
      remark: null,
    });
    database.addFuel(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 3,
      litersMilliliters: 3000,
      priceHuf: 620,
      fullTank: true,
      remark: null,
    });

    database.addAdBlue(car.id, { eventDate: '2026-01-01', odometerKm: 1, litersMilliliters: 1000, priceHuf: 1000 });
    database.addAdBlue(car.id, { eventDate: '2026-02-01', odometerKm: 2, litersMilliliters: 1000, priceHuf: 2000 });
    database.addAdBlue(car.id, { eventDate: '2026-02-01', odometerKm: 3, litersMilliliters: 1000, priceHuf: 3000 });

    database.addExpense(car.id, { eventDate: '2026-01-01', amountHuf: 1000, notes: null });
    database.addExpense(car.id, { eventDate: '2026-02-01', amountHuf: 2000, notes: null });
    database.addExpense(car.id, { eventDate: '2026-02-01', amountHuf: 3000, notes: null });

    expect(database.listFuel(car.id).map(({ id }) => id)).toEqual([3, 2, 1]);
    expect(database.listAdBlue(car.id).map(({ id }) => id)).toEqual([3, 2, 1]);
    expect(database.listExpenses(car.id).map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it('updates and deletes records without changing identity or crossing resources', () => {
    testDatabase = createTestDatabase();
    const db = testDatabase.database;
    const car = createCar(db);
    const fuel = db.addFuel(car.id, {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 100,
      fullTank: false,
      remark: null,
    });
    const otherFuel = db.addFuel(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 2,
      litersMilliliters: 2000,
      priceHuf: 200,
      fullTank: true,
      remark: null,
    });
    const blue = db.addAdBlue(car.id, {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 100,
    });
    const expense = db.addExpense(car.id, { eventDate: '2026-01-01', amountHuf: 100, notes: null });
    const changedFuel = db.updateFuel(car.id, fuel.id, {
      eventDate: '2026-03-01',
      odometerKm: 22,
      litersMilliliters: 22300,
      priceHuf: 22000,
      fullTank: true,
      remark: 'updated',
    });
    const changedBlue = db.updateAdBlue(car.id, blue.id, {
      eventDate: '2026-03-02',
      odometerKm: 23,
      litersMilliliters: 2300,
      priceHuf: 2300,
    });
    const changedExpense = db.updateExpense(car.id, expense.id, {
      eventDate: '2026-03-03',
      amountHuf: 300,
      notes: 'updated',
    });
    expect(changedFuel).toMatchObject({
      id: fuel.id,
      createdAt: fuel.createdAt,
      eventDate: '2026-03-01',
      liters: '22.300',
      remark: 'updated',
    });
    expect(changedBlue).toMatchObject({
      id: blue.id,
      createdAt: blue.createdAt,
      eventDate: '2026-03-02',
      liters: '2.300',
    });
    expect(changedExpense).toMatchObject({
      id: expense.id,
      createdAt: expense.createdAt,
      eventDate: '2026-03-03',
      amount: '300',
      notes: 'updated',
    });
    expect(db.listFuel(car.id).map((row) => row.id)).toEqual([fuel.id, otherFuel.id]);
    expect(
      db.updateFuel(car.id, 999, {
        eventDate: '2026-03-01',
        odometerKm: 2,
        litersMilliliters: 1000,
        priceHuf: 100,
        fullTank: false,
        remark: null,
      }),
    ).toBeUndefined();
    expect(db.deleteFuel(car.id, fuel.id)).toBe(true);
    expect(db.deleteFuel(car.id, otherFuel.id)).toBe(true);
    expect(db.deleteAdBlue(car.id, blue.id)).toBe(true);
    expect(db.deleteExpense(car.id, expense.id)).toBe(true);
    expect(db.deleteFuel(car.id, fuel.id)).toBe(false);
    expect(db.listFuel(car.id)).toEqual([]);
    expect(db.listAdBlue(car.id)).toEqual([]);
    expect(db.listExpenses(car.id)).toEqual([]);
  });

  it('preserves records after close and reopen', () => {
    testDatabase = createTestDatabase();
    const car = createCar(testDatabase.database);
    testDatabase.database.addExpense(car.id, { eventDate: '2026-09-17', amountHuf: 5000, notes: null });
    testDatabase.database.close();

    const reopened = openDatabase(testDatabase.databasePath);
    expect(reopened.listExpenses(car.id)).toMatchObject([{ id: 1, amount: '5000' }]);
    reopened.close();
  });

  it('enforces database CHECK constraints on direct writes', () => {
    testDatabase = createTestDatabase();
    createCar(testDatabase.database);
    testDatabase.database.close();
    const connection = new SqliteDatabase(testDatabase.databasePath);
    connection.pragma('foreign_keys = ON');

    const insertFuel = connection.prepare(
      `INSERT INTO fuel
        (car_id, event_date, odometer_km, liters_milliliters, price_huf, full_tank, remark)
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
    );
    expect(() => insertFuel.run('invalid', 1, 1000, 1000, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', -1, 1000, 1000, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 0, 1000, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, -1, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, 619.5, 1, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, 1000, 2, null)).toThrow();
    expect(() => insertFuel.run('2026-09-17', 1, 1000, 1000, 1, 'x'.repeat(501))).toThrow();

    const insertAdBlue = connection.prepare(
      'INSERT INTO adblue (car_id, event_date, odometer_km, liters_milliliters, price_huf) VALUES (1, ?, ?, ?, ?)',
    );
    expect(() => insertAdBlue.run('invalid', 1, 1000, 100)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', -1, 1000, 100)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', 1, 0, 100)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', 1, 1000, -1)).toThrow();
    expect(() => insertAdBlue.run('2026-09-17', 1, 1000, 7490.5)).toThrow();

    const insertExpense = connection.prepare(
      'INSERT INTO expenses (car_id, event_date, amount_huf, notes) VALUES (1, ?, ?, ?)',
    );
    expect(() => insertExpense.run('invalid', 100, null)).toThrow();
    expect(() => insertExpense.run('2026-09-17', -1, null)).toThrow();
    expect(() => insertExpense.run('2026-09-17', 32_000.5, null)).toThrow();
    expect(() => insertExpense.run('2026-09-17', 100, 'x'.repeat(1001))).toThrow();

    expect(connection.prepare('SELECT count(*) AS count FROM fuel').get()).toEqual({ count: 0 });
    expect(connection.prepare('SELECT count(*) AS count FROM adblue').get()).toEqual({ count: 0 });
    expect(connection.prepare('SELECT count(*) AS count FROM expenses').get()).toEqual({ count: 0 });
    connection.close();
  });

  it('starts with no cars and lists cars by name case-insensitively', () => {
    testDatabase = createTestDatabase();
    const db = testDatabase.database;
    expect(db.listCars()).toEqual([]);

    const zeta = createCar(db, 'Zeta');
    const beta = createCar(db, 'beta');
    const alpha = createCar(db, 'Alpha');

    expect(zeta).toMatchObject({ id: 1, name: 'Zeta' });
    expect(zeta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(db.listCars().map(({ name }) => name)).toEqual(['Alpha', 'beta', 'Zeta']);
    expect(db.getCar(beta.id)).toEqual(beta);
    expect(db.getCar(alpha.id + 100)).toBeUndefined();
  });

  it('rejects duplicate car names case-insensitively and allows renaming to the own name', () => {
    testDatabase = createTestDatabase();
    const db = testDatabase.database;
    const first = createCar(db, 'Octavia');
    const second = createCar(db, 'Golf');

    expect(() => db.addCar({ name: 'octavia' })).toThrow(DuplicateCarNameError);
    expect(() => db.renameCar(second.id, { name: 'OCTAVIA' })).toThrow(DuplicateCarNameError);
    expect(db.renameCar(first.id, { name: 'OCTAVIA' })).toMatchObject({ id: first.id, name: 'OCTAVIA' });
    expect(db.renameCar(second.id, { name: 'Golf' })).toMatchObject({ id: second.id, name: 'Golf' });
    expect(db.renameCar(999, { name: 'Nobody' })).toBeUndefined();
    expect(db.listCars()).toHaveLength(2);
  });

  it('keeps records isolated per car and ignores a wrong car id on update and delete', () => {
    testDatabase = createTestDatabase();
    const db = testDatabase.database;
    const carA = createCar(db, 'A');
    const carB = createCar(db, 'B');
    const fuel = {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 100,
      fullTank: false,
      remark: null,
    };
    const blue = { eventDate: '2026-01-01', odometerKm: 1, litersMilliliters: 1000, priceHuf: 100 };
    const expense = { eventDate: '2026-01-01', amountHuf: 100, notes: null };
    const fuelA = db.addFuel(carA.id, fuel);
    const blueA = db.addAdBlue(carA.id, blue);
    const expenseA = db.addExpense(carA.id, expense);

    expect(db.listFuel(carB.id)).toEqual([]);
    expect(db.listAdBlue(carB.id)).toEqual([]);
    expect(db.listExpenses(carB.id)).toEqual([]);
    expect(db.updateFuel(carB.id, fuelA.id, fuel)).toBeUndefined();
    expect(db.updateAdBlue(carB.id, blueA.id, blue)).toBeUndefined();
    expect(db.updateExpense(carB.id, expenseA.id, expense)).toBeUndefined();
    expect(db.deleteFuel(carB.id, fuelA.id)).toBe(false);
    expect(db.deleteAdBlue(carB.id, blueA.id)).toBe(false);
    expect(db.deleteExpense(carB.id, expenseA.id)).toBe(false);
    expect(db.listFuel(carA.id)).toEqual([fuelA]);
    expect(db.listAdBlue(carA.id)).toEqual([blueA]);
    expect(db.listExpenses(carA.id)).toEqual([expenseA]);
  });

  it('rejects records for an unknown car through the foreign key', () => {
    testDatabase = createTestDatabase();

    expect(() =>
      testDatabase!.database.addExpense(999, { eventDate: '2026-01-01', amountHuf: 100, notes: null }),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it.each([
    [
      'record tables without a cars table',
      `CREATE TABLE fuel (id INTEGER PRIMARY KEY AUTOINCREMENT, event_date TEXT NOT NULL);
       CREATE INDEX idx_fuel_event_date ON fuel(event_date DESC, id DESC);`,
      false,
    ],
    [
      'a cars table but a fuel table without car_id',
      `CREATE TABLE cars (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
       CREATE TABLE fuel (id INTEGER PRIMARY KEY AUTOINCREMENT, event_date TEXT NOT NULL);`,
      true,
    ],
  ])('refuses to open a legacy database with %s without running the new schema', (_name, legacySql, hasCars) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'car-tracker-legacy-'));
    const databasePath = path.join(directory, 'legacy.sqlite');
    const connection = new SqliteDatabase(databasePath);
    connection.exec(legacySql);
    connection.close();

    try {
      expect(() => openDatabase(databasePath)).toThrow(/Delete the file/);
      expect(() => openDatabase(databasePath)).toThrow(databasePath);

      const inspect = new SqliteDatabase(databasePath, { readonly: true });
      try {
        const names = (inspect.prepare('SELECT name FROM sqlite_master').all() as { name: string }[]).map(
          ({ name }) => name,
        );
        expect(names.filter((name) => /^idx_.*_car_event_date$/.test(name))).toEqual([]);
        expect(names.includes('cars')).toBe(hasCars);
      } finally {
        inspect.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
