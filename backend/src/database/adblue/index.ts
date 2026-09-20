import { desc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../index.js';
import { adblue, adBlueInputSchema, adBlueRecordSchema, adBlueRowSchema, type AdBlueRecord } from './adblue.sql.js';

export function addAdBlue(database: AppDatabase, value: unknown): AdBlueRecord {
  const input = adBlueInputSchema.parse(value);
  const [row] = database.insert(adblue).values({ ...input, createdAt: new Date().toISOString() }).returning().all();
  return adBlueRecordSchema.parse(adBlueRowSchema.parse(row));
}

export function getAdBlue(database: AppDatabase, id: unknown): AdBlueRecord | undefined {
  const parsedId = adBlueRowSchema.shape.id.parse(id);
  const row = database.select().from(adblue).where(eq(adblue.id, parsedId)).get();
  return row === undefined ? undefined : adBlueRecordSchema.parse(adBlueRowSchema.parse(row));
}

export function listAdBlue(database: AppDatabase): AdBlueRecord[] {
  return database.select().from(adblue).orderBy(desc(adblue.eventDate), desc(adblue.id)).all().map((row) => adBlueRecordSchema.parse(adBlueRowSchema.parse(row)));
}

export * from './adblue.sql.js';
