import { describe, expect, it, vi } from 'vitest';
import { formatDate, formatLiters, formatMoney, today } from '../../src/format';
import { isHuf, validateCommon } from '../../src/validation';

describe('format helpers', () => {
  it('formats canonical quantities and validates useful input rules', () => {
    expect(formatLiters('1.6')).toBe('1.600 L');
    expect(formatDate('2026-09-18')).toMatch(/2026\. szept\. 18\./);
    expect(isHuf('619')).toBe(true);
    expect(isHuf('1.5')).toBe(false);
    expect(validateCommon('2026-09-18', '0', '0.001')).toBeUndefined();
    expect(validateCommon('bad', '0', '1')).toBeDefined();
    expect(formatMoney('619')).toContain('619');
  });
  it('uses a local ISO date for defaults', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T12:00:00'));
    expect(today()).toBe('2026-09-18');
    vi.useRealTimers();
  });
});
