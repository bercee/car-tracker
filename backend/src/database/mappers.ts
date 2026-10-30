import type { AdBlueRecord, Car, ExpenseRecord, FuelRecord } from '../domain.js';
import type { adblue, cars, expenses, fuel } from './schema.js';
import { formatHufAmount, formatScaledInteger } from '../validation/common.js';

export type CarRow = typeof cars.$inferSelect;
export type FuelRow = typeof fuel.$inferSelect;
export type AdBlueRow = typeof adblue.$inferSelect;
export type ExpenseRow = typeof expenses.$inferSelect;

export function mapCarRow(row: CarRow): Car {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapFuelRow(row: FuelRow): FuelRecord {
  return {
    id: row.id,
    eventDate: row.eventDate,
    createdAt: row.createdAt.toISOString(),
    odometerKm: row.odometerKm,
    liters: formatScaledInteger(row.litersMilliliters, 3),
    price: formatHufAmount(row.priceHuf),
    fullTank: row.fullTank,
    remark: row.remark,
  };
}

export function mapAdBlueRow(row: AdBlueRow): AdBlueRecord {
  return {
    id: row.id,
    eventDate: row.eventDate,
    createdAt: row.createdAt.toISOString(),
    odometerKm: row.odometerKm,
    liters: row.liters,
    price: row.price,
  };
}

export function mapExpenseRow(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    eventDate: row.eventDate,
    createdAt: row.createdAt.toISOString(),
    price: row.price,
    notes: row.notes,
  };
}
