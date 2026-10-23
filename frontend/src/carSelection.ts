import type { Car } from '@car-tracker/contracts';

export const STORAGE_KEY = 'car-tracker.activeCarId';

export function readStoredCarId(): number | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || !/^\d+$/.test(raw)) return undefined;
    const id = Number(raw);
    return Number.isSafeInteger(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function storeCarId(id: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Storage may be unavailable (private mode, quota); the selection just won't persist.
  }
}

export function pickActiveCar(cars: Car[], storedId: number | undefined): number | undefined {
  return (cars.find((car) => car.id === storedId) ?? cars[0])?.id;
}
