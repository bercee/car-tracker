import { createdAtSchema, eventDateSchema, idSchema, maximumValue } from '@car-tracker/contracts';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

export const expenses = sqliteTable(
  'expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventDate: text('event_date').notNull(),
    createdAt: text('created_at').notNull().default(''),
    amountHuf: integer('amount_huf').notNull(),
    notes: text('notes'),
  },
  (table) => [index('idx_expenses_event_date').on(table.eventDate, table.id)],
);

export const expenseRowSchema = z.strictObject({
  id: idSchema,
  eventDate: eventDateSchema,
  createdAt: createdAtSchema,
  amountHuf: z.number().int().min(0).max(maximumValue),
  notes: z.string().max(1000).nullable(),
});
