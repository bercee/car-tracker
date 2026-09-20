import {
  fuelRecordSchema,
  fuelRequestSchema,
  idSchema,
  type FuelRecord,
  type FuelRequest,
} from '@car-tracker/contracts';
import { desc, eq } from 'drizzle-orm';

import {
  formatHufAmount,
  formatScaledInteger,
  normalizeOptionalText,
  parseHufAmount,
  parseScaledDecimal,
} from '../conversion.js';
import type { AppDatabase } from '../index.js';
import { fuel, fuelRowSchema } from './fuel.sql.js';

export function addFuel(database: AppDatabase, value: unknown): FuelRecord {
  const input = fuelRequestSchema.parse(value);
  const [row] = database
    .insert(fuel)
    .values({ ...toFuelInsert(input), createdAt: new Date().toISOString() })
    .returning()
    .all();
  return toFuelRecord(row);
}

export function getFuel(database: AppDatabase, id: unknown): FuelRecord | undefined {
  const parsedId = idSchema.parse(id);
  const row = database.select().from(fuel).where(eq(fuel.id, parsedId)).get();
  return row === undefined ? undefined : toFuelRecord(row);
}

export function listFuel(database: AppDatabase): FuelRecord[] {
  return database.select().from(fuel).orderBy(desc(fuel.eventDate), desc(fuel.id)).all().map(toFuelRecord);
}

function toFuelInsert(value: FuelRequest): typeof fuel.$inferInsert {
  return {
    eventDate: value.eventDate,
    odometerKm: value.odometerKm,
    litersMilliliters: parseScaledDecimal(value.liters, 3),
    priceHuf: parseHufAmount(value.price),
    fullTank: value.fullTank,
    remark: normalizeOptionalText(value.remark),
  };
}

function toFuelRecord(value: unknown): FuelRecord {
  const row = fuelRowSchema.parse(value);
  return fuelRecordSchema.parse({
    id: row.id,
    eventDate: row.eventDate,
    createdAt: row.createdAt,
    odometerKm: row.odometerKm,
    liters: formatScaledInteger(row.litersMilliliters, 3),
    price: formatHufAmount(row.priceHuf),
    fullTank: row.fullTank,
    remark: row.remark,
  });
}

export * from './fuel.sql.js';
