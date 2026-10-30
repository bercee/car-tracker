import Database from 'better-sqlite3';
import type { Statement } from 'better-sqlite3';

import type {
  AdBlueInput,
  AdBlueRecord,
  Car,
  CarInput,
  ExpenseInput,
  ExpenseRecord,
  FuelInput,
  FuelRecord,
} from '../domain.js';
import type { CarDatabase } from './carDatabase.js';
import { DuplicateCarNameError } from './errors.js';
import {
  mapAdBlueRow,
  mapCarRow,
  mapExpenseRow,
  mapFuelRow,
  type AdBlueRow,
  type CarRow,
  type ExpenseRow,
  type FuelRow,
} from './mappers.js';

export class SqliteCarDatabase implements CarDatabase {
  readonly #connection: Database.Database;
  readonly #insertCar: Statement;
  readonly #selectCarById: Statement<[bigint | number]>;
  readonly #listCars: Statement;
  readonly #renameCar: Statement;
  readonly #insertFuel: Statement;
  readonly #selectFuelById: Statement<[bigint | number, bigint | number]>;
  readonly #listFuel: Statement<[bigint | number]>;
  readonly #updateFuel: Statement;
  readonly #deleteFuel: Statement;
  readonly #insertAdBlue: Statement;
  readonly #selectAdBlueById: Statement<[bigint | number, bigint | number]>;
  readonly #listAdBlue: Statement<[bigint | number]>;
  readonly #updateAdBlue: Statement;
  readonly #deleteAdBlue: Statement;
  readonly #insertExpense: Statement;
  readonly #selectExpenseById: Statement<[bigint | number, bigint | number]>;
  readonly #listExpenses: Statement<[bigint | number]>;
  readonly #updateExpense: Statement;
  readonly #deleteExpense: Statement;

  constructor(connection: Database.Database) {
    this.#connection = connection;
    this.#insertCar = connection.prepare('INSERT INTO cars (name) VALUES (?)');
    this.#selectCarById = connection.prepare('SELECT * FROM cars WHERE id = ?');
    this.#listCars = connection.prepare('SELECT * FROM cars ORDER BY name COLLATE NOCASE, id');
    this.#renameCar = connection.prepare('UPDATE cars SET name = ? WHERE id = ?');
    this.#insertFuel = connection.prepare(`
      INSERT INTO fuel (
        car_id, event_date, odometer_km, liters_milliliters, price_huf, full_tank, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.#selectFuelById = connection.prepare('SELECT * FROM fuel WHERE id = ? AND car_id = ?');
    this.#listFuel = connection.prepare('SELECT * FROM fuel WHERE car_id = ? ORDER BY event_date DESC, id DESC');
    this.#updateFuel = connection.prepare(
      'UPDATE fuel SET event_date = ?, odometer_km = ?, liters_milliliters = ?, price_huf = ?, full_tank = ?, remark = ? WHERE id = ? AND car_id = ?',
    );
    this.#deleteFuel = connection.prepare('DELETE FROM fuel WHERE id = ? AND car_id = ?');
    this.#insertAdBlue = connection.prepare(`
      INSERT INTO adblue (car_id, event_date, odometer_km, liters_milliliters, price_huf)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.#selectAdBlueById = connection.prepare('SELECT * FROM adblue WHERE id = ? AND car_id = ?');
    this.#listAdBlue = connection.prepare('SELECT * FROM adblue WHERE car_id = ? ORDER BY event_date DESC, id DESC');
    this.#updateAdBlue = connection.prepare(
      'UPDATE adblue SET event_date = ?, odometer_km = ?, liters_milliliters = ?, price_huf = ? WHERE id = ? AND car_id = ?',
    );
    this.#deleteAdBlue = connection.prepare('DELETE FROM adblue WHERE id = ? AND car_id = ?');
    this.#insertExpense = connection.prepare(`
      INSERT INTO expenses (car_id, event_date, amount_huf, notes)
      VALUES (?, ?, ?, ?)
    `);
    this.#selectExpenseById = connection.prepare('SELECT * FROM expenses WHERE id = ? AND car_id = ?');
    this.#listExpenses = connection.prepare(
      'SELECT * FROM expenses WHERE car_id = ? ORDER BY event_date DESC, id DESC',
    );
    this.#updateExpense = connection.prepare(
      'UPDATE expenses SET event_date = ?, amount_huf = ?, notes = ? WHERE id = ? AND car_id = ?',
    );
    this.#deleteExpense = connection.prepare('DELETE FROM expenses WHERE id = ? AND car_id = ?');
  }

  listCars(): Car[] {
    return (this.#listCars.all() as CarRow[]).map(mapCarRow);
  }

  getCar(id: number): Car | undefined {
    const row = this.#selectCarById.get(id) as CarRow | undefined;
    return row === undefined ? undefined : mapCarRow(row);
  }

  addCar(input: CarInput): Car {
    try {
      const result = this.#insertCar.run(input.name);
      const row = this.#selectCarById.get(result.lastInsertRowid) as CarRow | undefined;
      return mapCarRow(requireInsertedRow(row));
    } catch (error) {
      throw translateCarWriteError(error);
    }
  }

  renameCar(id: number, input: CarInput): Car | undefined {
    try {
      if (this.#renameCar.run(input.name, id).changes === 0) return undefined;
    } catch (error) {
      throw translateCarWriteError(error);
    }
    return this.getCar(id);
  }

  addFuel(carId: number, input: FuelInput): FuelRecord {
    const result = this.#insertFuel.run(
      carId,
      input.eventDate,
      input.odometerKm,
      input.litersMilliliters,
      input.priceHuf,
      input.fullTank ? 1 : 0,
      input.remark,
    );
    const row = this.#selectFuelById.get(result.lastInsertRowid, carId) as FuelRow | undefined;
    return mapFuelRow(requireInsertedRow(row));
  }

  listFuel(carId: number): FuelRecord[] {
    return (this.#listFuel.all(carId) as FuelRow[]).map(mapFuelRow);
  }

  updateFuel(carId: number, id: number, input: FuelInput): FuelRecord | undefined {
    if (
      this.#updateFuel.run(
        input.eventDate,
        input.odometerKm,
        input.litersMilliliters,
        input.priceHuf,
        input.fullTank ? 1 : 0,
        input.remark,
        id,
        carId,
      ).changes === 0
    )
      return undefined;
    const row = this.#selectFuelById.get(id, carId) as FuelRow | undefined;
    return row === undefined ? undefined : mapFuelRow(row);
  }

  deleteFuel(carId: number, id: number): boolean {
    return this.#deleteFuel.run(id, carId).changes === 1;
  }

  addAdBlue(carId: number, input: AdBlueInput): AdBlueRecord {
    const result = this.#insertAdBlue.run(
      carId,
      input.eventDate,
      input.odometerKm,
      input.litersMilliliters,
      input.priceHuf,
    );
    const row = this.#selectAdBlueById.get(result.lastInsertRowid, carId) as AdBlueRow | undefined;
    return mapAdBlueRow(requireInsertedRow(row));
  }

  listAdBlue(carId: number): AdBlueRecord[] {
    return (this.#listAdBlue.all(carId) as AdBlueRow[]).map(mapAdBlueRow);
  }

  updateAdBlue(carId: number, id: number, input: AdBlueInput): AdBlueRecord | undefined {
    if (
      this.#updateAdBlue.run(input.eventDate, input.odometerKm, input.litersMilliliters, input.priceHuf, id, carId)
        .changes === 0
    )
      return undefined;
    const row = this.#selectAdBlueById.get(id, carId) as AdBlueRow | undefined;
    return row === undefined ? undefined : mapAdBlueRow(row);
  }

  deleteAdBlue(carId: number, id: number): boolean {
    return this.#deleteAdBlue.run(id, carId).changes === 1;
  }

  addExpense(carId: number, input: ExpenseInput): ExpenseRecord {
    const result = this.#insertExpense.run(carId, input.eventDate, input.amountHuf, input.notes);
    const row = this.#selectExpenseById.get(result.lastInsertRowid, carId) as ExpenseRow | undefined;
    return mapExpenseRow(requireInsertedRow(row));
  }

  listExpenses(carId: number): ExpenseRecord[] {
    return (this.#listExpenses.all(carId) as ExpenseRow[]).map(mapExpenseRow);
  }

  updateExpense(carId: number, id: number, input: ExpenseInput): ExpenseRecord | undefined {
    if (this.#updateExpense.run(input.eventDate, input.amountHuf, input.notes, id, carId).changes === 0)
      return undefined;
    const row = this.#selectExpenseById.get(id, carId) as ExpenseRow | undefined;
    return row === undefined ? undefined : mapExpenseRow(row);
  }

  deleteExpense(carId: number, id: number): boolean {
    return this.#deleteExpense.run(id, carId).changes === 1;
  }

  close(): void {
    if (this.#connection.open) {
      this.#connection.close();
    }
  }
}

function translateCarWriteError(error: unknown): unknown {
  return error instanceof Database.SqliteError && error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ? new DuplicateCarNameError()
    : error;
}

function requireInsertedRow<Row>(row: Row | undefined): Row {
  if (row === undefined) {
    throw new Error('Inserted database row could not be read back');
  }

  return row;
}
