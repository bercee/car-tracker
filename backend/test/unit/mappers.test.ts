import { describe, expect, it } from 'vitest';

import { mapAdBlueRow, mapExpenseRow, mapFuelRow } from '../../src/database/mappers.js';

describe('database row mappers', () => {
  it('maps a fuel row with a whole-HUF total price', () => {
    expect(
      mapFuelRow({
        id: 42n,
        event_date: '2026-09-15',
        created_at: '2026-09-16T12:34:56.789Z',
        odometer_km: 82_450n,
        liters_milliliters: 47_300n,
        price_huf: 29_284n,
        full_tank: 1n,
        remark: 'Shell',
      }),
    ).toEqual({
      id: 42,
      eventDate: '2026-09-15',
      createdAt: '2026-09-16T12:34:56.789Z',
      odometerKm: 82_450,
      liters: '47.300',
      price: '29284',
      fullTank: true,
      remark: 'Shell',
    });
  });

  it('maps false full-tank and rejects corrupt Boolean storage', () => {
    const row = {
      id: 1,
      event_date: '2026-09-15',
      created_at: '2026-09-16T12:34:56.789Z',
      odometer_km: 1,
      liters_milliliters: 1,
      price_huf: 0,
      full_tank: 0,
      remark: null,
    };
    expect(mapFuelRow(row).fullTank).toBe(false);
    expect(() => mapFuelRow({ ...row, full_tank: 2 })).toThrow('full_tank must be 0 or 1');
  });

  it('maps an AdBlue row with liters padded and price in whole HUF', () => {
    expect(
      mapAdBlueRow({
        id: 2n,
        event_date: '2026-09-15',
        created_at: '2026-09-16T12:34:56.789Z',
        odometer_km: 82_450n,
        liters_milliliters: 10_000n,
        price_huf: 7490n,
      }),
    ).toMatchObject({ id: 2, liters: '10.000', price: '7490' });
  });

  it('maps an expense row with a whole-HUF amount', () => {
    expect(
      mapExpenseRow({
        id: 3n,
        event_date: '2026-09-15',
        created_at: '2026-09-16T12:34:56.789Z',
        amount_huf: 32_000n,
        notes: null,
      }),
    ).toMatchObject({ id: 3, amount: '32000', notes: null });
  });
});
