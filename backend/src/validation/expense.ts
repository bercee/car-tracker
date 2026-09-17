import type { ExpenseInput } from '../domain.js';
import {
  normalizeOptionalText,
  parseCalendarDate,
  parseHufAmount,
  requireExactKeys,
  requirePlainObject,
} from './common.js';

export function validateExpenseRequest(value: unknown): ExpenseInput {
  const object = requirePlainObject(value);
  requireExactKeys(object, ['eventDate', 'amount'], ['notes']);

  return {
    eventDate: parseCalendarDate(object.eventDate),
    amountHuf: parseHufAmount(object.amount, 'amount', 9_999_999),
    notes: normalizeOptionalText(object.notes, 'notes', 1000),
  };
}
