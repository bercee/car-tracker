import { and, desc, eq, sql } from 'drizzle-orm';
import pg from 'pg';

import type {
  AdBlueInput,
  AdBlueRecord,
  Car,
  CarRequest,
  ExpenseInput,
  ExpenseRecord,
  FuelInput,
  FuelRecord,
} from '../domain.js';
import type { PostgresConnection } from './postgres.js';
import { adblue, carNameUniqueIndex, cars, expenses, fuel } from './schema.js';
import type { CarDatabase } from './carDatabase.js';
import { DuplicateCarNameError } from './errors.js';
import { mapAdBlueRow, mapCarRow, mapExpenseRow, mapFuelRow } from './mappers.js';

// Folds only ASCII A-Z and compares by code point, so the order is locale-independent and the
// frontend can reproduce it when it re-sorts after adding or renaming a Car.
const carNameOrder = sql`lower(${cars.name} COLLATE "C")`;

export class PostgresCarDatabase implements CarDatabase {
  readonly #db: PostgresConnection['db'];

  constructor(db: PostgresConnection['db']) {
    this.#db = db;
  }

  async listCars(): Promise<Car[]> {
    const rows = await this.#db.select().from(cars).orderBy(carNameOrder, cars.id);
    return rows.map(mapCarRow);
  }

  async getCar(id: number): Promise<Car | undefined> {
    const [row] = await this.#db.select().from(cars).where(eq(cars.id, id));
    return row && mapCarRow(row);
  }

  async addCar(input: CarRequest): Promise<Car> {
    try {
      const [row] = await this.#db.insert(cars).values(input).returning();
      return mapCarRow(row!);
    } catch (error) {
      throw translateCarWriteError(error);
    }
  }

  async renameCar(id: number, input: CarRequest): Promise<Car | undefined> {
    try {
      const [row] = await this.#db.update(cars).set(input).where(eq(cars.id, id)).returning();
      return row && mapCarRow(row);
    } catch (error) {
      throw translateCarWriteError(error);
    }
  }

  async addFuel(carId: number, input: FuelInput): Promise<FuelRecord> {
    const [row] = await this.#db
      .insert(fuel)
      .values({ carId, ...input })
      .returning();
    return mapFuelRow(row!);
  }

  async listFuel(carId: number): Promise<FuelRecord[]> {
    const rows = await this.#db
      .select()
      .from(fuel)
      .where(eq(fuel.carId, carId))
      .orderBy(desc(fuel.eventDate), desc(fuel.id));
    return rows.map(mapFuelRow);
  }

  async updateFuel(carId: number, id: number, input: FuelInput): Promise<FuelRecord | undefined> {
    const [row] = await this.#db
      .update(fuel)
      .set(input)
      .where(and(eq(fuel.id, id), eq(fuel.carId, carId)))
      .returning();
    return row && mapFuelRow(row);
  }

  async deleteFuel(carId: number, id: number): Promise<boolean> {
    const rows = await this.#db
      .delete(fuel)
      .where(and(eq(fuel.id, id), eq(fuel.carId, carId)))
      .returning({ id: fuel.id });
    return rows.length === 1;
  }

  async addAdBlue(carId: number, input: AdBlueInput): Promise<AdBlueRecord> {
    const [row] = await this.#db
      .insert(adblue)
      .values({ carId, ...input })
      .returning();
    return mapAdBlueRow(row!);
  }

  async listAdBlue(carId: number): Promise<AdBlueRecord[]> {
    const rows = await this.#db
      .select()
      .from(adblue)
      .where(eq(adblue.carId, carId))
      .orderBy(desc(adblue.eventDate), desc(adblue.id));
    return rows.map(mapAdBlueRow);
  }

  async updateAdBlue(carId: number, id: number, input: AdBlueInput): Promise<AdBlueRecord | undefined> {
    const [row] = await this.#db
      .update(adblue)
      .set(input)
      .where(and(eq(adblue.id, id), eq(adblue.carId, carId)))
      .returning();
    return row && mapAdBlueRow(row);
  }

  async deleteAdBlue(carId: number, id: number): Promise<boolean> {
    const rows = await this.#db
      .delete(adblue)
      .where(and(eq(adblue.id, id), eq(adblue.carId, carId)))
      .returning({ id: adblue.id });
    return rows.length === 1;
  }

  async addExpense(carId: number, input: ExpenseInput): Promise<ExpenseRecord> {
    const [row] = await this.#db
      .insert(expenses)
      .values({ carId, ...input })
      .returning();
    return mapExpenseRow(row!);
  }

  async listExpenses(carId: number): Promise<ExpenseRecord[]> {
    const rows = await this.#db
      .select()
      .from(expenses)
      .where(eq(expenses.carId, carId))
      .orderBy(desc(expenses.eventDate), desc(expenses.id));
    return rows.map(mapExpenseRow);
  }

  async updateExpense(carId: number, id: number, input: ExpenseInput): Promise<ExpenseRecord | undefined> {
    const [row] = await this.#db
      .update(expenses)
      .set(input)
      .where(and(eq(expenses.id, id), eq(expenses.carId, carId)))
      .returning();
    return row && mapExpenseRow(row);
  }

  async deleteExpense(carId: number, id: number): Promise<boolean> {
    const rows = await this.#db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.carId, carId)))
      .returning({ id: expenses.id });
    return rows.length === 1;
  }
}

// Drizzle wraps driver errors in DrizzleQueryError, so the Postgres error is on `cause`.
function translateCarWriteError(error: unknown): unknown {
  const cause = (error as { cause?: unknown } | null)?.cause;
  return cause instanceof pg.DatabaseError && cause.constraint === carNameUniqueIndex
    ? new DuplicateCarNameError()
    : error;
}
