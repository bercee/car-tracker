import type { CarInput } from '../domain.js';
import { ValidationError, requireExactKeys, requirePlainObject } from './common.js';

export const CAR_NAME_MAX_LENGTH = 60;

export function validateCarRequest(body: unknown): CarInput {
  const object = requirePlainObject(body);
  requireExactKeys(object, ['name']);

  if (typeof object.name !== 'string') {
    throw new ValidationError('name', 'name must be a string');
  }

  const name = object.name.trim();
  if (name === '') {
    throw new ValidationError('name', 'name is required');
  }

  if (name.length > CAR_NAME_MAX_LENGTH) {
    throw new ValidationError('name', `name must be at most ${CAR_NAME_MAX_LENGTH} characters`);
  }

  return { name };
}
