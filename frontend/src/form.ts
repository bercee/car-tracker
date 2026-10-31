import type { z } from 'zod';

export type Parsed<Request> = { data: Request } | { error: string };

// Validates a request built from form inputs with the shared schema; the message is the first issue's.
export function parseRequest<Schema extends z.ZodType>(schema: Schema, input: unknown): Parsed<z.infer<Schema>> {
  const result = schema.safeParse(input);
  return result.success ? { data: result.data } : { error: result.error.issues[0]!.message };
}

// An empty input is missing (undefined), not 0.
export const numberOf = (text: string): number | undefined => (text.trim() === '' ? undefined : Number(text));
