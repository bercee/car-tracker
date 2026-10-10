import { z } from 'zod';

export const errorCodeSchema = z.enum(['VALIDATION_ERROR', 'NOT_FOUND', 'UNSUPPORTED_MEDIA_TYPE', 'INTERNAL_ERROR']);

export const errorEnvelopeSchema = z
  .strictObject({
    error: z.strictObject({
      code: errorCodeSchema,
      message: z.string(),
      field: z.string().optional(),
    }),
  })
  .meta({ id: 'ErrorEnvelope' });

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
