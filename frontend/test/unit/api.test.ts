import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  addAdBlue,
  addCar,
  addExpense,
  addFuel,
  deleteAdBlue,
  deleteExpense,
  deleteFuel,
  getAdBlue,
  getCars,
  getExpenses,
  getFuel,
  renameCar,
  updateAdBlue,
  updateExpense,
  updateFuel,
} from '../../src/api';

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses the specified paths, JSON headers, and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await getFuel(3);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cars/3/fuel',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 201 }));
    await addFuel(3, { eventDate: '2026-09-18', odometerKm: 1, liters: '1', price: '1', fullTank: false });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/cars/3/fuel',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('price'),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });
  it('uses car-scoped collection paths and the cars endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await getCars();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars', expect.anything());
    await getAdBlue(7);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/7/adblue', expect.anything());
    await getExpenses(7);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/7/expenses', expect.anything());
    await addAdBlue(7, { eventDate: '2026-09-18', odometerKm: 1, liters: '1', price: '1' });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/7/adblue', expect.objectContaining({ method: 'POST' }));
    await addExpense(7, { eventDate: '2026-09-18', price: 1, notes: null });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/7/expenses', expect.objectContaining({ method: 'POST' }));
    await addCar({ name: 'Golf' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/cars',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Golf' }) }),
    );
    await renameCar(7, { name: 'Polo' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/cars/7',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'Polo' }) }),
    );
  });
  it('maps error envelopes and network errors to safe ApiErrors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'Bad input', field: 'liters' } }), { status: 400 }),
        ),
    );
    await expect(getFuel(1)).rejects.toMatchObject({ message: 'Bad input', field: 'liters' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(getFuel(1)).rejects.toEqual(new ApiError('Unable to reach the server. Please try again.'));
  });

  it('uses member paths and methods, and accepts empty 204 delete responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 4 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await updateFuel(2, 4, { eventDate: '2026-09-18', odometerKm: 1, liters: '1', price: '1', fullTank: false });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/cars/2/fuel/4',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 5 }), { status: 200 }));
    await updateAdBlue(2, 5, { eventDate: '2026-09-18', odometerKm: 1, liters: '1', price: '1' });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/2/adblue/5', expect.objectContaining({ method: 'PUT' }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteAdBlue(2, 5)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/2/adblue/5', expect.objectContaining({ method: 'DELETE' }));

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 5 }), { status: 200 }));
    await updateExpense(2, 5, { eventDate: '2026-09-18', price: 1, notes: null });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/2/expenses/5', expect.objectContaining({ method: 'PUT' }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteExpense(2, 5)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/cars/2/expenses/5', expect.objectContaining({ method: 'DELETE' }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteFuel(2, 4)).resolves.toBeUndefined();
  });

  it('uses safe fallbacks for malformed responses and incomplete error envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON', { status: 200 })));
    await expect(getFuel(1)).rejects.toEqual(new ApiError('The server returned an invalid response.'));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status: 400 })));
    await expect(getFuel(1)).rejects.toEqual(new ApiError('The request could not be completed.'));
  });
});
