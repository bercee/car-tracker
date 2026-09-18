import type { ErrorRequestHandler } from 'express';

import { ValidationError } from './validation/common.js';

export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNSUPPORTED_MEDIA_TYPE' | 'INTERNAL_ERROR';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    field?: string;
  };
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly field: string | undefined;

  constructor(status: number, code: ErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof ValidationError) {
    return new HttpError(400, 'VALIDATION_ERROR', error.message, error.field);
  }

  if (isBodyParserError(error, 413, 'entity.too.large')) {
    return new HttpError(413, 'VALIDATION_ERROR', 'request body must not exceed 16 KB', 'body');
  }

  if (isBodyParserError(error, 400, 'entity.parse.failed')) {
    return new HttpError(400, 'VALIDATION_ERROR', 'body must contain valid JSON', 'body');
  }

  return new HttpError(500, 'INTERNAL_ERROR', 'An internal error occurred');
}

export function toErrorEnvelope(error: HttpError): ErrorEnvelope {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.field === undefined ? {} : { field: error.field }),
    },
  };
}

export function createErrorHandler(logger: Pick<Console, 'error'> = console): ErrorRequestHandler {
  return (error: unknown, request, response, next) => {
    void request;
    void next;
    const httpError = toHttpError(error);

    if (httpError.status >= 500) {
      logger.error('Unhandled request error', error);
    }

    response.status(httpError.status).json(toErrorEnvelope(httpError));
  };
}

function isBodyParserError(error: unknown, status: number, type: string): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  return Reflect.get(error, 'status') === status && Reflect.get(error, 'type') === type;
}
