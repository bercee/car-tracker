import { and, desc, eq, sql } from 'drizzle-orm';

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
import type { PostgresConnection } from '../postgres.js';
import { adblue, cars, expenses, fuel } from '../schema.js';
import type { CarDatabase } from './carDatabase.js';
import { DuplicateCarNameError } from './errors.js';
import { mapAdBlueRow, mapCarRow, mapExpenseRow, mapFuelRow } from './mappers.js';

const UNIQUE_VIOLATION = '23505';

// Folds only ASCII A-Z and compares by code point, so the order is locale-independent and the
// frontend can reproduce it when it re-sorts after adding or renaming a Car.
const carNameOrder = sql`translate(${cars.name}, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz') COLLATE "C"`;

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

  async addCar(input: CarInput): Promise<Car> {
    try {
      const [row] = await this.#db.insert(cars).values({ name: input.name }).returning();
      return mapCarRow(row!);
    } catch (error) {
      throw translateCarWriteError(error);
    }
  }

  async renameCar(id: number, input: CarInput): Promise<Car | undefined> {
    try {
      const [row] = await this.#db.update(cars).set({ name: input.name }).where(eq(cars.id, id)).returning();
      return row && mapCarRow(row);
    } catch (error) {
      throw translateCarWriteError(error);
    }
  }

  async addFuel(carId: number, input: FuelInput): Promise<FuelRecord> {
    const [row] = await this.#db
      .insert(fuel)
      .values({
        carId,
        eventDate: input.eventDate,
        odometerKm: input.odometerKm,
        litersMilliliters: input.litersMilliliters,
        priceHuf: input.priceHuf,
        fullTank: input.fullTank,
        remark: input.remark,
      })
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
      .set({
        eventDate: input.eventDate,
        odometerKm: input.odometerKm,
        litersMilliliters: input.litersMilliliters,
        priceHuf: input.priceHuf,
        fullTank: input.fullTank,
        remark: input.remark,
      })
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
      .values({
        carId,
        eventDate: input.eventDate,
        odometerKm: input.odometerKm,
        litersMilliliters: input.litersMilliliters,
        priceHuf: input.priceHuf,
      })
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
      .set({
        eventDate: input.eventDate,
        odometerKm: input.odometerKm,
        litersMilliliters: input.litersMilliliters,
        priceHuf: input.priceHuf,
      })
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
      .values({ carId, eventDate: input.eventDate, amountHuf: input.amountHuf, notes: input.notes })
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
      .set({ eventDate: input.eventDate, amountHuf: input.amountHuf, notes: input.notes })
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

// Drizzle wraps driver errors in DrizzleQueryError, so the Postgres error code is on `cause`.
function translateCarWriteError(error: unknown): unknown {
  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return code === UNIQUE_VIOLATION ? new DuplicateCarNameError() : error;
}
