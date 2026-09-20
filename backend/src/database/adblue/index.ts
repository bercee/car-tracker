import {
  adBlueRecordSchema,
  adBlueRequestSchema,
  idSchema,
  type AdBlueRecord,
  type AdBlueRequest,
} from '@car-tracker/contracts';
import { desc, eq } from 'drizzle-orm';

import { formatHufAmount, formatScaledInteger, parseHufAmount, parseScaledDecimal } from '../conversion.js';
import type { AppDatabase } from '../index.js';
import { adblue, adBlueRowSchema } from './adblue.sql.js';

export function addAdBlue(database: AppDatabase, value: unknown): AdBlueRecord {
  const input = adBlueRequestSchema.parse(value);
  const [row] = database
    .insert(adblue)
    .values({ ...toAdBlueInsert(input), createdAt: new Date().toISOString() })
    .returning()
    .all();
  return toAdBlueRecord(row);
}

export function getAdBlue(database: AppDatabase, id: unknown): AdBlueRecord | undefined {
  const parsedId = idSchema.parse(id);
  const row = database.select().from(adblue).where(eq(adblue.id, parsedId)).get();
  return row === undefined ? undefined : toAdBlueRecord(row);
}

export function listAdBlue(database: AppDatabase): AdBlueRecord[] {
  return database.select().from(adblue).orderBy(desc(adblue.eventDate), desc(adblue.id)).all().map(toAdBlueRecord);
}

function toAdBlueInsert(value: AdBlueRequest): typeof adblue.$inferInsert {
  return {
    eventDate: value.eventDate,
    odometerKm: value.odometerKm,
    litersMilliliters: parseScaledDecimal(value.liters, 3),
    priceHuf: parseHufAmount(value.price),
  };
}

function toAdBlueRecord(value: unknown): AdBlueRecord {
  const row = adBlueRowSchema.parse(value);
  return adBlueRecordSchema.parse({
    id: row.id,
    eventDate: row.eventDate,
    createdAt: row.createdAt,
    odometerKm: row.odometerKm,
    liters: formatScaledInteger(row.litersMilliliters, 3),
    price: formatHufAmount(row.priceHuf),
  });
}

export * from './adblue.sql.js';
