import { z } from 'zod';

import {
  createdAtSchema,
  eventDateSchema,
  hufSchema,
  idSchema,
  optionalTextSchema,
} from '@car-tracker/contracts/validation';

export const expenseRequestSchema = z
  .strictObject({
    eventDate: eventDateSchema,
    amount: hufSchema,
    notes: optionalTextSchema(1000),
  })
  .meta({ id: 'ExpenseRequest' });

export const expenseRecordSchema = expenseRequestSchema
  .omit({ notes: true })
  .extend({
    id: idSchema,
    createdAt: createdAtSchema,
    notes: z.string().max(1000).nullable(),
  })
  .meta({ id: 'ExpenseRecord' });

export type ExpenseRequest = z.infer<typeof expenseRequestSchema>;
export type ExpenseRecord = z.infer<typeof expenseRecordSchema>;
