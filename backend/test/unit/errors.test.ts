import { describe, expect, it, vi } from 'vitest';

import { createErrorHandler, HttpError, toErrorEnvelope, toHttpError } from '../../src/errors.js';
import { ValidationError } from '../../src/validation/common.js';

describe('HTTP-safe errors', () => {
  it('maps validation errors with their field', () => {
    const error = toHttpError(new ValidationError('liters', 'liters must be greater than 0'));

    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', field: 'liters' });
    expect(toErrorEnvelope(error)).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'liters must be greater than 0', field: 'liters' },
    });
  });

  it('preserves an existing HTTP-safe error without adding an absent field', () => {
    const error = new HttpError(404, 'NOT_FOUND', 'Missing');

    expect(toHttpError(error)).toBe(error);
    expect(toErrorEnvelope(error)).toEqual({ error: { code: 'NOT_FOUND', message: 'Missing' } });
  });

  it.each([
    [{ status: 413, type: 'entity.too.large' }, 413, 'request body must not exceed 16 KB'],
    [{ status: 400, type: 'entity.parse.failed' }, 400, 'body must contain valid JSON'],
  ])('maps body-parser errors to safe validation errors', (source, status, message) => {
    expect(toHttpError(source)).toMatchObject({ status, code: 'VALIDATION_ERROR', message, field: 'body' });
  });

  it.each([null, 'failure', { status: 413, type: 'different' }, new Error('SQL secret')])(
    'sanitizes unknown errors',
    (source) => {
      expect(toHttpError(source)).toMatchObject({
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      });
    },
  );

  it('logs internal failures and writes the sanitized envelope', () => {
    const logger = { error: vi.fn() };
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const handler = createErrorHandler(logger);
    const source = new Error('private detail');

    handler(source, {} as never, { status, json } as never, vi.fn());

    expect(logger.error).toHaveBeenCalledWith('Unhandled request error', source);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
    });
  });
});
