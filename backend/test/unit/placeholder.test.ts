import { describe, expect, it } from 'vitest';

import { getServiceName } from '../../src/placeholder.js';

describe('backend workspace', () => {
  it('exports its stable service name', () => {
    expect(getServiceName()).toBe('car-tracker-backend');
  });
});
