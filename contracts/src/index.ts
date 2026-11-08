import { z } from 'zod';

// A path segment (Car or Record id) coerced to a positive integer.
export const pathIdSchema = z.coerce
  .number({ error: 'must be a positive integer' })
  .int({ error: 'must be a positive integer' })
  .positive({ error: 'must be a positive integer' });

// ISO 8601 allows year 0000, but a calendar date starts at year 1.
export const dateSchema = z.iso
  .date({ error: 'Enter a valid date.' })
  .refine((date) => !date.startsWith('0000'), { error: 'Enter a valid date.' });

const wholeNumberUpTo = (max: number, message: string) =>
  z.number({ error: message }).int({ error: message }).min(0, { error: message }).max(max, { error: message });

export const priceSchema = wholeNumberUpTo(9_999_999, 'Enter a whole HUF price from 0 to 9,999,999.');

// Trimmed text; blank or absent becomes null.
export const optionalText = (maxLength: number, label: string) =>
  z
    .string({ error: `${label} must be text.` })
    .trim()
    .max(maxLength, { error: `${label} must be at most ${maxLength} characters.` })
    .nullish()
    .transform((value) => value || null);

const LITERS_MESSAGE = 'Enter liters above 0 and up to 9,999.999, with at most three decimal places.';
export const litersSchema = z
  .number({ error: LITERS_MESSAGE })
  .positive({ error: LITERS_MESSAGE })
  .max(9_999.999, { error: LITERS_MESSAGE })
  .multipleOf(0.001, { error: LITERS_MESSAGE });

export const odometerSchema = wholeNumberUpTo(9_999_999, 'Enter an odometer value from 0 to 9,999,999 km.');

const refuelEventFields = {
  eventDate: dateSchema,
  odometerKm: odometerSchema,
  liters: litersSchema,
  price: priceSchema,
};

export const adBlueRequestSchema = z.strictObject({ ...refuelEventFields });
export type AdBlueRequest = z.infer<typeof adBlueRequestSchema>;

export const fuelRequestSchema = z.strictObject({
  ...refuelEventFields,
  fullTank: z.boolean({ error: 'Choose whether the tank was filled.' }),
  remark: optionalText(500, 'Remark'),
});
export type FuelRequest = z.infer<typeof fuelRequestSchema>;

export const expenseRequestSchema = z.strictObject({
  eventDate: dateSchema,
  price: priceSchema,
  notes: optionalText(1000, 'Notes'),
});
export type ExpenseRequest = z.infer<typeof expenseRequestSchema>;

export const carRequestSchema = z.strictObject({
  name: z
    .string({ error: 'Car name must be text.' })
    .trim()
    .min(1, { error: 'Enter a car name.' })
    .max(60, { error: 'Car name must be at most 60 characters.' }),
});

export type CarRequest = z.infer<typeof carRequestSchema>;

export interface Car extends CarRequest {
  id: number;
  createdAt: string;
}

export interface FuelRecord extends FuelRequest {
  id: number;
  createdAt: string;
}

export interface AdBlueRecord extends AdBlueRequest {
  id: number;
  createdAt: string;
}

export interface ExpenseRecord extends ExpenseRequest {
  id: number;
  createdAt: string;
}

export type ErrorCode =
  'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'UNSUPPORTED_MEDIA_TYPE' | 'INTERNAL_ERROR' | 'DATABASE_UNAVAILABLE';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    field?: string;
  };
}
