export class ValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export function requirePlainObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('body', 'body must be a plain JSON object');
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ValidationError('body', 'body must be a plain JSON object');
  }

  return value as Record<string, unknown>;
}

export function requireExactKeys(
  object: Record<string, unknown>,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): void {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const unknownKey = Object.keys(object).find((key) => !allowed.has(key));
  if (unknownKey !== undefined) {
    throw new ValidationError(unknownKey, `${unknownKey} is not allowed`);
  }

  const missingKey = requiredKeys.find((key) => !Object.hasOwn(object, key));
  if (missingKey !== undefined) {
    throw new ValidationError(missingKey, `${missingKey} is required`);
  }
}

export function parseCalendarDate(value: unknown, field = 'eventDate'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(field, `${field} must use YYYY-MM-DD format`);
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximumDay = daysInMonth[month - 1];

  if (year === 0 || maximumDay === undefined || day < 1 || day > maximumDay) {
    throw new ValidationError(field, `${field} must be a real calendar date`);
  }

  return value;
}

export function parseIntegerInRange(value: unknown, field: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ValidationError(field, `${field} must be an integer from ${minimum} through ${maximum}`);
  }

  return value;
}

export interface DecimalOptions {
  field: string;
  scale: number;
  maximumScaled: number;
  allowZero: boolean;
}

export function parseDecimalToScaledInteger(value: unknown, options: DecimalOptions): number {
  const { field, scale, maximumScaled, allowZero } = options;
  const syntax = new RegExp(`^(0|[1-9]\\d*)(?:\\.(\\d{1,${scale}}))?$`);

  if (typeof value !== 'string') {
    throw new ValidationError(field, `${field} must be a decimal string`);
  }

  const match = syntax.exec(value);
  if (match === null) {
    throw new ValidationError(field, `${field} must be a canonical decimal with up to ${scale} fractional digits`);
  }

  const whole = match[1];
  if (whole === undefined) {
    throw new ValidationError(field, `${field} must be a decimal string`);
  }

  const fraction = (match[2] ?? '').padEnd(scale, '0');
  const multiplier = 10n ** BigInt(scale);
  const scaled = BigInt(whole) * multiplier + BigInt(fraction || '0');

  if (!allowZero && scaled === 0n) {
    throw new ValidationError(field, `${field} must be greater than 0`);
  }

  if (scaled > BigInt(maximumScaled)) {
    throw new ValidationError(field, `${field} exceeds the maximum allowed value`);
  }

  return Number(scaled);
}

export function parseHufAmount(value: unknown, field: string, maximum: number): number {
  if (typeof value !== 'string') {
    throw new ValidationError(field, `${field} must be a whole-number HUF string`);
  }

  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new ValidationError(field, `${field} must be a canonical whole-number HUF amount`);
  }

  const amount = BigInt(value);
  if (amount > BigInt(maximum)) {
    throw new ValidationError(field, `${field} exceeds the maximum allowed value`);
  }

  return Number(amount);
}

export function formatScaledInteger(value: bigint | number, scale: number): string {
  const integer = toSafeInteger(value, 'stored decimal');
  if (integer < 0) {
    throw new RangeError('stored decimal must not be negative');
  }

  const digits = integer.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export function formatHufAmount(value: bigint | number): string {
  const integer = toSafeInteger(value, 'stored HUF amount');
  if (integer < 0) {
    throw new RangeError('stored HUF amount must not be negative');
  }

  return integer.toString();
}

export function normalizeOptionalText(value: unknown, field: string, maximumLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(field, `${field} must be a string or null`);
  }

  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    throw new ValidationError(field, `${field} must be at most ${maximumLength} characters`);
  }

  return normalized === '' ? null : normalized;
}

export function toSafeInteger(value: bigint | number, field: string): number {
  const integer = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(integer)) {
    throw new RangeError(`${field} is outside the JavaScript safe-integer range`);
  }

  return integer;
}
