import { describe, expect, it } from 'vitest';

import { mapCarRow } from '../../src/database/mappers.js';

const createdAt = new Date('2026-09-16T12:34:56.789Z');

describe('database row mappers', () => {
  it('maps a car row with an ISO creation timestamp', () => {
    expect(mapCarRow({ id: 1, name: 'Octavia', createdAt })).toEqual({
      id: 1,
      name: 'Octavia',
      createdAt: '2026-09-16T12:34:56.789Z',
    });
  });
});
