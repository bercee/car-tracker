import type { AdBlueInput } from '../domain.js';
import {
  parseCalendarDate,
  parseDecimalToScaledInteger,
  parseHufAmount,
  parseIntegerInRange,
  requireExactKeys,
  requirePlainObject,
} from './common.js';

export function validateAdBlueRequest(value: unknown): AdBlueInput {
  const object = requirePlainObject(value);
  requireExactKeys(object, ['eventDate', 'odometerKm', 'liters', 'price']);

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
  };
}
