import { bodyLimit } from 'hono/body-limit';
import type { MiddlewareHandler } from 'hono';
import type { ZodType } from 'zod';

import { errorEnvelopeSchema, HttpError, toErrorEnvelope } from '../errors.js';

export function jsonResponse(schema: ZodType, description: string) {
  return {
    content: {
      'application/json': { schema },
    },
    description,
  };
}

export const standardErrorResponses = {
  400: jsonResponse(errorEnvelopeSchema, 'The request is invalid'),
  500: jsonResponse(errorEnvelopeSchema, 'An internal error occurred'),
};

export const postErrorResponses = {
  ...standardErrorResponses,
  413: jsonResponse(errorEnvelopeSchema, 'The request body is too large'),
  415: jsonResponse(errorEnvelopeSchema, 'The request body is not JSON'),
};

export const requireJson: MiddlewareHandler = async (context, next) => {
  const contentType = context.req.header('content-type');
  if (contentType === undefined || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }

  await next();
};

export const limitJsonBodySize = bodyLimit({
  maxSize: 16 * 1024,
  onError: (context) => {
    const error = new HttpError(413, 'VALIDATION_ERROR', 'request body must not exceed 16 KB', 'body');
    return context.json(toErrorEnvelope(error), 413);
  },
});
