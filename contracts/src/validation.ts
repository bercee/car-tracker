import { z } from 'zod';

export const maximumValue = 9_999_999;

export const idSchema = z.number().int().positive();
export const createdAtSchema = z
  .string()
  .datetime({ offset: true })
  .meta({ description: 'Creation time in ISO 8601 format', example: '2026-09-20T12:00:00.000Z' });

export const eventDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must use YYYY-MM-DD format')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return (
      year !== 0 && date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
    );
  }, 'eventDate must be a real calendar date')
  .meta({ description: 'Calendar date in YYYY-MM-DD format', example: '2026-09-20' });

export const odometerSchema = z.number().int().min(0).max(maximumValue);

export function optionalTextSchema(maximumLength: number) {
  return z.string().max(maximumLength).nullable().optional();
}

export function scaledDecimalSchema(scale: number) {
  const syntax = new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${scale}}))?$`);
  const toScaledInteger = (value: string) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'));
  };

  return z
    .string()
    .regex(syntax, `must be a canonical decimal with up to ${scale} fractional digits`)
    .refine((value) => !syntax.test(value) || toScaledInteger(value) > 0n, 'Too small: expected number to be >0')
    .refine(
      (value) => !syntax.test(value) || toScaledInteger(value) <= BigInt(maximumValue),
      `Too big: expected number to be <=${maximumValue}`,
    )
    .meta({
      description: `Positive canonical decimal with up to ${scale} fractional digits; the scaled value must not exceed ${maximumValue}`,
      example: scale === 3 ? '42.125' : '42',
    });
}

export const hufSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, 'must be a canonical whole-number HUF amount')
  .refine(
    (value) => !/^(0|[1-9]\d*)$/.test(value) || BigInt(value) <= BigInt(maximumValue),
    `Too big: expected number to be <=${maximumValue}`,
  )
  .meta({ description: `Canonical whole-number HUF amount from 0 through ${maximumValue}`, example: '25100' });
