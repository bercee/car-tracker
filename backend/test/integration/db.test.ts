import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DuplicateCarNameError } from '../../src/database/errors.js';
import type { CarDatabase } from '../../src/database/carDatabase.js';
import type { TestDatabase } from '../helpers/testDb.js';
import { createCar, startTestDatabase } from '../helpers/testDb.js';

describe('PostgresCarDatabase', () => {
  let testDatabase: TestDatabase;
  let database: CarDatabase;

  beforeAll(async () => {
    testDatabase = await startTestDatabase();
    database = testDatabase.database;
  }, 60_000);

  afterAll(async () => {
    await testDatabase.stop();
  });

  beforeEach(async () => {
    await testDatabase.reset();
  });

  it('inserts and reads all three record types', async () => {
    const car = await createCar(database);

    const fuel = await database.addFuel(car.id, {
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      litersMilliliters: 47_300,
      priceHuf: 29_284,
      fullTank: true,
      remark: 'Shell',
    });
    const adBlue = await database.addAdBlue(car.id, {
      eventDate: '2026-09-16',
      odometerKm: 82_500,
      litersMilliliters: 10_000,
      priceHuf: 7490,
    });
    const expense = await database.addExpense(car.id, {
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
    expect(await database.listFuel(car.id)).toEqual([fuel]);
    expect(await database.listAdBlue(car.id)).toEqual([adBlue]);
    expect(await database.listExpenses(car.id)).toEqual([expense]);
  });

  it('sorts each list by event date descending and then id descending', async () => {
    const car = await createCar(database);

    await database.addFuel(car.id, {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 600,
      fullTank: false,
      remark: null,
    });
    await database.addFuel(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 2,
      litersMilliliters: 2000,
      priceHuf: 610,
      fullTank: true,
      remark: null,
    });
    await database.addFuel(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 3,
      litersMilliliters: 3000,
      priceHuf: 620,
      fullTank: true,
      remark: null,
    });

    await database.addAdBlue(car.id, {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 1000,
    });
    await database.addAdBlue(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 2,
      litersMilliliters: 1000,
      priceHuf: 2000,
    });
    await database.addAdBlue(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 3,
      litersMilliliters: 1000,
      priceHuf: 3000,
    });

    await database.addExpense(car.id, { eventDate: '2026-01-01', amountHuf: 1000, notes: null });
    await database.addExpense(car.id, { eventDate: '2026-02-01', amountHuf: 2000, notes: null });
    await database.addExpense(car.id, { eventDate: '2026-02-01', amountHuf: 3000, notes: null });

    expect((await database.listFuel(car.id)).map(({ id }) => id)).toEqual([3, 2, 1]);
    expect((await database.listAdBlue(car.id)).map(({ id }) => id)).toEqual([3, 2, 1]);
    expect((await database.listExpenses(car.id)).map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it('updates and deletes records without changing identity or crossing resources', async () => {
    const car = await createCar(database);
    const fuel = await database.addFuel(car.id, {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 100,
      fullTank: false,
      remark: null,
    });
    const otherFuel = await database.addFuel(car.id, {
      eventDate: '2026-02-01',
      odometerKm: 2,
      litersMilliliters: 2000,
      priceHuf: 200,
      fullTank: true,
      remark: null,
    });
    const blue = await database.addAdBlue(car.id, {
      eventDate: '2026-01-01',
      odometerKm: 1,
      litersMilliliters: 1000,
      priceHuf: 100,
    });
    const expense = await database.addExpense(car.id, { eventDate: '2026-01-01', amountHuf: 100, notes: null });
    const changedFuel = await database.updateFuel(car.id, fuel.id, {
      eventDate: '2026-03-01',
      odometerKm: 22,
      litersMilliliters: 22300,
      priceHuf: 22000,
      fullTank: true,
      remark: 'updated',
    });
    const changedBlue = await database.updateAdBlue(car.id, blue.id, {
      eventDate: '2026-03-02',
      odometerKm: 23,
      litersMilliliters: 2300,
      priceHuf: 2300,
    });
    const changedExpense = await database.updateExpense(car.id, expense.id, {
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
    expect((await database.listFuel(car.id)).map((row) => row.id)).toEqual([fuel.id, otherFuel.id]);
    expect(
      await database.updateFuel(car.id, 999, {
        eventDate: '2026-03-01',
        odometerKm: 2,
        litersMilliliters: 1000,
        priceHuf: 100,
        fullTank: false,
        remark: null,
      }),
    ).toBeUndefined();
    expect(await database.deleteFuel(car.id, fuel.id)).toBe(true);
    expect(await database.deleteFuel(car.id, otherFuel.id)).toBe(true);
    expect(await database.deleteAdBlue(car.id, blue.id)).toBe(true);
    expect(await database.deleteExpense(car.id, expense.id)).toBe(true);
    expect(await database.deleteFuel(car.id, fuel.id)).toBe(false);
    expect(await database.listFuel(car.id)).toEqual([]);
    expect(await database.listAdBlue(car.id)).toEqual([]);
    expect(await database.listExpenses(car.id)).toEqual([]);
  });

  it('starts with no cars and lists cars by name case-insensitively', async () => {
    expect(await database.listCars()).toEqual([]);

    const zeta = await createCar(database, 'Zeta');
    const beta = await createCar(database, 'beta');
    const alpha = await createCar(database, 'Alpha');

    expect(zeta).toMatchObject({ id: 1, name: 'Zeta' });
    expect(zeta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect((await database.listCars()).map(({ name }) => name)).toEqual(['Alpha', 'beta', 'Zeta']);
    expect(await database.getCar(beta.id)).toEqual(beta);
    expect(await database.getCar(alpha.id + 100)).toBeUndefined();
  });

  it('rejects duplicate car names case-insensitively and allows renaming to the own name', async () => {
    const first = await createCar(database, 'Octavia');
    const second = await createCar(database, 'Golf');

    await expect(database.addCar({ name: 'octavia' })).rejects.toThrow(DuplicateCarNameError);
    await expect(database.renameCar(second.id, { name: 'OCTAVIA' })).rejects.toThrow(DuplicateCarNameError);
    expect(await database.renameCar(first.id, { name: 'OCTAVIA' })).toMatchObject({ id: first.id, name: 'OCTAVIA' });
    expect(await database.renameCar(second.id, { name: 'Golf' })).toMatchObject({ id: second.id, name: 'Golf' });
    expect(await database.renameCar(999, { name: 'Nobody' })).toBeUndefined();
    expect(await database.listCars()).toHaveLength(2);
  });

  it('keeps records isolated per car and ignores a wrong car id on update and delete', async () => {
    const carA = await createCar(database, 'A');
    const carB = await createCar(database, 'B');
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
    const fuelA = await database.addFuel(carA.id, fuel);
    const blueA = await database.addAdBlue(carA.id, blue);
    const expenseA = await database.addExpense(carA.id, expense);

    expect(await database.listFuel(carB.id)).toEqual([]);
    expect(await database.listAdBlue(carB.id)).toEqual([]);
    expect(await database.listExpenses(carB.id)).toEqual([]);
    expect(await database.updateFuel(carB.id, fuelA.id, fuel)).toBeUndefined();
    expect(await database.updateAdBlue(carB.id, blueA.id, blue)).toBeUndefined();
    expect(await database.updateExpense(carB.id, expenseA.id, expense)).toBeUndefined();
    expect(await database.deleteFuel(carB.id, fuelA.id)).toBe(false);
    expect(await database.deleteAdBlue(carB.id, blueA.id)).toBe(false);
    expect(await database.deleteExpense(carB.id, expenseA.id)).toBe(false);
    expect(await database.listFuel(carA.id)).toEqual([fuelA]);
    expect(await database.listAdBlue(carA.id)).toEqual([blueA]);
    expect(await database.listExpenses(carA.id)).toEqual([expenseA]);
  });

  it('rejects records for an unknown car through the foreign key', async () => {
    await expect(
      database.addExpense(999, { eventDate: '2026-01-01', amountHuf: 100, notes: null }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('lists cars by ASCII-folded code-point order, matching the frontend', async () => {
    for (const name of ['b', 'B2', 'a', 'Z', '_x', 'Árpád']) await createCar(database, name);

    expect((await database.listCars()).map(({ name }) => name)).toEqual(['_x', 'a', 'b', 'B2', 'Z', 'Árpád']);
  });
});
