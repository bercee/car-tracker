import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

import { createdAtSchema, eventDateSchema, formatHufAmount, hufSchema, idSchema, optionalTextSchema } from '../validation.js';

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventDate: text('event_date').notNull(),
  createdAt: text('created_at').notNull().default(''),
  amountHuf: integer('amount_huf').notNull(),
  notes: text('notes'),
}, (table) => [index('idx_expenses_event_date').on(table.eventDate, table.id)]);

export const expenseInputSchema = z.strictObject({
  eventDate: eventDateSchema,
  amount: hufSchema,
  notes: optionalTextSchema(1000),
}).transform(({ amount, ...value }) => ({ ...value, amountHuf: amount }));

export const expenseRowSchema = z.strictObject({
  id: idSchema,
  eventDate: eventDateSchema,
  createdAt: createdAtSchema,
  amountHuf: z.number().int().min(0).max(9_999_999),
  notes: z.string().max(1000).nullable(),
});

export const expenseRecordSchema = expenseRowSchema.transform(({ amountHuf, ...row }) => ({
  ...row,
  amount: formatHufAmount(amountHuf),
}));

export type ExpenseInput = z.infer<typeof expenseInputSchema>;
export type ExpenseRecord = z.infer<typeof expenseRecordSchema>;
