import { describe, expect, it } from 'vitest';

import { mapCarRow, mapFuelRow } from '../../src/database/mappers.js';

const createdAt = new Date('2026-09-16T12:34:56.789Z');

describe('database row mappers', () => {
  it('maps a car row with an ISO creation timestamp', () => {
    expect(mapCarRow({ id: 1, name: 'Octavia', createdAt })).toEqual({
      id: 1,
      name: 'Octavia',
      createdAt: '2026-09-16T12:34:56.789Z',
    });
  });

  it('maps a fuel row with a whole-HUF total price', () => {
    expect(
      mapFuelRow({
        id: 42,
        carId: 1,
        eventDate: '2026-09-15',
        createdAt,
        odometerKm: 82_450,
        litersMilliliters: 47_300,
        priceHuf: 29_284,
        fullTank: true,
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
});
