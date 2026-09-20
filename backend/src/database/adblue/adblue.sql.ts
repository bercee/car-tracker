import { createdAtSchema, eventDateSchema, idSchema, maximumValue, odometerSchema } from '@car-tracker/contracts';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

export const adblue = sqliteTable(
  'adblue',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventDate: text('event_date').notNull(),
    createdAt: text('created_at').notNull().default(''),
    odometerKm: integer('odometer_km').notNull(),
    litersMilliliters: integer('liters_milliliters').notNull(),
    priceHuf: integer('price_huf').notNull(),
  },
  (table) => [index('idx_adblue_event_date').on(table.eventDate, table.id)],
);

export const adBlueRowSchema = z.strictObject({
  id: idSchema,
  eventDate: eventDateSchema,
  createdAt: createdAtSchema,
  odometerKm: odometerSchema,
  litersMilliliters: z.number().int().positive().max(maximumValue),
  priceHuf: z.number().int().min(0).max(maximumValue),
});
