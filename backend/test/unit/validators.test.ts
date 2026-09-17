import { describe, expect, it } from 'vitest';

import { validateAdBlueRequest } from '../../src/validation/adblue.js';
import { validateExpenseRequest } from '../../src/validation/expense.js';
import { validateFuelRequest } from '../../src/validation/fuel.js';

const validFuel = {
  eventDate: '2026-09-15',
  odometerKm: 82_450,
  liters: '47.300',
  pricePerLiter: '619',
  fullTank: true,
  remark: ' Shell ',
};

describe('fuel validation', () => {
  it('validates and converts a complete request', () => {
    expect(validateFuelRequest(validFuel)).toEqual({
      eventDate: '2026-09-15',
      odometerKm: 82_450,
      litersMilliliters: 47_300,
      pricePerLiterHuf: 619,
      fullTank: true,
      remark: 'Shell',
    });
  });

  it('normalizes a missing or empty remark', () => {
    const withoutRemark = {
      eventDate: validFuel.eventDate,
      odometerKm: validFuel.odometerKm,
      liters: validFuel.liters,
      pricePerLiter: validFuel.pricePerLiter,
      fullTank: validFuel.fullTank,
    };
    expect(validateFuelRequest(withoutRemark).remark).toBeNull();
    expect(validateFuelRequest({ ...validFuel, remark: ' ' }).remark).toBeNull();
  });

  it('accepts unit-price and remark boundaries', () => {
    expect(validateFuelRequest({ ...validFuel, pricePerLiter: '0', remark: 'x'.repeat(500) })).toMatchObject({
      pricePerLiterHuf: 0,
      remark: 'x'.repeat(500),
    });
    expect(validateFuelRequest({ ...validFuel, pricePerLiter: '9999' }).pricePerLiterHuf).toBe(9_999);
  });

  it.each([
    [{ ...validFuel, surprise: true }, 'surprise is not allowed'],
    [{ ...validFuel, fullTank: 1 }, 'fullTank must be a boolean'],
    [{ ...validFuel, odometerKm: -1 }, 'odometerKm must be an integer'],
    [{ ...validFuel, liters: '0' }, 'liters must be greater than 0'],
    [{ ...validFuel, pricePerLiter: '-1' }, 'pricePerLiter must be a canonical whole-number HUF amount'],
    [{ ...validFuel, pricePerLiter: '619.5' }, 'pricePerLiter must be a canonical whole-number HUF amount'],
    [{ ...validFuel, pricePerLiter: '10000' }, 'pricePerLiter exceeds the maximum allowed value'],
    [{ ...validFuel, remark: 'x'.repeat(501) }, 'remark must be at most 500 characters'],
  ])('rejects invalid fuel input', (input, message) => {
    expect(() => validateFuelRequest(input)).toThrow(message);
  });

  it('rejects a missing required field and arrays', () => {
    const missingLiters = {
      eventDate: validFuel.eventDate,
      odometerKm: validFuel.odometerKm,
      pricePerLiter: validFuel.pricePerLiter,
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

describe('expense validation', () => {
  const valid = { eventDate: '2026-09-15', amount: '32000', notes: ' Annual inspection ' };

  it('validates and converts a request', () => {
    expect(validateExpenseRequest(valid)).toEqual({
      eventDate: '2026-09-15',
      amountHuf: 32_000,
      notes: 'Annual inspection',
    });
  });

  it('accepts zero HUF and null notes', () => {
    expect(validateExpenseRequest({ ...valid, amount: '0', notes: null })).toMatchObject({
      amountHuf: 0,
      notes: null,
    });
  });

  it('accepts the maximum HUF value and maximum-length notes', () => {
    expect(validateExpenseRequest({ ...valid, amount: '9999999', notes: 'x'.repeat(1000) })).toMatchObject({
      amountHuf: 9_999_999,
      notes: 'x'.repeat(1000),
    });
  });

  it.each([
    [{ ...valid, amount: '-1' }, 'amount must be a canonical whole-number HUF amount'],
    [{ ...valid, amount: '32000.5' }, 'amount must be a canonical whole-number HUF amount'],
    [{ ...valid, notes: 'x'.repeat(1001) }, 'notes must be at most 1000 characters'],
    [{ ...valid, notes: false }, 'notes must be a string or null'],
    [{ eventDate: valid.eventDate, notes: valid.notes }, 'amount is required'],
  ])('rejects invalid input', (input, message) => {
    expect(() => validateExpenseRequest(input)).toThrow(message);
  });
});
