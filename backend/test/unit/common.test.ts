import { describe, expect, it } from 'vitest';

import {
  ValidationError,
  formatHufAmount,
  formatScaledInteger,
  normalizeOptionalText,
  parseCalendarDate,
  parseDecimalToScaledInteger,
  parseHufAmount,
  parseIntegerInRange,
  requireExactKeys,
  requirePlainObject,
  toSafeInteger,
} from '../../src/validation/common.js';

describe('calendar date validation', () => {
  it.each(['2024-02-29', '2000-02-29', '2026-09-17', '9999-12-31'])('accepts real ISO date %s', (value) => {
    expect(parseCalendarDate(value)).toBe(value);
  });

  it.each(['2023-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00', '0000-01-01'])(
    'rejects impossible date %s',
    (value) => {
      expect(() => parseCalendarDate(value)).toThrow(ValidationError);
    },
  );

  it.each(['2026-1-01', '26-01-01', '2026/01/01', ' 2026-01-01', '', 20260917, null])(
    'rejects malformed date %s',
    (value) => {
      expect(() => parseCalendarDate(value)).toThrow('eventDate must use YYYY-MM-DD format');
    },
  );
});

describe('liter decimal conversion', () => {
  const liters = (value: unknown) =>
    parseDecimalToScaledInteger(value, {
      field: 'liters',
      scale: 3,
      maximumScaled: 9_999_999,
      allowZero: false,
    });

  it.each([
    ['1', 1000],
    ['1.6', 1600],
    ['1.619', 1619],
    ['0.001', 1],
    ['9999.999', 9_999_999],
  ])('converts %s exactly to %i', (value, expected) => {
    expect(liters(value)).toBe(expected);
  });

  it.each(['-1', '+1', '1e2', '1,2', ' ', '1.0000', '10000', '00.1', '.1', '1.', '0', '0.000'])(
    'rejects %s',
    (value) => {
      expect(() => liters(value)).toThrow(ValidationError);
    },
  );

  it('requires a string and reports the field', () => {
    expect(() => liters(1.2)).toThrow('liters must be a decimal string');
    try {
      liters('-1');
    } catch (error) {
      expect(error).toMatchObject({ field: 'liters', name: 'ValidationError' });
    }
  });
});

describe('HUF amount conversion', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['619', 619],
    ['9999999', 9_999_999],
  ])('converts %s exactly to %i HUF', (value, expected) => {
    expect(parseHufAmount(value, 'amount', 9_999_999)).toBe(expected);
  });

  it.each(['-1', '+1', '1.0', '1.99', '1e2', '1,000', ' 1', '01', '', '10000000'])(
    'rejects invalid HUF amount %s',
    (value) => {
      expect(() => parseHufAmount(value, 'amount', 9_999_999)).toThrow(ValidationError);
    },
  );

  it('requires a string', () => {
    expect(() => parseHufAmount(619, 'amount', 9_999_999)).toThrow('amount must be a whole-number HUF string');
  });
});

describe('common input helpers', () => {
  it.each([0, 9_999_999])('accepts odometer boundary %i', (value) => {
    expect(parseIntegerInRange(value, 'odometerKm', 0, 9_999_999)).toBe(value);
  });

  it.each([-1, 10_000_000, 1.5, Number.NaN, '1'])('rejects invalid odometer %s', (value) => {
    expect(() => parseIntegerInRange(value, 'odometerKm', 0, 9_999_999)).toThrow(ValidationError);
  });

  it('accepts plain objects, including null-prototype objects', () => {
    expect(requirePlainObject({ value: 1 })).toEqual({ value: 1 });
    const object = Object.create(null) as Record<string, unknown>;
    object.value = 1;
    expect(requirePlainObject(object)).toBe(object);
  });

  it.each([null, [], 'object', new Date()])('rejects non-plain body %#', (value) => {
    expect(() => requirePlainObject(value)).toThrow('body must be a plain JSON object');
  });

  it('rejects missing and unknown keys', () => {
    expect(() => requireExactKeys({}, ['known'])).toThrow('known is required');
    expect(() => requireExactKeys({ known: 1, extra: 2 }, ['known'])).toThrow('extra is not allowed');
    expect(() => requireExactKeys({ known: 1, optional: 2 }, ['known'], ['optional'])).not.toThrow();
  });

  it('normalizes optional text', () => {
    expect(normalizeOptionalText(undefined, 'notes', 10)).toBeNull();
    expect(normalizeOptionalText(null, 'notes', 10)).toBeNull();
    expect(normalizeOptionalText('  hello  ', 'notes', 10)).toBe('hello');
    expect(normalizeOptionalText('   ', 'notes', 10)).toBeNull();
  });

  it('rejects invalid optional text', () => {
    expect(() => normalizeOptionalText(3, 'notes', 10)).toThrow('notes must be a string or null');
    expect(() => normalizeOptionalText('12345678901', 'notes', 10)).toThrow('notes must be at most 10 characters');
  });
});

describe('storage formatting', () => {
  it.each([
    [0, 2, '0.00'],
    [1n, 3, '0.001'],
    [1600, 3, '1.600'],
    [9_999_999n, 3, '9999.999'],
  ])('formats %s at scale %i', (value, scale, expected) => {
    expect(formatScaledInteger(value, scale)).toBe(expected);
  });

  it('rejects unsafe or negative storage integers', () => {
    expect(() => toSafeInteger(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 'id')).toThrow(RangeError);
    expect(() => toSafeInteger(1.5, 'id')).toThrow(RangeError);
    expect(() => formatScaledInteger(-1, 2)).toThrow('stored decimal must not be negative');
  });

  it('formats whole HUF amounts and rejects invalid storage', () => {
    expect(formatHufAmount(0)).toBe('0');
    expect(formatHufAmount(619n)).toBe('619');
    expect(() => formatHufAmount(-1)).toThrow('stored HUF amount must not be negative');
  });
});
