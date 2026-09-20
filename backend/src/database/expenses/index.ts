import { desc, eq } from 'drizzle-orm';

import type { AppDatabase } from '../index.js';
import { expenses, expenseInputSchema, expenseRecordSchema, expenseRowSchema, type ExpenseRecord } from './expenses.sql.js';

export function addExpense(database: AppDatabase, value: unknown): ExpenseRecord {
  const input = expenseInputSchema.parse(value);
  const [row] = database.insert(expenses).values({ ...input, createdAt: new Date().toISOString() }).returning().all();
  return expenseRecordSchema.parse(expenseRowSchema.parse(row));
}

export function getExpense(database: AppDatabase, id: unknown): ExpenseRecord | undefined {
  const parsedId = expenseRowSchema.shape.id.parse(id);
  const row = database.select().from(expenses).where(eq(expenses.id, parsedId)).get();
  return row === undefined ? undefined : expenseRecordSchema.parse(expenseRowSchema.parse(row));
}

export function listExpenses(database: AppDatabase): ExpenseRecord[] {
  return database.select().from(expenses).orderBy(desc(expenses.eventDate), desc(expenses.id)).all().map((row) => expenseRecordSchema.parse(expenseRowSchema.parse(row)));
}

export * from './expenses.sql.js';
