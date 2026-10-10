import { z } from 'zod';

export function parseScaledDecimal(value: string, scale: number): number {
  const [whole = '0', fraction = ''] = value.split('.');
  return Number(BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0')));
}

export function parseHufAmount(value: string): number {
  return Number(value);
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

export function formatScaledInteger(value: number, scale: number): string {
  const integer = z.number().int().nonnegative().safe().parse(value);
  const digits = integer.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function formatHufAmount(value: number): string {
  return z.number().int().nonnegative().safe().parse(value).toString();
}
