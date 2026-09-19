import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, addFuel, getFuel } from '../../src/api';

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses the specified paths, JSON headers, and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await getFuel();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/fuel',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 201 }));
    await addFuel({ eventDate: '2026-09-18', odometerKm: 1, liters: '1', price: '1', fullTank: false });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/fuel',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('price'),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
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
    await expect(getFuel()).rejects.toMatchObject({ message: 'Bad input', field: 'liters' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(getFuel()).rejects.toEqual(new ApiError('Unable to reach the server. Please try again.'));
  });

  it('uses safe fallbacks for malformed responses and incomplete error envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON', { status: 200 })));
    await expect(getFuel()).rejects.toEqual(new ApiError('The server returned an invalid response.'));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status: 400 })));
    await expect(getFuel()).rejects.toEqual(new ApiError('The request could not be completed.'));
  });
});
