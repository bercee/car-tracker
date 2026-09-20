import {
  expenseRecordSchema,
  expenseRequestSchema,
  idSchema,
  type ExpenseRecord,
  type ExpenseRequest,
} from '@car-tracker/contracts';
import { desc, eq } from 'drizzle-orm';

import { formatHufAmount, normalizeOptionalText, parseHufAmount } from '../conversion.js';
import type { AppDatabase } from '../index.js';
import { expenses, expenseRowSchema } from './expenses.sql.js';

export function addExpense(database: AppDatabase, value: unknown): ExpenseRecord {
  const input = expenseRequestSchema.parse(value);
  const [row] = database
    .insert(expenses)
    .values({ ...toExpenseInsert(input), createdAt: new Date().toISOString() })
    .returning()
    .all();
  return toExpenseRecord(row);
}

export function getExpense(database: AppDatabase, id: unknown): ExpenseRecord | undefined {
  const parsedId = idSchema.parse(id);
  const row = database.select().from(expenses).where(eq(expenses.id, parsedId)).get();
  return row === undefined ? undefined : toExpenseRecord(row);
}

export function listExpenses(database: AppDatabase): ExpenseRecord[] {
  return database
    .select()
    .from(expenses)
    .orderBy(desc(expenses.eventDate), desc(expenses.id))
    .all()
    .map(toExpenseRecord);
}

function toExpenseInsert(value: ExpenseRequest): typeof expenses.$inferInsert {
  return {
    eventDate: value.eventDate,
    amountHuf: parseHufAmount(value.amount),
    notes: normalizeOptionalText(value.notes),
  };
}

function toExpenseRecord(value: unknown): ExpenseRecord {
  const row = expenseRowSchema.parse(value);
  return expenseRecordSchema.parse({
    id: row.id,
    eventDate: row.eventDate,
    createdAt: row.createdAt,
    amount: formatHufAmount(row.amountHuf),
    notes: row.notes,
  });
}

export * from './expenses.sql.js';
