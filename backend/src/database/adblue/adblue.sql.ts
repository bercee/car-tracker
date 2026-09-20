import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { createdAtSchema, eventDateSchema, formatHufAmount, formatScaledInteger, hufSchema, idSchema, odometerSchema, scaledDecimalSchema } from '../validation.js';

export const adblue = sqliteTable('adblue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventDate: text('event_date').notNull(),
  createdAt: text('created_at').notNull().default(''),
  odometerKm: integer('odometer_km').notNull(),
  litersMilliliters: integer('liters_milliliters').notNull(),
  priceHuf: integer('price_huf').notNull(),
}, (table) => [index('idx_adblue_event_date').on(table.eventDate, table.id)]);

export const adBlueInputSchema = z.strictObject({
  eventDate: eventDateSchema,
  odometerKm: odometerSchema,
  liters: scaledDecimalSchema(3),
  price: hufSchema,
}).transform(({ liters, price, ...value }) => ({ ...value, litersMilliliters: liters, priceHuf: price }));

export const adBlueRowSchema = z.strictObject({
  id: idSchema,
  eventDate: eventDateSchema,
  createdAt: createdAtSchema,
  odometerKm: odometerSchema,
  litersMilliliters: z.number().int().positive().max(9_999_999),
  priceHuf: z.number().int().min(0).max(9_999_999),
});

export const adBlueRecordSchema = adBlueRowSchema.transform(({ litersMilliliters, priceHuf, ...row }) => ({
  ...row,
  liters: formatScaledInteger(litersMilliliters, 3),
  price: formatHufAmount(priceHuf),
}));

export type AdBlueInput = z.infer<typeof adBlueInputSchema>;
export type AdBlueRecord = z.infer<typeof adBlueRecordSchema>;
