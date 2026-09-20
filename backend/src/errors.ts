import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode, ErrorEnvelope } from '@car-tracker/contracts';
import { ZodError } from 'zod';

export { errorEnvelopeSchema } from '@car-tracker/contracts';
export type { ErrorCode, ErrorEnvelope } from '@car-tracker/contracts';

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

  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return new HttpError(
      400,
      'VALIDATION_ERROR',
      issue?.message ?? 'Request validation failed',
      issue?.path.map(String).join('.') || 'body',
    );
  }

  if (error instanceof HTTPException && error.status === 400 && error.message === 'Malformed JSON in request body') {
    return new HttpError(400, 'VALIDATION_ERROR', 'body must contain valid JSON', 'body');
  }

  if (error instanceof HTTPException && error.status === 415) {
    return new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
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

export function createErrorHandler(logger: Pick<Console, 'error'> = console): ErrorHandler {
  return (error, context) => {
    const httpError = toHttpError(error);

    if (httpError.status >= 500) {
      logger.error('Unhandled request error', error);
    }

    return context.json(toErrorEnvelope(httpError), httpError.status as ContentfulStatusCode);
  };
}
