import { z } from 'zod';

const maximumValue = 9_999_999;

export const idSchema = z.number().int().positive();
export const createdAtSchema = z.string().datetime({ offset: true });

export const eventDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must use YYYY-MM-DD format').refine(
  (value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return year !== 0 && date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
  },
  'eventDate must be a real calendar date',
);

export const odometerSchema = z.number().int().min(0).max(maximumValue);

export function optionalTextSchema(maximumLength: number) {
  return z
    .string()
    .max(maximumLength)
    .nullable()
    .optional()
    .transform((value) => {
      const text = value?.trim();
      return text ? text : null;
    });
}

export function scaledDecimalSchema(scale: number) {
  const syntax = new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${scale}}))?$`);
  return z
    .string()
    .regex(syntax, `must be a canonical decimal with up to ${scale} fractional digits`)
    .transform((value) => {
      const [whole = '0', fraction = ''] = value.split('.');
      return Number(BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0')));
    })
    .pipe(z.number().int().positive().max(maximumValue));
}

export const hufSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, 'must be a canonical whole-number HUF amount')
  .transform(Number)
  .pipe(z.number().int().min(0).max(maximumValue));

export function formatScaledInteger(value: number, scale: number): string {
  const integer = z.number().int().nonnegative().safe().parse(value);
  const digits = integer.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function formatHufAmount(value: number): string {
  return z.number().int().nonnegative().safe().parse(value).toString();
}
