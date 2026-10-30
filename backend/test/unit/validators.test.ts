import { describe, expect, it } from 'vitest';

import { validateAdBlueRequest } from '../../src/validation/adblue.js';
import { validateFuelRequest } from '../../src/validation/fuel.js';

const validFuel = {
  eventDate: '2026-09-15',
  odometerKm: 82_450,
  liters: '47.300',
  price: '29284',
  fullTank: true,
  remark: ' Shell ',
};

describe('fuel validation', () => {
  it('validates and converts a complete request', () => {
    expect(validateFuelRequest(validFuel)).toEqual({
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      litersMilliliters: 47_300,
      priceHuf: 29_284,
      fullTank: true,
      remark: 'Shell',
    });
  });

  it('normalizes a missing or empty remark', () => {
    const withoutRemark = {
      eventDate: validFuel.eventDate,
      odometerKm: validFuel.odometerKm,
      liters: validFuel.liters,
      price: validFuel.price,
      fullTank: validFuel.fullTank,
    };
    expect(validateFuelRequest(withoutRemark).remark).toBeNull();
    expect(validateFuelRequest({ ...validFuel, remark: ' ' }).remark).toBeNull();
  });

  it('accepts total-price and remark boundaries', () => {
    expect(validateFuelRequest({ ...validFuel, price: '0', remark: 'x'.repeat(500) })).toMatchObject({
      priceHuf: 0,
      remark: 'x'.repeat(500),
    });
    expect(validateFuelRequest({ ...validFuel, price: '9999999' }).priceHuf).toBe(9_999_999);
  });

  it.each([
    [{ ...validFuel, surprise: true }, 'surprise is not allowed'],
    [{ ...validFuel, fullTank: 1 }, 'fullTank must be a boolean'],
    [{ ...validFuel, odometerKm: -1 }, 'odometerKm must be an integer'],
    [{ ...validFuel, liters: '0' }, 'liters must be greater than 0'],
    [{ ...validFuel, price: '-1' }, 'price must be a canonical whole-number HUF amount'],
    [{ ...validFuel, price: '29284.5' }, 'price must be a canonical whole-number HUF amount'],
    [{ ...validFuel, price: '10000000' }, 'price exceeds the maximum allowed value'],
    [{ ...validFuel, remark: 'x'.repeat(501) }, 'remark must be at most 500 characters'],
  ])('rejects invalid fuel input', (input, message) => {
    expect(() => validateFuelRequest(input)).toThrow(message);
  });

  it('rejects a missing required field and arrays', () => {
    const missingLiters = {
      eventDate: validFuel.eventDate,
      odometerKm: validFuel.odometerKm,
      price: validFuel.price,
      fullTank: validFuel.fullTank,
      remark: validFuel.remark,
    };
    expect(() => validateFuelRequest(missingLiters)).toThrow('liters is required');
    expect(() => validateFuelRequest([])).toThrow('body must be a plain JSON object');
  });
});

describe('AdBlue validation', () => {
  const valid = { eventDate: '2026-09-15', odometerKm: 82_450, liters: '10', price: '7490' };

  it('validates and converts a request', () => {
    expect(validateAdBlueRequest(valid)).toEqual({
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      litersMilliliters: 10_000,
      priceHuf: 7490,
    });
  });

  it.each([
    [{ ...valid, eventDate: '2026-02-30' }, 'eventDate must be a real calendar date'],
    [{ ...valid, liters: '10000' }, 'liters exceeds the maximum allowed value'],
    [{ ...valid, price: '10000000' }, 'price exceeds the maximum allowed value'],
    [{ ...valid, price: '7490.5' }, 'price must be a canonical whole-number HUF amount'],
    [{ ...valid, extra: null }, 'extra is not allowed'],
  ])('rejects invalid input', (input, message) => {
    expect(() => validateAdBlueRequest(input)).toThrow(message);
  });
});
