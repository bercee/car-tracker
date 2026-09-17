import type Database from 'better-sqlite3';
import type { Statement } from 'better-sqlite3';

import type { AdBlueInput, AdBlueRecord, ExpenseInput, ExpenseRecord, FuelInput, FuelRecord } from '../domain.js';
import type { CarDatabase } from './carDatabase.js';
import { mapAdBlueRow, mapExpenseRow, mapFuelRow, type AdBlueRow, type ExpenseRow, type FuelRow } from './mappers.js';

export class SqliteCarDatabase implements CarDatabase {
  readonly #connection: Database.Database;
  readonly #insertFuel: Statement;
  readonly #selectFuelById: Statement<[bigint | number]>;
  readonly #listFuel: Statement;
  readonly #insertAdBlue: Statement;
  readonly #selectAdBlueById: Statement<[bigint | number]>;
  readonly #listAdBlue: Statement;
  readonly #insertExpense: Statement;
  readonly #selectExpenseById: Statement<[bigint | number]>;
  readonly #listExpenses: Statement;

  constructor(connection: Database.Database) {
    this.#connection = connection;
    this.#insertFuel = connection.prepare(`
      INSERT INTO fuel (
        event_date, odometer_km, liters_milliliters, price_per_liter_huf, full_tank, remark
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.#selectFuelById = connection.prepare('SELECT * FROM fuel WHERE id = ?');
    this.#listFuel = connection.prepare('SELECT * FROM fuel ORDER BY event_date DESC, id DESC');
    this.#insertAdBlue = connection.prepare(`
      INSERT INTO adblue (event_date, odometer_km, liters_milliliters, price_huf)
      VALUES (?, ?, ?, ?)
    `);
    this.#selectAdBlueById = connection.prepare('SELECT * FROM adblue WHERE id = ?');
    this.#listAdBlue = connection.prepare('SELECT * FROM adblue ORDER BY event_date DESC, id DESC');
    this.#insertExpense = connection.prepare(`
      INSERT INTO expenses (event_date, amount_huf, notes)
      VALUES (?, ?, ?)
    `);
    this.#selectExpenseById = connection.prepare('SELECT * FROM expenses WHERE id = ?');
    this.#listExpenses = connection.prepare('SELECT * FROM expenses ORDER BY event_date DESC, id DESC');
  }

  addFuel(input: FuelInput): FuelRecord {
    const result = this.#insertFuel.run(
      input.eventDate,
      input.odometerKm,
      input.litersMilliliters,
      input.pricePerLiterHuf,
      input.fullTank ? 1 : 0,
      input.remark,
    );
    const row = this.#selectFuelById.get(result.lastInsertRowid) as FuelRow | undefined;
    return mapFuelRow(requireInsertedRow(row));
  }

  listFuel(): FuelRecord[] {
    return (this.#listFuel.all() as FuelRow[]).map(mapFuelRow);
  }

  addAdBlue(input: AdBlueInput): AdBlueRecord {
    const result = this.#insertAdBlue.run(input.eventDate, input.odometerKm, input.litersMilliliters, input.priceHuf);
    const row = this.#selectAdBlueById.get(result.lastInsertRowid) as AdBlueRow | undefined;
    return mapAdBlueRow(requireInsertedRow(row));
  }

  listAdBlue(): AdBlueRecord[] {
    return (this.#listAdBlue.all() as AdBlueRow[]).map(mapAdBlueRow);
  }

  addExpense(input: ExpenseInput): ExpenseRecord {
    const result = this.#insertExpense.run(input.eventDate, input.amountHuf, input.notes);
    const row = this.#selectExpenseById.get(result.lastInsertRowid) as ExpenseRow | undefined;
    return mapExpenseRow(requireInsertedRow(row));
  }

  listExpenses(): ExpenseRecord[] {
    return (this.#listExpenses.all() as ExpenseRow[]).map(mapExpenseRow);
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
