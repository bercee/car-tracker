import { desc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../index.js';
import { fuel, fuelInputSchema, fuelRecordSchema, fuelRowSchema, type FuelRecord } from './fuel.sql.js';

export function addFuel(database: AppDatabase, value: unknown): FuelRecord {
  const input = fuelInputSchema.parse(value);
  const now = new Date().toISOString();
  const [row] = database.insert(fuel).values({ ...input, createdAt: now }).returning().all();
  return fuelRecordSchema.parse(fuelRowSchema.parse(row));
}

export function getFuel(database: AppDatabase, id: unknown): FuelRecord | undefined {
  const parsedId = fuelRowSchema.shape.id.parse(id);
  const row = database.select().from(fuel).where(eq(fuel.id, parsedId)).get();
  return row === undefined ? undefined : fuelRecordSchema.parse(fuelRowSchema.parse(row));
}

export function listFuel(database: AppDatabase): FuelRecord[] {
  return database.select().from(fuel).orderBy(desc(fuel.eventDate), desc(fuel.id)).all().map((row) => fuelRecordSchema.parse(fuelRowSchema.parse(row)));
}

export * from './fuel.sql.js';
