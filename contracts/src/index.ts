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

export interface ExpenseRequest {
  eventDate: string;
  amount: string;
  notes?: string | null;
}

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
  notes: string | null;
}

export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'UNSUPPORTED_MEDIA_TYPE' | 'INTERNAL_ERROR';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    field?: string;
  };
}
