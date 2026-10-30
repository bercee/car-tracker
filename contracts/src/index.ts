import { z } from 'zod';

// A path segment (Car or Record id) coerced to a positive integer.
export const pathIdSchema = z.coerce
  .number({ error: 'must be a positive integer' })
  .int({ error: 'must be a positive integer' })
  .positive({ error: 'must be a positive integer' });

export interface FuelRequest {
  eventDate: string;
  odometerKm: number;
  liters: string;
  price: string;
  fullTank: boolean;
  remark?: string | null;
}

export interface AdBlueRequest {
  eventDate: string;
  odometerKm: number;
  liters: string;
  price: string;
}

export const dateSchema = z.iso.date({ error: 'Enter a valid date.' });

const PRICE_MESSAGE = 'Enter a whole HUF price from 0 to 9,999,999.';
export const priceSchema = z
  .number({ error: PRICE_MESSAGE })
  .int({ error: PRICE_MESSAGE })
  .min(0, { error: PRICE_MESSAGE })
  .max(9_999_999, { error: PRICE_MESSAGE });

// Trimmed text where blank (or absent) is stored as null.
export const optionalText = (maxLength: number, label: string) =>
  z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(maxLength, { error: `${label} must be at most ${maxLength} characters.` })
    .nullish()
    .transform((value) => value || null);

export const expenseRequestSchema = z.strictObject({
  eventDate: dateSchema,
  price: priceSchema,
  notes: optionalText(1000, 'Notes'),
});
export type ExpenseRequest = z.infer<typeof expenseRequestSchema>;

export interface CarRequest {
  name: string;
}

export interface Car extends CarRequest {
  id: number;
  createdAt: string;
}

export interface FuelRecord extends FuelRequest {
  id: number;
  createdAt: string;
  remark: string | null;
}

export interface AdBlueRecord extends AdBlueRequest {
  id: number;
  createdAt: string;
}

export interface ExpenseRecord extends ExpenseRequest {
  id: number;
  createdAt: string;
}

export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'UNSUPPORTED_MEDIA_TYPE' | 'INTERNAL_ERROR';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    field?: string;
  };
}
