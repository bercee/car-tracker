import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { createdAtSchema, eventDateSchema, formatHufAmount, formatScaledInteger, hufSchema, idSchema, odometerSchema, optionalTextSchema, scaledDecimalSchema } from '../validation.js';

export const fuel = sqliteTable('fuel', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventDate: text('event_date').notNull(),
  createdAt: text('created_at').notNull().default(''),
  odometerKm: integer('odometer_km').notNull(),
  litersMilliliters: integer('liters_milliliters').notNull(),
  priceHuf: integer('price_huf').notNull(),
  fullTank: integer('full_tank', { mode: 'boolean' }).notNull(),
  remark: text('remark'),
}, (table) => [index('idx_fuel_event_date').on(table.eventDate, table.id)]);

export const fuelInputSchema = z.strictObject({
  eventDate: eventDateSchema,
  odometerKm: odometerSchema,
  liters: scaledDecimalSchema(3),
  price: hufSchema,
  fullTank: z.boolean(),
  remark: optionalTextSchema(500),
}).transform(({ liters, price, ...value }) => ({ ...value, litersMilliliters: liters, priceHuf: price }));

export const fuelRowSchema = z.strictObject({
  id: idSchema,
  eventDate: eventDateSchema,
  createdAt: createdAtSchema,
  odometerKm: odometerSchema,
  litersMilliliters: z.number().int().positive().max(9_999_999),
  priceHuf: z.number().int().min(0).max(9_999_999),
  fullTank: z.boolean(),
  remark: z.string().max(500).nullable(),
});

export const fuelRecordSchema = fuelRowSchema.transform(({ litersMilliliters, priceHuf, ...row }) => ({
  ...row,
  liters: formatScaledInteger(litersMilliliters, 3),
  price: formatHufAmount(priceHuf),
}));

export type FuelInput = z.infer<typeof fuelInputSchema>;
export type FuelRecord = z.infer<typeof fuelRecordSchema>;
