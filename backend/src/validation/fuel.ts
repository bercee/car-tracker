import type { FuelInput } from '../domain.js';
import {
  ValidationError,
  normalizeOptionalText,
  parseCalendarDate,
  parseDecimalToScaledInteger,
  parseHufAmount,
  parseIntegerInRange,
  requireExactKeys,
  requirePlainObject,
} from './common.js';

export function validateFuelRequest(value: unknown): FuelInput {
  const object = requirePlainObject(value);
  requireExactKeys(object, ['eventDate', 'odometerKm', 'liters', 'price', 'fullTank'], ['remark']);

  if (typeof object.fullTank !== 'boolean') {
    throw new ValidationError('fullTank', 'fullTank must be a boolean');
  }

  return {
    eventDate: parseCalendarDate(object.eventDate),
    odometerKm: parseIntegerInRange(object.odometerKm, 'odometerKm', 0, 9_999_999),
    litersMilliliters: parseDecimalToScaledInteger(object.liters, {
      field: 'liters',
      scale: 3,
      maximumScaled: 9_999_999,
      allowZero: false,
    }),
    priceHuf: parseHufAmount(object.price, 'price', 9_999_999),
    fullTank: object.fullTank,
    remark: normalizeOptionalText(object.remark, 'remark', 500),
  };
}
