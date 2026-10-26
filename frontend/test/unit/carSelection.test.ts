import type { Car } from '@car-tracker/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, pickActiveCar, readStoredCarId, storeCarId } from '../../src/carSelection';

const car = (id: number): Car => ({ id, name: `Car ${id}`, createdAt: '' });

describe('car selection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('round-trips the stored id', () => {
    storeCarId(4);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('4');
    expect(readStoredCarId()).toBe(4);
  });
  it('ignores missing or malformed stored values', () => {
    expect(readStoredCarId()).toBeUndefined();
    window.localStorage.setItem(STORAGE_KEY, 'abc');
    expect(readStoredCarId()).toBeUndefined();
    window.localStorage.setItem(STORAGE_KEY, '99999999999999999999');
    expect(readStoredCarId()).toBeUndefined();
  });
  it('swallows storage failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredCarId()).toBeUndefined();
    expect(() => storeCarId(1)).not.toThrow();
  });
  it('picks the stored car, else the first car, else nothing', () => {
    expect(pickActiveCar([car(1), car(2)], 2)).toBe(2);
    expect(pickActiveCar([car(1), car(2)], 9)).toBe(1);
    expect(pickActiveCar([car(1), car(2)], undefined)).toBe(1);
    expect(pickActiveCar([], 2)).toBeUndefined();
  });
});
