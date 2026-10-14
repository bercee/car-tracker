import type Database from 'better-sqlite3';
import type { Statement } from 'better-sqlite3';

import type { AdBlueInput, AdBlueRecord, ExpenseInput, ExpenseRecord, FuelInput, FuelRecord } from '../domain.js';
import type { CarDatabase } from './carDatabase.js';
import { mapAdBlueRow, mapExpenseRow, mapFuelRow, type AdBlueRow, type ExpenseRow, type FuelRow } from './mappers.js';

export class SqliteCarDatabase implements CarDatabase {
  readonly #connection: Database.Database;
  readonly #checkHealth: Statement;
  readonly #insertFuel: Statement;
  readonly #selectFuelById: Statement<[bigint | number]>;
  readonly #listFuel: Statement;
  readonly #updateFuel: Statement;
  readonly #deleteFuel: Statement;
  readonly #insertAdBlue: Statement;
  readonly #selectAdBlueById: Statement<[bigint | number]>;
  readonly #listAdBlue: Statement;
  readonly #updateAdBlue: Statement;
  readonly #deleteAdBlue: Statement;
  readonly #insertExpense: Statement;
  readonly #selectExpenseById: Statement<[bigint | number]>;
  readonly #listExpenses: Statement;
  readonly #updateExpense: Statement;
  readonly #deleteExpense: Statement;

  constructor(connection: Database.Database) {
    this.#connection = connection;
    this.#checkHealth = connection.prepare('SELECT 1');
    this.#insertFuel = connection.prepare(`
      INSERT INTO fuel (
        event_date, odometer_km, liters_milliliters, price_huf, full_tank, remark
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.#selectFuelById = connection.prepare('SELECT * FROM fuel WHERE id = ?');
    this.#listFuel = connection.prepare('SELECT * FROM fuel ORDER BY event_date DESC, id DESC');
    this.#updateFuel = connection.prepare(
      'UPDATE fuel SET event_date = ?, odometer_km = ?, liters_milliliters = ?, price_huf = ?, full_tank = ?, remark = ? WHERE id = ?',
    );
    this.#deleteFuel = connection.prepare('DELETE FROM fuel WHERE id = ?');
    this.#insertAdBlue = connection.prepare(`
      INSERT INTO adblue (event_date, odometer_km, liters_milliliters, price_huf)
      VALUES (?, ?, ?, ?)
    `);
    this.#selectAdBlueById = connection.prepare('SELECT * FROM adblue WHERE id = ?');
    this.#listAdBlue = connection.prepare('SELECT * FROM adblue ORDER BY event_date DESC, id DESC');
    this.#updateAdBlue = connection.prepare(
      'UPDATE adblue SET event_date = ?, odometer_km = ?, liters_milliliters = ?, price_huf = ? WHERE id = ?',
    );
    this.#deleteAdBlue = connection.prepare('DELETE FROM adblue WHERE id = ?');
    this.#insertExpense = connection.prepare(`
      INSERT INTO expenses (event_date, amount_huf, notes)
      VALUES (?, ?, ?)
    `);
    this.#selectExpenseById = connection.prepare('SELECT * FROM expenses WHERE id = ?');
    this.#listExpenses = connection.prepare('SELECT * FROM expenses ORDER BY event_date DESC, id DESC');
    this.#updateExpense = connection.prepare(
      'UPDATE expenses SET event_date = ?, amount_huf = ?, notes = ? WHERE id = ?',
    );
    this.#deleteExpense = connection.prepare('DELETE FROM expenses WHERE id = ?');
  }

  checkHealth(): void {
    this.#checkHealth.get();
  }

  addFuel(input: FuelInput): FuelRecord {
    const result = this.#insertFuel.run(
      input.eventDate,
      input.odometerKm,
      input.litersMilliliters,
      input.priceHuf,
      input.fullTank ? 1 : 0,
      input.remark,
    );
    const row = this.#selectFuelById.get(result.lastInsertRowid) as FuelRow | undefined;
    return mapFuelRow(requireInsertedRow(row));
  }

  listFuel(): FuelRecord[] {
    return (this.#listFuel.all() as FuelRow[]).map(mapFuelRow);
  }

  updateFuel(id: number, input: FuelInput): FuelRecord | undefined {
    if (
      this.#updateFuel.run(
        input.eventDate,
        input.odometerKm,
        input.litersMilliliters,
        input.priceHuf,
        input.fullTank ? 1 : 0,
        input.remark,
        id,
      ).changes === 0
    )
      return undefined;
    const row = this.#selectFuelById.get(id) as FuelRow | undefined;
    return row === undefined ? undefined : mapFuelRow(row);
  }

  deleteFuel(id: number): boolean {
    return this.#deleteFuel.run(id).changes === 1;
  }

  addAdBlue(input: AdBlueInput): AdBlueRecord {
    const result = this.#insertAdBlue.run(input.eventDate, input.odometerKm, input.litersMilliliters, input.priceHuf);
    const row = this.#selectAdBlueById.get(result.lastInsertRowid) as AdBlueRow | undefined;
    return mapAdBlueRow(requireInsertedRow(row));
  }

  listAdBlue(): AdBlueRecord[] {
    return (this.#listAdBlue.all() as AdBlueRow[]).map(mapAdBlueRow);
  }

  updateAdBlue(id: number, input: AdBlueInput): AdBlueRecord | undefined {
    if (
      this.#updateAdBlue.run(input.eventDate, input.odometerKm, input.litersMilliliters, input.priceHuf, id).changes ===
      0
    )
      return undefined;
    const row = this.#selectAdBlueById.get(id) as AdBlueRow | undefined;
    return row === undefined ? undefined : mapAdBlueRow(row);
  }

  deleteAdBlue(id: number): boolean {
    return this.#deleteAdBlue.run(id).changes === 1;
  }

  addExpense(input: ExpenseInput): ExpenseRecord {
    const result = this.#insertExpense.run(input.eventDate, input.amountHuf, input.notes);
    const row = this.#selectExpenseById.get(result.lastInsertRowid) as ExpenseRow | undefined;
    return mapExpenseRow(requireInsertedRow(row));
  }

  listExpenses(): ExpenseRecord[] {
    return (this.#listExpenses.all() as ExpenseRow[]).map(mapExpenseRow);
  }

  updateExpense(id: number, input: ExpenseInput): ExpenseRecord | undefined {
    if (this.#updateExpense.run(input.eventDate, input.amountHuf, input.notes, id).changes === 0) return undefined;
    const row = this.#selectExpenseById.get(id) as ExpenseRow | undefined;
    return row === undefined ? undefined : mapExpenseRow(row);
  }

  deleteExpense(id: number): boolean {
    return this.#deleteExpense.run(id).changes === 1;
  }

  close(): void {
    if (this.#connection.open) {
      this.#connection.close();
    }
  }
}

function requireInsertedRow<Row>(row: Row | undefined): Row {
  if (row === undefined) {
    throw new Error('Inserted database row could not be read back');
  }

  return row;
}
