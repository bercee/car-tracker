import type { AdBlueRecord, ExpenseRecord, FuelRecord } from '../domain.js';
import { formatHufAmount, formatScaledInteger, toSafeInteger } from '../validation/common.js';

export interface FuelRow {
  id: bigint | number;
  event_date: string;
  created_at: string;
  odometer_km: bigint | number;
  liters_milliliters: bigint | number;
  price_huf: bigint | number;
  full_tank: bigint | number;
  remark: string | null;
}

export interface AdBlueRow {
  id: bigint | number;
  event_date: string;
  created_at: string;
  odometer_km: bigint | number;
  liters_milliliters: bigint | number;
  price_huf: bigint | number;
}

export interface ExpenseRow {
  id: bigint | number;
  event_date: string;
  created_at: string;
  amount_huf: bigint | number;
  notes: string | null;
}

export function mapFuelRow(row: FuelRow): FuelRecord {
  const fullTank = toSafeInteger(row.full_tank, 'full_tank');
  if (fullTank !== 0 && fullTank !== 1) {
    throw new RangeError('full_tank must be 0 or 1');
  }

  return {
    id: toSafeInteger(row.id, 'id'),
    eventDate: row.event_date,
    createdAt: row.created_at,
    odometerKm: toSafeInteger(row.odometer_km, 'odometer_km'),
    liters: formatScaledInteger(row.liters_milliliters, 3),
    price: formatHufAmount(row.price_huf),
    fullTank: fullTank === 1,
    remark: row.remark,
  };
}

export function mapAdBlueRow(row: AdBlueRow): AdBlueRecord {
  return {
    id: toSafeInteger(row.id, 'id'),
    eventDate: row.event_date,
    createdAt: row.created_at,
    odometerKm: toSafeInteger(row.odometer_km, 'odometer_km'),
    liters: formatScaledInteger(row.liters_milliliters, 3),
    price: formatHufAmount(row.price_huf),
  };
}

export function mapExpenseRow(row: ExpenseRow): ExpenseRecord {
  return {
    id: toSafeInteger(row.id, 'id'),
    eventDate: row.event_date,
    createdAt: row.created_at,
    amount: formatHufAmount(row.amount_huf),
    notes: row.notes,
  };
}
